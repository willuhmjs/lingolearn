import { json } from '@sveltejs/kit';
import { SrsState } from '@prisma/client';
import { prisma } from '$lib/server/prisma';
import { generateLessonRateLimiter } from '$lib/server/ratelimit';
import { buildLessonPrompt, type GameMode } from '$lib/server/promptBuilder';
import { generateLessonStream } from '$lib/server/lessonLlmService';

export async function POST(event) {
	const { request, locals } = event;
	if (await generateLessonRateLimiter.isLimited(event)) {
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

		// Target a larger pool (10-15 words) so the LLM has choices for thematic coherence
		const targetLearningCount = Math.min(15, Math.max(10, 5 + userLevelIndex * 2));

		const now = new Date();

		// 1 & 2 & 3. Fetch Mastered and Learning Vocabulary and Grammar concurrently
		// Fetch a larger pool, then we will shuffle and select a subset
		let [masteredVocabDb, learningVocabDb, masteredGrammarDb, allMasteredGrammarIdsQuery] =
			await Promise.all([
				prisma.userVocabulary.findMany({
					where: {
						userId,
						srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
						OR: [{ nextReviewDate: null }, { nextReviewDate: { lte: now } }],
						vocabulary: { meanings: { some: {} }, languageId: activeLanguageId } as any
					},
					include: { vocabulary: { include: { meanings: true } } },
					take: 100
				}),
				prisma.userVocabulary.findMany({
					where: {
						userId,
						srsState: { in: [SrsState.UNSEEN, SrsState.LEARNING] },
						OR: [{ nextReviewDate: null }, { nextReviewDate: { lte: now } }],
						vocabulary: { meanings: { some: {} }, languageId: activeLanguageId } as any
					},
					include: { vocabulary: { include: { meanings: true } } },
					take: 100
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

		// Shuffle and take a random subset of words for the prompt to ensure diversity
		masteredVocabDb = masteredVocabDb.sort(() => 0.5 - Math.random()).slice(0, 10);
		learningVocabDb = learningVocabDb.sort(() => 0.5 - Math.random()).slice(0, targetLearningCount);

		// Always try to inject 1-2 new random words to keep the user learning
		const knownVocabIds = await prisma.userVocabulary.findMany({
			where: { userId },
			select: { vocabularyId: true }
		});

		const knownIdsArray = knownVocabIds.map((v) => v.vocabularyId);

		// To get random unseen words, we can't easily order by random in standard Prisma findMany without fetching all.
		// A fast approximation is getting a random offset using count.
		const unseenCount = await prisma.vocabulary.count({
			where: { id: { notIn: knownIdsArray }, meanings: { some: {} }, languageId: activeLanguageId } as any
		});

		if (unseenCount > 0 && learningVocabDb.length < targetLearningCount) {
			const needed = targetLearningCount - learningVocabDb.length;
			const randomSkip = Math.max(0, Math.floor(Math.random() * unseenCount) - needed);
			const unseenVocabs = await prisma.vocabulary.findMany({
				where: {
					id: { notIn: knownIdsArray },
					meanings: { some: {} },
					languageId: activeLanguageId
				},
				skip: randomSkip,
				take: needed
			});

			// Push these directly into learning list so they get taught
			for (const uv of unseenVocabs) {
				// @ts-expect-error type inference
				learningVocabDb.push({ vocabulary: uv });
			}
		}

		// Fallback for new users: if no UserVocabulary exists, pick random Vocabulary
		if (masteredVocabDb.length === 0 && learningVocabDb.length === 0) {
			const allVocabs = await prisma.vocabulary.findMany({
				where: { meanings: { some: {} }, languageId: activeLanguageId } as any,
				take: 22
			});
			// @ts-expect-error type inference
			masteredVocabDb = allVocabs.slice(0, 20).map((v) => ({ vocabulary: v }));
			// @ts-expect-error type inference
			learningVocabDb = allVocabs.slice(20, 22).map((v) => ({ vocabulary: v }));
		}

		// If we still have no learning vocabulary, pick some unseen ones from the global list
		if (learningVocabDb.length === 0) {
			const unseenVocabs = await prisma.vocabulary.findMany({
				where: {
					id: { notIn: knownVocabIds.map((v) => v.vocabularyId) },
					meanings: { some: {} },
					languageId: activeLanguageId
				},
				take: 2
			});
			// @ts-expect-error type inference
			learningVocabDb = unseenVocabs.map((v) => ({ vocabulary: v }));
		}

		// 3. Same for Grammar
		if (masteredGrammarDb.length === 0 && learningGrammarDb.length === 0) {
			const potentialNewGrammars = await prisma.grammarRule.findMany({
				where: { level: { in: allowedLevels }, languageId: activeLanguageId },
				include: { dependencies: { select: { id: true } } },
				take: 20
			});
			const eligibleGrammars = potentialNewGrammars.filter((rule) =>
				rule.dependencies.every((dep) => masteredGrammarIds.has(dep.id))
			);
			if (eligibleGrammars.length > 0) {
				// @ts-expect-error type inference
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
			}
		}

		// If we still have no learning grammar, pick some unseen ones from the global list
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
				take: 20
			});

			const eligibleGrammars = potentialNewGrammars.filter((rule) =>
				rule.dependencies.every((dep) => masteredGrammarIds.has(dep.id))
			);

			if (eligibleGrammars.length > 0) {
				// @ts-expect-error type inference
				learningGrammarDb = [{ grammarRule: eligibleGrammars[0] }];
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
		const masteredGrammar = masteredGrammarDb.map((ug) => ug.grammarRule);
		const learningGrammar = learningGrammarDb.map((ug) => ug.grammarRule);

		// Build short ID maps for LLM (saves tokens & prevents UUID garbling)
		const idMap: Record<string, string> = {}; // short -> real UUID
		learningVocab.forEach((v, i) => {
			idMap[`v${i}`] = v.id;
		});
		learningGrammar.forEach((g, i) => {
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
			.map((g) => `- ${g.title} (${g.description})`)
			.join('\n');
		const learningGrammarList = learningGrammar
			.map((g, i) => `- ${g.title} (${g.description}) - ID: g${i}`)
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
			targetedGrammar: learningGrammar,
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
