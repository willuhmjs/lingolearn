import { json } from '@sveltejs/kit';
import { SrsState } from '@prisma/client';
import { prisma } from '$lib/server/prisma';
import { generateLessonRateLimiter } from '$lib/server/ratelimit';
import { buildLessonPrompt, type GameMode } from '$lib/server/promptBuilder';
import { generateLessonStream } from '$lib/server/lessonLlmService';

export async function POST(event) {
	const { request, locals } = event;
	
	const user = locals.user ? await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: { useLocalLlm: true }
	}) : null;

	if (!user?.useLocalLlm && await generateLessonRateLimiter.isLimited(event)) {
		return json({ error: 'Too many requests. Limit is 10/min, 200/day.' }, { status: 429 });
	}

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const gameMode: GameMode = body.gameMode || 'native-to-target';
		const assignmentId = body.assignmentId;
		let activeLangName = locals.user.activeLanguage?.name || 'Target Language';
		const userId = locals.user.id;
		let activeLanguageId = locals.user.activeLanguage?.id;

		let targetCefrLevel = locals.user.cefrLevel || 'A1';
		let assignmentTopic: string | null = null;
		let assignmentTargetGrammar: string[] = [];

		if (assignmentId) {
			const assignment = (await prisma.assignment.findUnique({
				where: { id: assignmentId }
			})) as any;
			if (assignment && assignment.targetCefrLevel) {
				targetCefrLevel = assignment.targetCefrLevel;
			}
			if (assignment) {
				assignmentTopic = assignment.topic || null;
				assignmentTargetGrammar = assignment.targetGrammar || [];

				// Use assignment's language instead of user's active language if it's not international
				if (assignment.language && assignment.language !== 'international') {
					const assignmentLanguage = await prisma.language.findUnique({
						where: { code: assignment.language }
					});
					if (assignmentLanguage) {
						activeLanguageId = assignmentLanguage.id;
						activeLangName = assignmentLanguage.name;
					}
				}
			}
		}

		if (!activeLanguageId) {
			return json({ error: 'No active language found' }, { status: 400 });
		}

		const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
		const userLevelIndex = cefrLevels.indexOf(targetCefrLevel);
		const allowedLevels = cefrLevels.slice(0, userLevelIndex + 1);

		const now = new Date();
		const nearDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);

		// 1. Get current LEARNING pool (regardless of due date)
		const learningPool = await prisma.userVocabulary.findMany({
			where: {
				userId,
				srsState: SrsState.LEARNING,
				vocabulary: { languageId: activeLanguageId } as any
			},
			include: { vocabulary: { include: { meanings: true } } }
		});

		// 2. If pool < 3, replenish to 6
		if (learningPool.length < 3) {
			const needed = 6 - learningPool.length;

			const knownVocabIds = await prisma.userVocabulary.findMany({
				where: { userId },
				select: { vocabularyId: true }
			});
			const knownIdsArray = knownVocabIds.map((v) => v.vocabularyId);

			// Try to find level-appropriate words, prioritizing beginner words first if at A1
			let unseenVocabs: any[] = [];
			if (targetCefrLevel === 'A1') {
				unseenVocabs = await prisma.vocabulary.findMany({
					where: {
						id: { notIn: knownIdsArray },
						meanings: { some: {} },
						languageId: activeLanguageId,
						cefrLevel: { in: allowedLevels },
						isBeginner: true
					} as any,
					take: needed
				});
			}

			if (unseenVocabs.length < needed) {
				const additionalUnseen = await prisma.vocabulary.findMany({
					where: {
						id: { notIn: [...knownIdsArray, ...unseenVocabs.map((v) => v.id)] },
						meanings: { some: {} },
						languageId: activeLanguageId,
						cefrLevel: { in: allowedLevels }
					} as any,
					take: needed - unseenVocabs.length
				});
				unseenVocabs = [...unseenVocabs, ...additionalUnseen];
			}

			for (const vocab of unseenVocabs) {
				const newUserVocab = await prisma.userVocabulary.create({
					data: {
						userId,
						vocabularyId: vocab.id,
						srsState: SrsState.LEARNING,
						eloRating: 1000,
						nextReviewDate: now // Make it due immediately
					},
					include: { vocabulary: { include: { meanings: true } } }
				});
				learningPool.push(newUserVocab as any);
			}
		}

		// 3. Select due/near-due words from the pool for THIS lesson
		let selectedLearning = learningPool.filter(
			(uv) => !uv.nextReviewDate || uv.nextReviewDate <= now
		);

		if (selectedLearning.length < 3) {
			// Relax filter: include near-due words (within 24 hours)
			const nearDueLearning = learningPool.filter(
				(uv) => uv.nextReviewDate && uv.nextReviewDate > now && uv.nextReviewDate <= nearDue
			);
			selectedLearning = [...selectedLearning, ...nearDueLearning];
		}

		// If still too few, just take anything from the pool to ensure we have content
		if (selectedLearning.length < 3) {
			selectedLearning = learningPool;
		}

		// Final selection for the lesson (shuffled)
		const learningVocabDb = selectedLearning.sort(() => 0.5 - Math.random()).slice(0, 6);

		// 4. Fetch Mastered Vocabulary and Grammar
		let masteredGrammarDb: any[];
		const [masteredVocabDb, initialMasteredGrammarDb, allMasteredGrammarIdsQuery] = await Promise.all([
			prisma.userVocabulary.findMany({
				where: {
					userId,
					srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
					OR: [{ nextReviewDate: null }, { nextReviewDate: { lte: now } }],
					vocabulary: { meanings: { some: {} }, languageId: activeLanguageId } as any
				},
				include: { vocabulary: { include: { meanings: true } } },
				take: 20
			}),
			prisma.userGrammarRule.findMany({
				where: {
					userId,
					srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
					OR: [{ nextReviewDate: null }, { nextReviewDate: { lte: now } }]
				},
				orderBy: [{ eloRating: 'asc' }, { nextReviewDate: 'asc' }],
				include: { grammarRule: true },
				take: 5
			}),
			prisma.userGrammarRule.findMany({
				where: {
					userId,
					srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
				},
				select: { grammarRuleId: true }
			})
		]);
		masteredGrammarDb = initialMasteredGrammarDb;

		const masteredGrammarIds = new Set(allMasteredGrammarIdsQuery.map((g) => g.grammarRuleId));

		const learningGrammarDbQuery = await prisma.userGrammarRule.findMany({
			where: {
				userId,
				srsState: { in: [SrsState.UNSEEN, SrsState.LEARNING] },
				OR: [{ nextReviewDate: null }, { nextReviewDate: { lte: now } }],
				grammarRule: { level: { in: allowedLevels }, languageId: activeLanguageId }
			},
			orderBy: [{ eloRating: 'asc' }, { nextReviewDate: 'asc' }],
			include: {
				grammarRule: {
					include: { dependencies: { select: { id: true } } }
				}
			}
		});

		let learningGrammarDb = learningGrammarDbQuery
			.filter((ug) => {
				return ug.grammarRule.dependencies.every((dep) => masteredGrammarIds.has(dep.id));
			})
			.slice(0, 1);

		// Grammar fallback logic
		if (masteredGrammarDb.length === 0 && learningGrammarDb.length === 0) {
			const potentialNewGrammars = await prisma.grammarRule.findMany({
				where: { level: { in: allowedLevels }, languageId: activeLanguageId },
				include: { dependencies: { select: { id: true } } },
				orderBy: { level: 'asc' },
				take: 20
			});
			const eligibleGrammars = potentialNewGrammars.filter((rule) =>
				rule.dependencies.every((dep) => masteredGrammarIds.has(dep.id))
			);
			if (eligibleGrammars.length > 0) {
				masteredGrammarDb = eligibleGrammars
					.slice(0, Math.min(5, eligibleGrammars.length - 1))
					.map((g) => ({ grammarRule: g }));
				if (eligibleGrammars.length > 5) {
					// @ts-expect-error type inference
					learningGrammarDb = eligibleGrammars.slice(5, 6).map((g) => ({ grammarRule: g }));
				} else if (eligibleGrammars.length > 1) {
					// @ts-expect-error type inference
					learningGrammarDb = eligibleGrammars.slice(-1).map((g) => ({ grammarRule: g }));
				}
			} else if (potentialNewGrammars.length > 0) {
				// Ultimate fallback: if nothing is eligible, just give them the first rule to ensure they have grammar to learn
				// @ts-expect-error type inference
				learningGrammarDb = [{ grammarRule: potentialNewGrammars[0] }];
			}
		}

		if (learningGrammarDb.length === 0) {
			const knownGrammarIds = await prisma.userGrammarRule.findMany({
				where: { userId },
				select: { grammarRuleId: true }
			});
			const knownIdsSet = new Set(knownGrammarIds.map((g) => g.grammarRuleId));

			const potentialNewGrammars = await prisma.grammarRule.findMany({
				where: {
					id: { notIn: Array.from(knownIdsSet) },
					level: { in: allowedLevels },
					languageId: activeLanguageId
				},
				include: { dependencies: { select: { id: true } } },
				orderBy: { level: 'asc' },
				take: 20
			});

			const eligibleGrammars = potentialNewGrammars.filter((rule) =>
				rule.dependencies.every((dep) => masteredGrammarIds.has(dep.id))
			);

			if (eligibleGrammars.length > 0) {
				// @ts-expect-error type inference
				learningGrammarDb = [{ grammarRule: eligibleGrammars[0] }];
			} else if (potentialNewGrammars.length > 0) {
				// Ultimate fallback: just give them the first rule anyway to prevent empty grammar
				// @ts-expect-error type inference
				learningGrammarDb = [{ grammarRule: potentialNewGrammars[0] }];
			}
		}

		const masteredVocab = masteredVocabDb.map((uv: any) => ({
			...uv.vocabulary,
			eloRating: uv.eloRating ?? 1000,
			srsState: uv.srsState ?? 'UNSEEN'
		}));
		const learningVocab = learningVocabDb.map((uv: any) => ({
			...uv.vocabulary,
			eloRating: uv.eloRating ?? 1000,
			srsState: uv.srsState ?? 'UNSEEN'
		}));
		const masteredGrammar = masteredGrammarDb.map((ug: any) => ug.grammarRule);
		const learningGrammar = learningGrammarDb.map((ug: any) => ug.grammarRule);

		console.log("GENERATE LESSON GRAMMAR ARRAYS:", {
			masteredGrammarDbLength: masteredGrammarDb.length,
			learningGrammarDbLength: learningGrammarDb.length,
			masteredGrammarLength: masteredGrammar.length,
			learningGrammarLength: learningGrammar.length,
		});

		// Build short ID maps for LLM (saves tokens & prevents UUID garbling)
		const idMap: Record<string, string> = {}; // short -> real UUID
		learningVocab.forEach((v, i) => {
			idMap[`v${i}`] = v.id;
		});
		const allGrammar = [...masteredGrammar, ...learningGrammar];
		allGrammar.forEach((g, i) => {
			idMap[`g${i}`] = g.id;
		});

		// Format for prompt
		const formatVocab = (v: {
			lemma: string;
			meanings: any[];
			gender?: string | null;
			plural?: string | null;
		}) =>
			`- ${v.gender ? v.gender + ' ' : ''}${v.lemma}${v.plural ? ' (pl: ' + v.plural + ')' : ''} (${v.meanings?.[0]?.value || ''})`;
		const masteredVocabList = masteredVocab
			.map((v) => formatVocab(v as unknown as Parameters<typeof formatVocab>[0]))
			.join('\n');
		const learningVocabList = learningVocab
			.map(
				(v, i) => `${formatVocab(v as unknown as Parameters<typeof formatVocab>[0])} - ID: v${i}`
			)
			.join('\n');
		const masteredGrammarList = masteredGrammar
			.map((g: { title: string; description: string; id: string }) => `- ${g.title} (${g.description}) - ID: ${Object.keys(idMap).find(k => idMap[k] === g.id)}`)
			.join('\n');
		const learningGrammarList = learningGrammar
			.map((g: { title: string; description: string; id: string }) => `- ${g.title} (${g.description}) - ID: ${Object.keys(idMap).find(k => idMap[k] === g.id)}`)
			.join('\n');

		const userLevel = locals.user.cefrLevel || 'A1';
		const isAbsoluteBeginner = userLevel === 'A1' && masteredVocabDb.length <= 5;

		const { systemPrompt, jsonSchemaObj } = buildLessonPrompt({
			activeLangName,
			userLevel,
			gameMode,
			isAbsoluteBeginner,
			assignmentTopic,
			assignmentTargetGrammar,
			masteredVocabList,
			learningVocabList,
			masteredGrammarList,
			learningGrammarList
		});

		const stream = await generateLessonStream({
			userId,
			systemPrompt,
			jsonSchemaObj,
			requestSignal: request.signal,
			targetedVocabulary: learningVocab,
			targetedGrammar: allGrammar,
			allVocabulary: [...masteredVocab, ...learningVocab],
			gameMode,
			idMap,
			userLevel,
			isAbsoluteBeginner,
			activeLangName,
			activeLanguageId,
			masteredVocab,
			learningVocab
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'application/x-ndjson',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (error) {
		console.error('Error generating lesson:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
}
