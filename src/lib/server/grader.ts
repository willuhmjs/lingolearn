import { prisma } from './prisma';
import { ELO_CONFIG, CEFR_CONFIG } from './srsConfig';
import { reviewCard, scoreToRating, deriveSrsStateFromFsrs, DEFAULT_FSRS_PARAMETERS } from './fsrs';
import type { FsrsCard } from './fsrs';
import type {
	Vocabulary as PrismaVocabulary,
	UserVocabulary as PrismaUserVocabulary,
	UserVocabularyProgress as PrismaUserVocabularyProgress,
	GrammarRule as PrismaGrammarRule,
	UserGrammarRule as PrismaUserGrammarRule,
	UserGrammarRuleProgress as PrismaUserGrammarRuleProgress
} from '@prisma/client';

type Vocabulary = {
	id: string;
	lemma: string;
	meanings?: any[];
	partOfSpeech: string | null;
	gender: 'der' | 'die' | 'das' | null;
	plural: string | null;
	metadata: import('@prisma/client').Prisma.JsonValue | null;
	cefrLevel: string;
	isBeginner: boolean;
	createdAt: Date;
	updatedAt: Date;
};
type GrammarRule = {
	id: string;
	title: string;
	description: string | null;
	level: string;
	createdAt: Date;
	updatedAt: Date;
};

export type GameMode = 'native-to-target' | 'target-to-native' | 'fill-blank' | 'multiple-choice';

// Structured error categories reported per item by the LLM grader.
// Used to power targeted remediation in the lesson generator.
export type ErrorType =
	| 'wrong_case'       // wrong grammatical case (Akkusativ, Dativ, etc.)
	| 'wrong_tense'      // wrong verb tense or aspect
	| 'wrong_gender'     // wrong article gender (der/die/das)
	| 'spelling'         // misspelling not covered by ASCII equivalence
	| 'word_order'       // incorrect sentence word order
	| 'vocabulary_gap';  // wrong or missing word — meaning not conveyed

export interface EvaluationPayload {
	globalScore: number;
	vocabularyUpdates: { id: string; score: number; errorType?: ErrorType | null; eloBefore?: number; eloAfter?: number }[];
	grammarUpdates: { id: string; score: number; errorType?: ErrorType | null; eloBefore?: number; eloAfter?: number }[];
	extraVocabLemmas?: string[];
	feedback: string;
}

const normalizeText = (text: string) => {
	return text
		.replace(/ß/g, 'ss')
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/Ä/g, 'Ae')
		.replace(/Ö/g, 'Oe')
		.replace(/Ü/g, 'Ue');
};

/**
 * Builds the system prompt and user message for evaluation, without calling the LLM.
 * Used by the streaming submit-answer endpoint.
 */
export function buildEvaluationPrompt(
	userInput: string,
	targetSentence: string,
	targetedVocabulary: Vocabulary[],
	targetedGrammar: GrammarRule[],
	gameMode: GameMode = 'native-to-target',
	userLevel: string = 'A1',
	activeLanguageName: string,
	nativeLanguage: string = 'English'
): { systemPrompt: string; userMessage: string; idMap: Record<string, string> } {
	// Build short ID maps so the LLM sees tiny tokens like "v0" instead of full UUIDs
	const idMap: Record<string, string> = {}; // short -> real
	targetedVocabulary.forEach((v, i) => {
		idMap[`v${i}`] = v.id;
	});
	targetedGrammar.forEach((g, i) => {
		idMap[`g${i}`] = g.id;
	});

	const vocabList = targetedVocabulary.map((v, i) => {
		const meanings = (v.meanings as { value: string }[] | undefined)
			?.map((m) => m.value)
			.filter(Boolean)
			.join(' / ');
		return `- ${v.lemma} (ID: v${i})${meanings ? ` — accepted meanings: ${meanings}` : ''}`;
	}).join('\n');
	const grammarList = targetedGrammar.map((g, i) => `- ${g.title} (ID: g${i})`).join('\n');

	const isAbsoluteBeginner = userLevel === 'A1';
	const beginnerNote = isAbsoluteBeginner
		? `\nBEGINNER (A1): Be extra encouraging. Celebrate correct parts before errors. Give partial credit (≥0.3) for genuine attempts. Build confidence.\n`
		: '';

	// Shared rules injected into every grader prompt
	const sharedRules = `
SCORING RULES (apply to all modes):
- Output ONLY valid JSON. "feedback" MUST be the first key.
- Score each vocab/grammar item INDEPENDENTLY (0.0–1.0). Do not penalize one item for errors in another.
- ASCII special-character equivalents are fully correct (ss=ß, ae=ä, oe=ö, ue=ü, Ae=Ä, Oe=Ö, Ue=Ü) — score 1.0.
- Capitalization-only errors: score ≥0.8, never 0.
- Consistency: if globalScore ≥0.8, no correctly-attempted item should score below 0.5.
- ACCEPTED MEANINGS: accept ANY meaning listed on the student's flashcard as fully correct (score 1.0), even if a different synonym appears in the target sentence.
- If the user asks for help or makes no real attempt (e.g. "?", "I don't know"), globalScore MUST be 0.0 — beginner encouragement does NOT apply.
- errorType: set to the best-fit category if score < 0.8, else null. Categories: wrong_case | wrong_tense | wrong_gender | spelling | word_order | vocabulary_gap`;

	const jsonFormat = `
{
  "feedback": "<${nativeLanguage} feedback>",
  "globalScore": <0.0–1.0>,
  "vocabularyUpdates": [{"id": "<vocab ID>", "score": <0.0–1.0>, "errorType": "<category|null>"}],
  "grammarUpdates": [{"id": "<grammar ID>", "score": <0.0–1.0>, "errorType": "<category|null>"}],
  "extraVocabLemmas": ["<${activeLanguageName} lemma>"]
}`;

	const listsBlock = `
Targeted Vocabulary:
${vocabList}

Targeted Grammar Rules:
${grammarList}`;

	if (gameMode === 'fill-blank') {
		const systemPrompt = `You are an expert language tutor grading a fill-in-the-blank exercise. Output ONLY valid JSON.
${beginnerNote}${sharedRules}

Task: The student filled blanks in a ${activeLanguageName} sentence. Compare their answers to the complete sentence. Score each blank independently. Provide concise ${nativeLanguage} feedback. List any incidental correct ${activeLanguageName} words (not in targets) in extraVocabLemmas.
${listsBlock}

JSON format:${jsonFormat}`;

		const userMessage = `Complete sentence: ${normalizeText(targetSentence)}\nStudent's answers: ${normalizeText(userInput)}`;
		return { systemPrompt, userMessage, idMap };
	}

	if (gameMode === 'multiple-choice') {
		const systemPrompt = `You are an expert language tutor grading a multiple-choice translation question. Output ONLY valid JSON.
${beginnerNote}${sharedRules}

Task: The student chose a ${nativeLanguage} translation for a ${activeLanguageName} sentence. Score 1.0 if correct, 0.0 if wrong. Explain briefly why the correct answer is right. List any incidental correct ${activeLanguageName} words in extraVocabLemmas.
${listsBlock}

JSON format:${jsonFormat}`;

		const userMessage = `Correct answer: ${targetSentence}\nStudent's choice: ${userInput}`;
		return { systemPrompt, userMessage, idMap };
	}

	// Translation modes (native-to-target, target-to-native)
	const isNativeToTarget = gameMode === 'native-to-target';

	const modeNotes = isNativeToTarget
		? `- The student is writing in ${activeLanguageName}. Accept ASCII equivalents as correct.
- If they provide a ${nativeLanguage} translation instead of attempting, score 0.0 and give the correct answer in feedback.
- extraVocabLemmas: list other ${activeLanguageName} words used correctly (not in targets).`
		: `- The student is translating INTO ${nativeLanguage}. They will not write ${activeLanguageName} words — check whether each targeted word's meaning is correctly conveyed.
- Accept all equivalent ${nativeLanguage} verb forms when ${activeLanguageName} does not distinguish them (e.g. "I come" / "I am coming" / "I do come" are all correct for a single ${activeLanguageName} present tense).
- Score grammar rules based on whether the translation reflects understanding of the rule (e.g. past tense → did they translate into past tense?).
- extraVocabLemmas: list other ${activeLanguageName} words whose meaning the student correctly translated. Output ${activeLanguageName} lemmas only, not ${nativeLanguage} words.`;

	const systemPrompt = `You are an expert language tutor grading a translation exercise. Output ONLY valid JSON.
${beginnerNote}${sharedRules}

Task: Evaluate the student's translation against the expected output. Be forgiving of minor typos and word-order issues that don't change meaning. Score each vocab and grammar item independently. Provide concise, helpful ${nativeLanguage} feedback.
${modeNotes}
${listsBlock}

JSON format:${jsonFormat}`;

	const normalizedTarget = isNativeToTarget ? normalizeText(targetSentence) : targetSentence;
	const normalizedInput = isNativeToTarget ? normalizeText(userInput) : userInput;

	const userMessage = `Expected output: ${normalizedTarget}\nStudent input: ${normalizedInput}`;
	return { systemPrompt, userMessage, idMap };
}

/**
 * Parses raw LLM content into a typed EvaluationPayload.
 */
export function parseEvaluationResponse(content: string): EvaluationPayload {
	const cleanedContent = content
		.replace(/^```json\s*/i, '')
		.replace(/```\s*$/i, '')
		.trim();
		
	let payload;
	try {
		payload = JSON.parse(cleanedContent);
	} catch (e) {
		// Attempt to recover truncated JSON from streaming
		try {
			payload = JSON.parse(cleanedContent + '}');
		} catch (e2) {
			try {
				payload = JSON.parse(cleanedContent + '"}');
			} catch (e3) {
				try {
					payload = JSON.parse(cleanedContent + '"]]}');
				} catch (e4) {
					throw e; // throw original error if recovery fails
				}
			}
		}
	}

	const VALID_ERROR_TYPES = new Set(['wrong_case', 'wrong_tense', 'wrong_gender', 'spelling', 'word_order', 'vocabulary_gap']);

	// Ensure backwards compatibility if LLM returns "success" (boolean) instead of "score"
	const mapItem = (item: { id: string; score?: number; success?: boolean; errorType?: string | null }) => ({
		id: item.id,
		score: typeof item.score === 'number' ? item.score : item.success ? 1.0 : 0.0,
		errorType: (item.errorType && VALID_ERROR_TYPES.has(item.errorType) ? item.errorType : null) as ErrorType | null
	});

	const result: EvaluationPayload = {
		globalScore: payload.globalScore ?? 0,
		vocabularyUpdates: (payload.vocabularyUpdates || []).map(mapItem),
		grammarUpdates: (payload.grammarUpdates || []).map(mapItem),
		extraVocabLemmas: (payload.extraVocabLemmas || []).map((l: string) =>
			l.replace(/^[.,!?;:'"()[\]{}-]+|[.,!?;:'"()[\]{}-]+$/g, '')
		),
		feedback: payload.feedback || ''
	};

	// Reconcile contradictory scores: if globalScore is high but individual items
	// are scored at 0, the LLM is being inconsistent. Bump low scores to at least
	// match the global signal (e.g. capitalize-only errors scored at 0 despite 95% global).
	if (result.globalScore >= 0.8) {
		const minItemScore = 0.5;
		result.vocabularyUpdates = result.vocabularyUpdates.map((u) => {
			const wasBumped = u.score < minItemScore;
			return {
				...u,
				score: Math.max(u.score, minItemScore),
				// Only clear errorType when the score was actually bumped from below the
				// minimum — a bumped-up score means the LLM was inconsistently harsh,
				// so the error tag is a false positive. If the score was already ≥ 0.5
				// the errorType was set deliberately and must be preserved.
				errorType: wasBumped ? null : u.errorType
			};
		});
		result.grammarUpdates = result.grammarUpdates.map((u) => {
			const wasBumped = u.score < minItemScore;
			return {
				...u,
				score: Math.max(u.score, minItemScore),
				errorType: wasBumped ? null : u.errorType
			};
		});
	}

	return result;
}

export function mapLevelToElo(level: string): number {
	return CEFR_CONFIG.BASE_ELO[level.toUpperCase() as keyof typeof CEFR_CONFIG.BASE_ELO] || CEFR_CONFIG.BASE_ELO.A1;
}

function calculateNewElo(
	currentElo: number,
	score: number,
	baseDifficulty: number,
	gameMode: string,
	repetitions: number = 0
): number {
	const expectedScore = 1 / (1 + Math.pow(10, (baseDifficulty - currentElo) / 400));

	let kMultiplier = 1.0;
	// Use configured K-factor multipliers by game mode
	if (gameMode === 'multiple-choice') kMultiplier = ELO_CONFIG.K_MULTIPLIERS.MULTIPLE_CHOICE;
	else if (gameMode === 'target-to-native') kMultiplier = ELO_CONFIG.K_MULTIPLIERS.TARGET_TO_NATIVE;
	else if (gameMode === 'native-to-target') kMultiplier = ELO_CONFIG.K_MULTIPLIERS.NATIVE_TO_TARGET;
	else if (gameMode === 'fill-blank') kMultiplier = ELO_CONFIG.K_MULTIPLIERS.FILL_BLANK;

	// Decay K-factor as the user accumulates repetitions on this item, keeping
	// new learners highly responsive while stabilising experienced users.
	const decayedK = Math.max(ELO_CONFIG.K_MIN, ELO_CONFIG.K_FACTOR - repetitions * ELO_CONFIG.K_DECAY_PER_REP);
	const effectiveK = decayedK * kMultiplier;
	return currentElo + effectiveK * (score - expectedScore);
}

/**
 * Runs FSRS review on a card loaded from the DB progress record.
 * Returns updated FSRS fields and the next review date.
 */
function computeFsrsUpdate(score: number, current: {
	difficulty: number;
	stability: number;
	retrievability: number;
	repetitions: number;
	lapses: number;
	lastReviewDate: Date | null;
}, requestRetention: number = DEFAULT_FSRS_PARAMETERS.requestRetention) {
	const card: FsrsCard = {
		difficulty: current.difficulty,
		stability: current.stability,
		retrievability: current.retrievability,
		repetitions: current.repetitions,
		lapses: current.lapses,
		lastReviewDate: current.lastReviewDate ?? undefined
	};

	const params = { ...DEFAULT_FSRS_PARAMETERS, requestRetention };
	const rating = scoreToRating(score);
	const result = reviewCard(card, rating, new Date(), params);

	return {
		difficulty: result.card.difficulty,
		stability: result.card.stability,
		retrievability: result.card.retrievability ?? 1,
		repetitions: result.card.repetitions,
		lapses: result.card.lapses,
		lastReviewDate: new Date(),
		nextReviewDate: result.nextReviewDate
	};
}

export async function updateSrsMetrics(
	userId: string,
	itemId: string,
	score: number,
	type: 'vocabulary' | 'grammar' = 'vocabulary',
	overridden = false
) {
	// Fetch user's FSRS retention preference once
	const userRetention = await prisma.user.findUnique({
		where: { id: userId },
		select: { fsrsRetention: true }
	}).then(u => u?.fsrsRetention ?? DEFAULT_FSRS_PARAMETERS.requestRetention);

	if (type === 'grammar') {
		const currentProgress = await prisma.userGrammarRuleProgress.findUnique({
			where: { userId_grammarRuleId: { userId, grammarRuleId: itemId } }
		});

		const fsrs = computeFsrsUpdate(score, {
			difficulty: currentProgress?.difficulty ?? 5.0,
			stability: currentProgress?.stability ?? 0.0,
			retrievability: currentProgress?.retrievability ?? 1.0,
			repetitions: currentProgress?.repetitions ?? 0,
			lapses: currentProgress?.lapses ?? 0,
			lastReviewDate: currentProgress?.lastReviewDate ?? null
		}, userRetention);

		await prisma.userGrammarRuleProgress.upsert({
			where: { userId_grammarRuleId: { userId, grammarRuleId: itemId } },
			create: { userId, grammarRuleId: itemId, ...fsrs },
			update: fsrs
		});

		return fsrs;
	}

	const currentProgress = await prisma.userVocabularyProgress.findUnique({
		where: { userId_vocabularyId: { userId, vocabularyId: itemId } }
	});

	const fsrs = computeFsrsUpdate(score, {
		difficulty: currentProgress?.difficulty ?? 5.0,
		stability: currentProgress?.stability ?? 0.0,
		retrievability: currentProgress?.retrievability ?? 1.0,
		repetitions: currentProgress?.repetitions ?? 0,
		lapses: currentProgress?.lapses ?? 0,
		lastReviewDate: currentProgress?.lastReviewDate ?? null
	}, userRetention);

	// Increment overrideCount when user overrode an incorrect grade to correct.
	const overrideIncrement = overridden ? 1 : 0;

	await prisma.userVocabularyProgress.upsert({
		where: { userId_vocabularyId: { userId, vocabularyId: itemId } },
		create: { userId, vocabularyId: itemId, ...fsrs, overrideCount: overrideIncrement },
		update: { ...fsrs, overrideCount: { increment: overrideIncrement } }
	});

	return fsrs;
}

/**
 * Updates the user's database records based on the evaluation payload.
 * Adjusts Elo ratings and SRS states for targeted Vocabulary and Grammar rules.
 *
 * All reads are batched into 6 parallel queries upfront (one per table) to
 * eliminate the N+1 pattern that previously fired 3-4 sequential DB round trips
 * per item.
 */
export async function updateEloRatings(
	userId: string,
	payload: EvaluationPayload,
	gameMode: string = 'native-to-target'
) {
	console.log(`Updating Elos for user ${userId} with payload:`, JSON.stringify(payload, null, 2));

	const vocabIds = (payload.vocabularyUpdates || []).map(u => u.id);
	const grammarIds = (payload.grammarUpdates || []).map(u => u.id);

	// Batch-prefetch everything we need across all items in 7 parallel queries.
	const emptyVocab: PrismaVocabulary[] = [];
	const emptyUserVocab: PrismaUserVocabulary[] = [];
	const emptyVocabProgress: PrismaUserVocabularyProgress[] = [];
	const emptyGrammar: PrismaGrammarRule[] = [];
	const emptyUserGrammar: PrismaUserGrammarRule[] = [];
	const emptyGrammarProgress: PrismaUserGrammarRuleProgress[] = [];

	const [
		userRetention,
		vocabRows,
		userVocabRows,
		vocabProgressRows,
		grammarRows,
		userGrammarRows,
		grammarProgressRows
	] = await Promise.all([
		prisma.user.findUnique({ where: { id: userId }, select: { fsrsRetention: true } })
			.then(u => u?.fsrsRetention ?? DEFAULT_FSRS_PARAMETERS.requestRetention),
		vocabIds.length > 0
			? prisma.vocabulary.findMany({ where: { id: { in: vocabIds } } })
			: Promise.resolve(emptyVocab),
		vocabIds.length > 0
			? prisma.userVocabulary.findMany({ where: { userId, vocabularyId: { in: vocabIds } } })
			: Promise.resolve(emptyUserVocab),
		vocabIds.length > 0
			? prisma.userVocabularyProgress.findMany({ where: { userId, vocabularyId: { in: vocabIds } } })
			: Promise.resolve(emptyVocabProgress),
		grammarIds.length > 0
			? prisma.grammarRule.findMany({ where: { id: { in: grammarIds } } })
			: Promise.resolve(emptyGrammar),
		grammarIds.length > 0
			? prisma.userGrammarRule.findMany({ where: { userId, grammarRuleId: { in: grammarIds } } })
			: Promise.resolve(emptyUserGrammar),
		grammarIds.length > 0
			? prisma.userGrammarRuleProgress.findMany({ where: { userId, grammarRuleId: { in: grammarIds } } })
			: Promise.resolve(emptyGrammarProgress)
	]);

	// Build O(1) lookup maps from the prefetched rows.
	const vocabMap = new Map<string, PrismaVocabulary>(vocabRows.map((v: PrismaVocabulary) => [v.id, v]));
	const userVocabMap = new Map<string, PrismaUserVocabulary>(userVocabRows.map((v: PrismaUserVocabulary) => [v.vocabularyId, v]));
	const vocabProgressMap = new Map<string, PrismaUserVocabularyProgress>(vocabProgressRows.map((p: PrismaUserVocabularyProgress) => [p.vocabularyId, p]));
	const grammarMap = new Map<string, PrismaGrammarRule>(grammarRows.map((g: PrismaGrammarRule) => [g.id, g]));
	const userGrammarMap = new Map<string, PrismaUserGrammarRule>(userGrammarRows.map((g: PrismaUserGrammarRule) => [g.grammarRuleId, g]));
	const grammarProgressMap = new Map<string, PrismaUserGrammarRuleProgress>(grammarProgressRows.map((p: PrismaUserGrammarRuleProgress) => [p.grammarRuleId, p]));

	// Process a single vocabulary update using prefetched data (zero extra reads).
	async function processVocabUpdate(vocabUpdate: EvaluationPayload['vocabularyUpdates'][number]) {
		let vocab = vocabMap.get(vocabUpdate.id);
		if (!vocab) {
			// Rare case: ID came from LLM and doesn't exist yet — create a stub.
			vocab = await prisma.vocabulary.create({ data: { id: vocabUpdate.id, lemma: vocabUpdate.id } });
		}

		const baseDifficulty = mapLevelToElo((vocab as { cefrLevel?: string }).cefrLevel || 'A1');
		const currentElo = userVocabMap.get(vocab.id)?.eloRating ?? baseDifficulty;

		const currentProgress = vocabProgressMap.get(vocab.id);
		const fsrs = computeFsrsUpdate(vocabUpdate.score, {
			difficulty: currentProgress?.difficulty ?? 5.0,
			stability: currentProgress?.stability ?? 0.0,
			retrievability: currentProgress?.retrievability ?? 1.0,
			repetitions: currentProgress?.repetitions ?? 0,
			lapses: currentProgress?.lapses ?? 0,
			lastReviewDate: currentProgress?.lastReviewDate ?? null
		}, userRetention);

		const priorRepetitions = Math.max(0, fsrs.repetitions - 1);
		const newElo = calculateNewElo(currentElo, vocabUpdate.score, baseDifficulty, gameMode, priorRepetitions);
		vocabUpdate.eloBefore = currentElo;
		vocabUpdate.eloAfter = newElo;
		const newState = deriveSrsStateFromFsrs(fsrs.repetitions, fsrs.stability, fsrs.lapses);

		// Persist errorType: set on incorrect answers, clear on correct ones.
		const errorType = vocabUpdate.score < 0.8 ? (vocabUpdate.errorType ?? null) : null;

		await Promise.all([
			prisma.userVocabularyProgress.upsert({
				where: { userId_vocabularyId: { userId, vocabularyId: vocab.id } },
				create: { userId, vocabularyId: vocab.id, ...fsrs, lastErrorType: errorType },
				update: { ...fsrs, lastErrorType: errorType }
			}),
			prisma.userVocabulary.upsert({
				where: { userId_vocabularyId: { userId, vocabularyId: vocab.id } },
				create: { userId, vocabularyId: vocab.id, eloRating: newElo, srsState: newState, nextReviewDate: fsrs.nextReviewDate },
				update: { eloRating: newElo, srsState: newState, nextReviewDate: fsrs.nextReviewDate }
			})
		]);
	}

	// Process a single grammar update using prefetched data (zero extra reads).
	async function processGrammarUpdate(grammarUpdate: EvaluationPayload['grammarUpdates'][number]) {
		const grammar = grammarMap.get(grammarUpdate.id);
		if (!grammar) {
			console.warn(`Attempted to update non-existent grammar rule: ${grammarUpdate.id}`);
			return;
		}

		const baseDifficulty = mapLevelToElo(grammar.level || 'A1');
		const currentElo = userGrammarMap.get(grammar.id)?.eloRating ?? baseDifficulty;

		const currentProgress = grammarProgressMap.get(grammar.id);
		const fsrs = computeFsrsUpdate(grammarUpdate.score, {
			difficulty: currentProgress?.difficulty ?? 5.0,
			stability: currentProgress?.stability ?? 0.0,
			retrievability: currentProgress?.retrievability ?? 1.0,
			repetitions: currentProgress?.repetitions ?? 0,
			lapses: currentProgress?.lapses ?? 0,
			lastReviewDate: currentProgress?.lastReviewDate ?? null
		}, userRetention);

		const priorRepetitions = Math.max(0, fsrs.repetitions - 1);
		const newElo = calculateNewElo(currentElo, grammarUpdate.score, baseDifficulty, gameMode, priorRepetitions);
		grammarUpdate.eloBefore = currentElo;
		grammarUpdate.eloAfter = newElo;
		const newState = deriveSrsStateFromFsrs(fsrs.repetitions, fsrs.stability, fsrs.lapses);

		const errorType = grammarUpdate.score < 0.8 ? (grammarUpdate.errorType ?? null) : null;

		await Promise.all([
			prisma.userGrammarRuleProgress.upsert({
				where: { userId_grammarRuleId: { userId, grammarRuleId: grammar.id } },
				create: { userId, grammarRuleId: grammar.id, ...fsrs, lastErrorType: errorType },
				update: { ...fsrs, lastErrorType: errorType }
			}),
			prisma.userGrammarRule.upsert({
				where: { userId_grammarRuleId: { userId, grammarRuleId: grammar.id } },
				create: { userId, grammarRuleId: grammar.id, eloRating: newElo, srsState: newState, nextReviewDate: fsrs.nextReviewDate },
				update: { eloRating: newElo, srsState: newState, nextReviewDate: fsrs.nextReviewDate }
			})
		]);
	}

	// Process an extra vocab lemma the user used correctly by coincidence.
	// These are looked up by lemma string so they can't be pre-batched by ID.
	async function processExtraLemma(lemma: string) {
		const vocab = await prisma.vocabulary.findFirst({
			where: { lemma, meanings: { some: {} } }
		});
		if (!vocab) return;

		const baseDifficulty = mapLevelToElo((vocab as { cefrLevel?: string }).cefrLevel || 'A1');
		const userVocab = await prisma.userVocabulary.findUnique({
			where: { userId_vocabularyId: { userId, vocabularyId: vocab.id } }
		});
		const currentElo = userVocab?.eloRating ?? baseDifficulty;
		const currentProgress = await prisma.userVocabularyProgress.findUnique({
			where: { userId_vocabularyId: { userId, vocabularyId: vocab.id } }
		});

		const fsrs = computeFsrsUpdate(1.0, {
			difficulty: currentProgress?.difficulty ?? 5.0,
			stability: currentProgress?.stability ?? 0.0,
			retrievability: currentProgress?.retrievability ?? 1.0,
			repetitions: currentProgress?.repetitions ?? 0,
			lapses: currentProgress?.lapses ?? 0,
			lastReviewDate: currentProgress?.lastReviewDate ?? null
		}, userRetention);

		const priorRepetitions = Math.max(0, fsrs.repetitions - 1);
		const newElo = calculateNewElo(currentElo, 1.0, baseDifficulty, gameMode, priorRepetitions);
		const newState = deriveSrsStateFromFsrs(fsrs.repetitions, fsrs.stability, fsrs.lapses);

		await Promise.all([
			prisma.userVocabularyProgress.upsert({
				where: { userId_vocabularyId: { userId, vocabularyId: vocab.id } },
				create: { userId, vocabularyId: vocab.id, ...fsrs },
				update: fsrs
			}),
			prisma.userVocabulary.upsert({
				where: { userId_vocabularyId: { userId, vocabularyId: vocab.id } },
				create: { userId, vocabularyId: vocab.id, eloRating: newElo, srsState: newState, nextReviewDate: fsrs.nextReviewDate },
				update: { eloRating: newElo, srsState: newState, nextReviewDate: fsrs.nextReviewDate }
			})
		]);
	}

	// Run all vocab, grammar, and extra-lemma updates in parallel.
	await Promise.all([
		...(payload.vocabularyUpdates || []).map(u =>
			processVocabUpdate(u).catch(err => console.error(`Failed to update user vocabulary ${u.id}:`, err))
		),
		...(payload.grammarUpdates || []).map(u =>
			processGrammarUpdate(u).catch(err => console.error(`Failed to update user grammar rule ${u.id}:`, err))
		),
		...(payload.extraVocabLemmas || []).filter(Boolean).map(lemma =>
			processExtraLemma(lemma).catch(err => console.error(`Failed to process extra vocab lemma ${lemma}:`, err))
		)
	]);
}
