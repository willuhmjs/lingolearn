import { json } from '@sveltejs/kit';
import { SrsState } from '@prisma/client';
import { prisma } from '$lib/server/prisma';
import { generateLessonRateLimiter } from '$lib/server/ratelimit';
import { buildLessonPrompt, type GameMode } from '$lib/server/promptBuilder';
import { generateLessonStream } from '$lib/server/lessonLlmService';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';
import { LESSON_CONFIG } from '$lib/server/srsConfig';
import { CefrService } from '$lib/server/cefrService';

export async function POST(event) {
	const { request, locals } = event;
	
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: { useLocalLlm: true }
	});

	if (!user?.useLocalLlm && await generateLessonRateLimiter.isLimited(event)) {
		return json({ error: 'Too many requests. Limit is 10/min, 200/day.' }, { status: 429 });
	}

	if (!user?.useLocalLlm && await isQuotaExceeded(locals.user.id, false)) {
		return json({ error: 'Daily AI quota exceeded. Please try again tomorrow.' }, { status: 429 });
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

		// 2. If pool < minimum, replenish to max (subject to per-day new-word cap)
		if (learningPool.length < LESSON_CONFIG.LEARNING_POOL_MIN) {
			// Count how many new words were already introduced today to enforce the daily cap.
			const startOfDay = new Date(now);
			startOfDay.setHours(0, 0, 0, 0);
			const newWordsToday = await prisma.userVocabulary.count({
				where: {
					userId,
					createdAt: { gte: startOfDay },
					srsState: SrsState.LEARNING
				}
			});
			const dailyHeadroom = Math.max(0, LESSON_CONFIG.NEW_WORDS_PER_DAY_CAP - newWordsToday);
			const needed = Math.min(LESSON_CONFIG.LEARNING_POOL_MAX - learningPool.length, dailyHeadroom);

			const knownVocabIds = await prisma.userVocabulary.findMany({
				where: { userId },
				select: { vocabularyId: true }
			});
			const knownIdsArray = knownVocabIds.map((v) => v.vocabularyId);

			// Try to find level-appropriate words, prioritizing beginner words first if at A1.
			// Order by cefrLevel ASC so foundational words are introduced before harder ones.
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
					orderBy: { cefrLevel: 'asc' },
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
					orderBy: { cefrLevel: 'asc' },
					take: needed - unseenVocabs.length
				});
				unseenVocabs = [...unseenVocabs, ...additionalUnseen];
			}

			const newUserVocabs = await Promise.all(
				unseenVocabs.map(vocab =>
					prisma.userVocabulary.create({
						data: {
							userId,
							vocabularyId: vocab.id,
							srsState: SrsState.LEARNING,
							eloRating: 1000,
							nextReviewDate: now // Make it due immediately
						},
						include: { vocabulary: { include: { meanings: true } } }
					})
				)
			);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			for (const uv of newUserVocabs) learningPool.push(uv as any);
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

		// Final selection for the lesson — most overdue items first (lowest nextReviewDate),
		// then apply a Fisher-Yates shuffle within the top candidates so lessons feel varied.
		selectedLearning.sort((a, b) => {
			const aTime = a.nextReviewDate ? a.nextReviewDate.getTime() : 0;
			const bTime = b.nextReviewDate ? b.nextReviewDate.getTime() : 0;
			return aTime - bTime;
		});
		const topCandidates = selectedLearning.slice(0, LESSON_CONFIG.LESSON_VOCAB_MAX * 2);
		for (let i = topCandidates.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[topCandidates[i], topCandidates[j]] = [topCandidates[j], topCandidates[i]];
		}
		const learningVocabDb = topCandidates.slice(0, LESSON_CONFIG.LESSON_VOCAB_MAX);

		// 4. Fetch Mastered Vocabulary and Grammar
		let masteredGrammarDb: any[];
		const [masteredVocabDb, knownVocabDb, initialMasteredGrammarDb, allMasteredGrammarIdsQuery] = await Promise.all([
			prisma.userVocabulary.findMany({
				where: {
					userId,
					srsState: SrsState.MASTERED,
					OR: [{ nextReviewDate: null }, { nextReviewDate: { lte: now } }],
					vocabulary: { meanings: { some: {} }, languageId: activeLanguageId } as any
				},
				include: { vocabulary: { include: { meanings: true } } },
				take: 20
			}),
			prisma.userVocabulary.findMany({
				where: {
					userId,
					srsState: SrsState.KNOWN,
					OR: [{ nextReviewDate: null }, { nextReviewDate: { lte: nearDue } }],
					vocabulary: { meanings: { some: {} }, languageId: activeLanguageId } as any
				},
				include: { vocabulary: { include: { meanings: true } } },
				orderBy: { nextReviewDate: 'asc' },
				take: 3
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

		// Separate rules with all prerequisites met from those with unmet prerequisites.
		// For rules with unmet prerequisites, collect those prerequisite rule IDs to surface them.
		const unmetPrereqIds = new Set<string>();
		for (const ug of learningGrammarDbQuery) {
			const unmet = ug.grammarRule.dependencies.filter((dep) => !masteredGrammarIds.has(dep.id));
			for (const dep of unmet) {
				unmetPrereqIds.add(dep.id);
			}
		}

		// If there are unmet prerequisites, find their UserGrammarRule records (or UNSEEN GrammarRules)
		// and prioritize them — they are foundational rules the user needs first.
		let prereqGrammarDb: any[] = [];
		if (unmetPrereqIds.size > 0) {
			const prereqUserRules = await prisma.userGrammarRule.findMany({
				where: {
					userId,
					grammarRuleId: { in: Array.from(unmetPrereqIds) },
					srsState: { in: [SrsState.UNSEEN, SrsState.LEARNING] }
				},
				orderBy: [{ eloRating: 'asc' }],
				include: {
					grammarRule: {
						include: { dependencies: { select: { id: true } } }
					}
				}
			});

			// Also pick up prerequisite rules the user has never encountered (no UserGrammarRule row yet)
			const seenPrereqIds = new Set(prereqUserRules.map((r) => r.grammarRuleId));
			const unseenPrereqIds = Array.from(unmetPrereqIds).filter((id) => !seenPrereqIds.has(id));
			let unseenPrereqRules: any[] = [];
			if (unseenPrereqIds.length > 0) {
				const rawRules = await prisma.grammarRule.findMany({
					where: { id: { in: unseenPrereqIds } },
					include: { dependencies: { select: { id: true } } }
				});
				unseenPrereqRules = rawRules.map((g) => ({ grammarRule: g }));
			}

			prereqGrammarDb = [...prereqUserRules, ...unseenPrereqRules]
				// Only include prereqs whose own prerequisites are mastered (no multi-hop skipping)
				.filter((ug) => ug.grammarRule.dependencies.every((dep: any) => masteredGrammarIds.has(dep.id)))
				.slice(0, 1);
		}

		// Use prerequisite rules if available (they must be learned first), otherwise use eligible learning rules.
		let learningGrammarDb = prereqGrammarDb.length > 0
			? prereqGrammarDb
			: learningGrammarDbQuery
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
					learningGrammarDb = eligibleGrammars.slice(5, 6).map((g) => ({ grammarRule: g }));
				} else if (eligibleGrammars.length > 1) {
					learningGrammarDb = eligibleGrammars.slice(-1).map((g) => ({ grammarRule: g }));
				}
			} else if (potentialNewGrammars.length > 0) {
				// Ultimate fallback: if nothing is eligible, just give them the first rule to ensure they have grammar to learn
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
				learningGrammarDb = [{ grammarRule: eligibleGrammars[0] }];
			} else if (potentialNewGrammars.length > 0) {
				// Ultimate fallback: just give them the first rule anyway to prevent empty grammar
				learningGrammarDb = [{ grammarRule: potentialNewGrammars[0] }];
			}
		}

		// Filter out articles from targeted vocabulary — they are function words
		// taught via grammar rules (e.g. "Accusative Case") and cause nonsensical
		// sentences when the LLM is forced to "use" them as standalone vocab
		// (e.g. "Den der Apfel esse ich." with double articles).
		const EXCLUDED_POS = new Set(['article']);

		const masteredVocab = masteredVocabDb
			.filter((uv: any) => !EXCLUDED_POS.has(uv.vocabulary?.partOfSpeech))
			.map((uv: any) => ({
				...uv.vocabulary,
				eloRating: uv.eloRating ?? 1000,
				srsState: uv.srsState ?? 'UNSEEN'
			}));
		const learningVocab = learningVocabDb
			.filter((uv: any) => !EXCLUDED_POS.has(uv.vocabulary?.partOfSpeech))
			.map((uv: any) => ({
				...uv.vocabulary,
				eloRating: uv.eloRating ?? 1000,
				srsState: uv.srsState ?? 'UNSEEN'
			}));
		const knownVocab = knownVocabDb
			.filter((uv: any) => !EXCLUDED_POS.has(uv.vocabulary?.partOfSpeech))
			.map((uv: any) => ({
				...uv.vocabulary,
				eloRating: uv.eloRating ?? 1000,
				srsState: uv.srsState ?? 'KNOWN'
			}));
		const masteredGrammar = masteredGrammarDb.map((ug: any) => ug.grammarRule);
		const learningGrammar = learningGrammarDb.map((ug: any) => ug.grammarRule);

		// Fetch ALL grammar rules for the language at the user's level so the LLM
		// can identify grammar concepts used in the sentence even if the user hasn't
		// encountered them yet (e.g. Akkusativ, Dativ used implicitly in sentences).
		const allLanguageGrammarDb = await prisma.grammarRule.findMany({
			where: { languageId: activeLanguageId, level: { in: allowedLevels } },
			select: { id: true, title: true, description: true, guide: true, level: true }
		});

		// Build short ID maps for LLM (saves tokens & prevents UUID garbling)
		const idMap: Record<string, string> = {}; // short -> real UUID
		learningVocab.forEach((v, i) => {
			idMap[`v${i}`] = v.id;
		});
		const learnOffset = learningVocab.length;
		knownVocab.forEach((v, i) => {
			idMap[`v${learnOffset + i}`] = v.id;
		});
		// Use allLanguageGrammarDb for the idMap so all grammar rules get short IDs
		allLanguageGrammarDb.forEach((g, i) => {
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
		const knownVocabList = knownVocab
			.map(
				(v, i) => `${formatVocab(v as unknown as Parameters<typeof formatVocab>[0])} - ID: v${learnOffset + i}`
			)
			.join('\n');
		const masteredGrammarList = masteredGrammar
			.map((g: { title: string; description: string; id: string }) => `- ${g.title} (${g.description}) - ID: ${Object.keys(idMap).find(k => idMap[k] === g.id)}`)
			.join('\n');
		const learningGrammarList = learningGrammar
			.map((g: { title: string; description: string; id: string }) => `- ${g.title} (${g.description}) - ID: ${Object.keys(idMap).find(k => idMap[k] === g.id)}`)
			.join('\n');
		// All grammar rules the LLM can identify (excludes ones already in mastered/learning to avoid duplication)
		const trackedGrammarIds = new Set([...masteredGrammar, ...learningGrammar].map((g: any) => g.id));
		const additionalGrammarList = allLanguageGrammarDb
			.filter(g => !trackedGrammarIds.has(g.id))
			.map(g => `- ${g.title} (${g.description}) - ID: ${Object.keys(idMap).find(k => idMap[k] === g.id)}`)
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
			knownVocabList,
			masteredGrammarList,
			learningGrammarList,
			additionalGrammarList
		});

		const stream = await generateLessonStream({
			userId,
			systemPrompt,
			jsonSchemaObj,
			requestSignal: request.signal,
			targetedVocabulary: [...learningVocab, ...knownVocab],
			targetedGrammar: allLanguageGrammarDb, // full list so client filter can resolve any returned ID
			allVocabulary: [...masteredVocab, ...learningVocab, ...knownVocab],
			gameMode,
			idMap,
			userLevel,
			isAbsoluteBeginner,
			activeLangName,
			activeLanguageId,
			masteredVocab,
			learningVocab,
			useLocalLlm: user?.useLocalLlm ?? false,
			onUsage: user?.useLocalLlm ? undefined : ({ totalTokens }) => {
				recordTokenUsage(userId, totalTokens);
			}
		});

		// Fire-and-forget ELO decay — runs in background, never blocks the response.
		CefrService.applyEloDecay(userId, activeLanguageId).catch(err =>
			console.error('[ELO Decay] Background decay failed:', err)
		);

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
