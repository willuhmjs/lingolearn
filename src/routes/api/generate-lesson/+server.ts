import { json } from '@sveltejs/kit';
import { SrsState } from '@prisma/client';
import { prisma } from '$lib/server/prisma';
import { generateLessonRateLimiter } from '$lib/server/ratelimit';
import { buildLessonPrompt, type GameMode } from '$lib/server/promptBuilder';
import { generateLessonStream } from '$lib/server/lessonLlmService';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';
import { LESSON_CONFIG } from '$lib/server/srsConfig';

export async function POST(event) {
	const { request, locals } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: { useLocalLlm: true }
	});

	if (!user?.useLocalLlm && (await generateLessonRateLimiter.isLimited(event))) {
		return json({ error: 'Too many requests. Limit is 10/min, 200/day.' }, { status: 429 });
	}

	if (!user?.useLocalLlm && (await isQuotaExceeded(locals.user.id, false))) {
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

			// Prioritize high-frequency words within each CEFR level.
			// frequency ASC = most common first; nulls last (unranked words introduced after ranked ones).
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
					orderBy: [{ cefrLevel: 'asc' }, { frequency: { sort: 'asc', nulls: 'last' } }],
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
					orderBy: [{ cefrLevel: 'asc' }, { frequency: { sort: 'asc', nulls: 'last' } }],
					take: needed - unseenVocabs.length
				});
				unseenVocabs = [...unseenVocabs, ...additionalUnseen];
			}

			const newUserVocabs = await Promise.all(
				unseenVocabs.map((vocab) =>
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

		// If still too few, include all pool items as early reviews.
		// FSRS handles this correctly: reviewing a card before its due date produces
		// a smaller stability gain than an on-time review (high retrievability →
		// less room to grow). We surface this to the metadata stream so the client
		// can inform the user and the submit-answer handler can reduce XP accordingly.
		let isEarlyReview = false;
		if (selectedLearning.length < 3) {
			selectedLearning = learningPool;
			isEarlyReview = learningPool.length > 0;
		}

		// Fetch lastErrorType and FSRS stability/lastReviewDate for retrievability scoring.
		const selectedVocabIds = selectedLearning.map((uv) => uv.vocabularyId);
		const progressRows =
			selectedVocabIds.length > 0
				? await prisma.userVocabularyProgress.findMany({
						where: { userId, vocabularyId: { in: selectedVocabIds } },
						select: { vocabularyId: true, lastErrorType: true, stability: true, lastReviewDate: true }
					})
				: [];
		const errorTypeMap = new Map(progressRows.map((r) => [r.vocabularyId, r.lastErrorType]));

		// Compute current retrievability R(t) = (1 + t/(9*S))^-1 for each item.
		// Items with lowest retrievability (most forgotten) are most urgent.
		const retrievabilityMap = new Map<string, number>();
		for (const row of progressRows) {
			if (row.stability > 0 && row.lastReviewDate) {
				const elapsedDays =
					(now.getTime() - row.lastReviewDate.getTime()) / (1000 * 60 * 60 * 24);
				const r = Math.max(0, Math.min(1, Math.pow(1 + elapsedDays / (9 * row.stability), -1)));
				retrievabilityMap.set(row.vocabularyId, r);
			} else {
				retrievabilityMap.set(row.vocabularyId, 1); // unseen/no history → treat as fully retained
			}
		}

		// Final selection: items with a recent error come first, then sorted by lowest
		// retrievability (most forgotten), then by most overdue review date as tiebreaker.
		selectedLearning.sort((a, b) => {
			const aHasError = !!errorTypeMap.get(a.vocabularyId);
			const bHasError = !!errorTypeMap.get(b.vocabularyId);
			if (aHasError !== bHasError) return aHasError ? -1 : 1;
			const aRet = retrievabilityMap.get(a.vocabularyId) ?? 1;
			const bRet = retrievabilityMap.get(b.vocabularyId) ?? 1;
			if (Math.abs(aRet - bRet) > 0.01) return aRet - bRet; // lower ret = more urgent
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
		const [masteredVocabDb, knownVocabDb, initialMasteredGrammarDb, allMasteredGrammarIdsQuery] =
			await Promise.all([
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

		// Full transitive prerequisite resolution via DFS. Fetches the full dep graph
		// for this language so we can walk chains of arbitrary depth (not just one hop).
		const allGrammarForDeps = await prisma.grammarRule.findMany({
			where: { languageId: activeLanguageId },
			select: { id: true, dependencies: { select: { id: true } } }
		});
		const depMap = new Map(allGrammarForDeps.map((g) => [g.id, g.dependencies.map((d) => d.id)]));

		// Returns the shallowest unmet prerequisite in the full dep chain, or null if all met.
		function findDeepestUnmetPrereq(ruleId: string, visited = new Set<string>()): string | null {
			if (visited.has(ruleId)) return null; // cycle guard
			visited.add(ruleId);
			for (const depId of depMap.get(ruleId) ?? []) {
				if (!masteredGrammarIds.has(depId)) {
					return findDeepestUnmetPrereq(depId, visited) ?? depId;
				}
			}
			return null;
		}

		// Collect all transitively-unmet prerequisite IDs across candidate learning rules.
		const unmetPrereqIds = new Set<string>();
		for (const ug of learningGrammarDbQuery) {
			const unmet = findDeepestUnmetPrereq(ug.grammarRule.id);
			if (unmet) unmetPrereqIds.add(unmet);
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
				// Only surface prereqs whose own full dep chain is now satisfied
				.filter((ug) => findDeepestUnmetPrereq(ug.grammarRule.id) === null)
				.slice(0, 1);
		}

		// Use prerequisite rules if available (they must be learned first), otherwise use eligible learning rules.
		let learningGrammarDb =
			prereqGrammarDb.length > 0
				? prereqGrammarDb
				: learningGrammarDbQuery
						.filter((ug) => findDeepestUnmetPrereq(ug.grammarRule.id) === null)
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
				findDeepestUnmetPrereq(rule.id) === null
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
				findDeepestUnmetPrereq(rule.id) === null
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

		// Interleaved review: pull a small number of due MASTERED items and inject them
		// as active targets alongside learning vocabulary. Mixed practice (Kornell & Bjork
		// 2008) improves long-term retention over blocked (same-state-only) practice.
		// These items are due by their FSRS nextReviewDate so reviewing them now is on-time.
		// We take from masteredVocabDb (already filtered to lte:now above) rather than
		// adding a new DB query. Shuffle for variety, then cap at the configured count.
		const interleavedVocabDb = [...masteredVocabDb]
			.filter((uv: any) => !EXCLUDED_POS.has(uv.vocabulary?.partOfSpeech))
			.sort(() => Math.random() - 0.5)
			.slice(0, LESSON_CONFIG.INTERLEAVE_MASTERED_COUNT);
		const interleavedVocab = interleavedVocabDb.map((uv: any) => ({
			...uv.vocabulary,
			eloRating: uv.eloRating ?? 1000,
			srsState: 'MASTERED' as const
		}));
		// Remove interleaved items from the background mastered list so they aren't
		// listed twice in the prompt (they'll appear in the learning section instead).
		const interleavedIds = new Set(interleavedVocab.map((v: any) => v.id));
		const masteredVocabBackground = masteredVocab.filter((v: any) => !interleavedIds.has(v.id));

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
			select: { id: true, title: true, description: true, level: true }
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
		const knownOffset = learnOffset + knownVocab.length;
		interleavedVocab.forEach((v: any, i: number) => {
			idMap[`v${knownOffset + i}`] = v.id;
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
		// Background mastered list excludes interleaved items (they appear in the learning section)
		const masteredVocabList = masteredVocabBackground
			.map((v) => formatVocab(v as unknown as Parameters<typeof formatVocab>[0]))
			.join('\n');
		// Interleaved mastered items are added to the learning list tagged [review] so the LLM
		// knows these are reinforcement targets that must be used, not just background context.
		const interleavedVocabLines = interleavedVocab
			.map(
				(v: any, i: number) =>
					`${formatVocab(v as unknown as Parameters<typeof formatVocab>[0])} - ID: v${knownOffset + i} [review]`
			)
			.join('\n');
		const learningVocabList = [
			...learningVocab.map(
				(v, i) => `${formatVocab(v as unknown as Parameters<typeof formatVocab>[0])} - ID: v${i}`
			),
			...(interleavedVocabLines ? [interleavedVocabLines] : [])
		].join('\n');
		const knownVocabList = knownVocab
			.map(
				(v, i) =>
					`${formatVocab(v as unknown as Parameters<typeof formatVocab>[0])} - ID: v${learnOffset + i}`
			)
			.join('\n');
		const masteredGrammarList = masteredGrammar
			.map(
				(g: { title: string; description: string; id: string }) =>
					`- ${g.title} (${g.description}) - ID: ${Object.keys(idMap).find((k) => idMap[k] === g.id)}`
			)
			.join('\n');
		const learningGrammarList = learningGrammar
			.map(
				(g: { title: string; description: string; id: string }) =>
					`- ${g.title} (${g.description}) - ID: ${Object.keys(idMap).find((k) => idMap[k] === g.id)}`
			)
			.join('\n');
		// Grammar rules the LLM can identify if used implicitly (excludes mastered/learning to avoid duplication).
		// Capped at 25 — enough coverage for identification without bloating the prompt.
		const trackedGrammarIds = new Set(
			[...masteredGrammar, ...learningGrammar].map((g: any) => g.id)
		);
		const additionalGrammarList = allLanguageGrammarDb
			.filter((g) => !trackedGrammarIds.has(g.id))
			.slice(0, 25)
			.map(
				(g) =>
					`- ${g.title} (${g.description}) - ID: ${Object.keys(idMap).find((k) => idMap[k] === g.id)}`
			)
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
			targetedVocabulary: [...learningVocab, ...knownVocab, ...interleavedVocab],
			targetedGrammar: allLanguageGrammarDb, // full list so client filter can resolve any returned ID
			allVocabulary: [
				...masteredVocabBackground,
				...learningVocab,
				...knownVocab,
				...interleavedVocab
			],
			gameMode,
			idMap,
			userLevel,
			isAbsoluteBeginner,
			isEarlyReview,
			activeLangName,
			activeLanguageId,
			masteredVocab: masteredVocabBackground,
			learningVocab,
			useLocalLlm: user?.useLocalLlm ?? false,
			onUsage: user?.useLocalLlm
				? undefined
				: ({ totalTokens }) => {
						recordTokenUsage(userId, totalTokens);
					}
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
