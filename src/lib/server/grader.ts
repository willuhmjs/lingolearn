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

	const vocabList = targetedVocabulary.map((v, i) => `- ${v.lemma} (ID: v${i})`).join('\n');
	const grammarList = targetedGrammar.map((g, i) => `- ${g.title} (ID: g${i})`).join('\n');

	const isAbsoluteBeginner = userLevel === 'A1';
	const beginnerEncouragement = isAbsoluteBeginner
		? `\nIMPORTANT BEGINNER CONTEXT: This student is at A1 level and may be just starting out. Be extra encouraging in your feedback. Celebrate what they got right before mentioning errors. Use simple language in feedback. If they attempted something even partially correct, give partial credit (at least 0.3). The goal is to build confidence while learning.\n`
		: '';

	if (gameMode === 'fill-blank') {
		const systemPrompt = `You are an expert language tutor evaluating a student's fill-in-the-blank answers.
You must output ONLY strictly valid JSON. Do not include markdown formatting or extra text.
${beginnerEncouragement}

Your task:
The student was given a ${activeLanguageName} sentence with blanks for targeted vocabulary words. They provided answers for each blank.
Compare their answers against the expected complete ${activeLanguageName} sentence.
Calculate a global accuracy score between 0.0 and 1.0. Be forgiving of minor typos and capitalization errors.
Note: Do not penalize the user if they use ASCII equivalents for ${activeLanguageName} special characters (e.g., 'ss' instead of 'ß', 'ae' instead of 'ä', 'oe' instead of 'ö', 'ue' instead of 'ü', or their uppercase equivalents like 'Ae' for 'Ä', 'Ue' for 'Ü', etc.). Treat these as ENTIRELY correct — they MUST receive a score of 1.0 for that vocabulary item.
IMPORTANT: Capitalization errors (e.g., writing "Gluecklich" instead of "glücklich") are MINOR issues. If the student wrote the correct word with only a capitalization difference, the vocabulary score for that word MUST be at least 0.8. Do NOT give a score of 0 for capitalization-only errors.
SCORING CONSISTENCY: Each vocabulary/grammar item score must be consistent with the global score. If the global score is above 0.8, no individual item that the student attempted correctly (even with minor issues) should receive a score below 0.5.
Provide helpful, concise feedback in ${nativeLanguage} ("feedback").
For vocabularyUpdates and grammarUpdates, provide a score between 0.0 and 1.0 depending on how well they used the item. Score each item INDEPENDENTLY.
If the user correctly used any OTHER ${activeLanguageName} words by coincidence that are not in the targeted list, output their base forms (lemmas) with proper capitalization (e.g. nouns capitalized in German) in the "extraVocabLemmas" array.

IMPORTANT: "feedback" MUST be the very first key in your JSON response.

Targeted Vocabulary:
${vocabList}

Targeted Grammar Rules:
${grammarList}

JSON format:
{
  "feedback": "<string (${nativeLanguage} feedback)>",
  "globalScore": <number>,
  "vocabularyUpdates": [ { "id": "<vocabulary ID>", "score": <number (0.0 to 1.0)>, "errorType": "<wrong_case|wrong_tense|wrong_gender|spelling|word_order|vocabulary_gap|null>" } ],
  "grammarUpdates": [ { "id": "<grammar ID>", "score": <number (0.0 to 1.0)>, "errorType": "<wrong_case|wrong_tense|wrong_gender|spelling|word_order|vocabulary_gap|null>" } ],
  "extraVocabLemmas": ["<lemma1>", "<lemma2>"]
}
For errorType: set to the most applicable error category if score < 0.8, otherwise null.`;

		const userMessage = `Complete ${activeLanguageName} sentence: ${normalizeText(targetSentence)}\nUser's blank answers: ${normalizeText(userInput)}`;
		return { systemPrompt, userMessage, idMap };
	}

	if (gameMode === 'multiple-choice') {
		const systemPrompt = `You are an expert language tutor evaluating a student's multiple choice answer.
You must output ONLY strictly valid JSON. Do not include markdown formatting or extra text.
${beginnerEncouragement}

Your task:
The student was shown a ${activeLanguageName} sentence and chose a ${nativeLanguage} translation from multiple options.
Compare their chosen answer to the correct translation.
If they chose correctly, score 1.0. If wrong, score 0.0.
Provide brief feedback in ${nativeLanguage} ("feedback") explaining why the correct answer is right.
For vocabularyUpdates and grammarUpdates, provide a score of 1.0 or 0.0 based on whether they got the question right.
If the user correctly recognized any OTHER ${activeLanguageName} words by coincidence that are not in the targeted list, output their base forms (lemmas) with proper capitalization (e.g. nouns capitalized in German) in the "extraVocabLemmas" array.

IMPORTANT: "feedback" MUST be the very first key in your JSON response.

Targeted Vocabulary:
${vocabList}

Targeted Grammar Rules:
${grammarList}

JSON format:
{
  "feedback": "<string (${nativeLanguage} feedback)>",
  "globalScore": <number>,
  "vocabularyUpdates": [ { "id": "<vocabulary ID>", "score": <number (0.0 to 1.0)>, "errorType": "<wrong_case|wrong_tense|wrong_gender|spelling|word_order|vocabulary_gap|null>" } ],
  "grammarUpdates": [ { "id": "<grammar ID>", "score": <number (0.0 to 1.0)>, "errorType": "<wrong_case|wrong_tense|wrong_gender|spelling|word_order|vocabulary_gap|null>" } ],
  "extraVocabLemmas": ["<lemma1>", "<lemma2>"]
}
For errorType: set to the most applicable error category if score < 0.8, otherwise null.`;

		const userMessage = `Correct ${nativeLanguage} translation: ${targetSentence}\nUser's chosen answer: ${userInput}`;
		return { systemPrompt, userMessage, idMap };
	}

	// Translation modes (native-to-target, target-to-native)
	const isNativeToTarget = gameMode === 'native-to-target';
	const userLanguage = isNativeToTarget ? '${activeLanguageName}' : nativeLanguage;
	const targetLanguage = isNativeToTarget ? '${activeLanguageName}' : nativeLanguage;

	const asciiNote = isNativeToTarget
		? `Note: Do not penalize the user if they use ASCII equivalents for ${activeLanguageName} special characters (e.g., 'ss' instead of 'ß', 'ae' instead of 'ä', 'oe' instead of 'ö', 'ue' instead of 'ü', or their uppercase equivalents like 'Ae' for 'Ä'). Treat these as entirely correct.`
		: `IMPORTANT: When ${activeLanguageName} does not grammatically distinguish between certain ${nativeLanguage} verb forms (e.g., simple vs. progressive vs. continuous aspect), accept ALL equivalent ${nativeLanguage} verb forms as fully correct. For example, if ${activeLanguageName} uses a single present tense form where ${nativeLanguage} has "I come" / "I am coming" / "I do come", all must receive a score of 1.0. Only penalize verb form differences when ${activeLanguageName} itself makes that distinction (e.g., separate past tenses like preterite vs. perfect, if applicable).`;

	const grammarNote = isNativeToTarget
		? ''
		: `Note: Since this is a ${activeLanguageName}-to-${nativeLanguage} translation, evaluate whether the user's ${nativeLanguage} translation accurately reflects an understanding of the targeted grammar rules (e.g. if the target grammar is "Past Tense", did they translate it into the past tense?). Score each targeted grammar rule in "grammarUpdates".`;

	const vocabScoringNote = isNativeToTarget
		? ''
		: `IMPORTANT: For vocabulary scoring in ${activeLanguageName}-to-${nativeLanguage} mode, score each targeted vocabulary word INDEPENDENTLY based solely on whether the user correctly conveyed its meaning in ${nativeLanguage}. Do NOT penalize a vocabulary word for unrelated errors elsewhere in the sentence. The user is translating INTO ${nativeLanguage}, so they will not write the ${activeLanguageName} words themselves — instead, check whether the ${nativeLanguage} translation accurately reflects the meaning of each targeted ${activeLanguageName} vocabulary word. For example, if "die Klasse" is targeted and the user writes "the class", that vocabulary word MUST receive a score of 1.0, even if other parts of the sentence contain errors (like writing "Ist" instead of "Is"). Each vocabulary score should reflect ONLY whether that specific word's meaning was correctly translated.`;

	const helpNote = isNativeToTarget
		? `Note: The user is allowed to ask for a ${nativeLanguage} translation, or provide a ${nativeLanguage} translation of the sentence alongside their answer. If they ask for a translation or provide a ${nativeLanguage} translation because they are stuck, do not penalize them for it. Provide the translation in the feedback and give a score of 0.0, since no real attempt was made. OVERRIDE: If the user is asking for help (e.g. "What?", "I don't know", "help", "?"), their globalScore MUST be 0.0 regardless of their level — the beginner encouragement rule does NOT apply when no real attempt was made.`
		: `Note: The user is allowed to ask for help or a ${activeLanguageName} translation. If they do, provide the translation in the feedback and give a score of 0.0, since no real attempt was made. OVERRIDE: If the user is asking for help (e.g. "What?", "I don't know", "help", "?"), their globalScore MUST be 0.0 regardless of their level — the beginner encouragement rule does NOT apply when no real attempt was made.`;

	const extraVocabNote = isNativeToTarget
		? `If the user correctly used any OTHER ${activeLanguageName} words by coincidence that are not in the targeted list, output their base forms (lemmas) with proper capitalization (e.g. nouns capitalized in German) in the "extraVocabLemmas" array.`
		: `If the user demonstrated understanding of any OTHER ${activeLanguageName} words from the original sentence (by translating them correctly), output the ORIGINAL ${activeLanguageName} base forms (lemmas) with proper capitalization (e.g. nouns capitalized in German) in the "extraVocabLemmas" array. Do NOT output ${nativeLanguage} words in this array.`;

	const systemPrompt = `You are an expert language tutor evaluating a student's ${userLanguage} translation.
You must output ONLY strictly valid JSON. Do not include markdown formatting or extra text.
${beginnerEncouragement}

Your task:
Evaluate the user's ${userLanguage} input against the target expected ${targetLanguage} output.
Calculate a global accuracy score between 0.0 and 1.0. Be forgiving of minor mistakes like slight typos, capitalization errors, or minor word order issues that do not change the core meaning. Do not penalize minor errors harshly; keep the score proportional to the overall understanding shown.
Assess if the user correctly used the targeted vocabulary and grammar rules. Give a decimal score between 0.0 and 1.0 for each item in vocabularyUpdates and grammarUpdates. Score each vocabulary and grammar item INDEPENDENTLY — do not penalize one item for errors related to a different item.
Provide helpful, concise feedback in ${nativeLanguage} ("feedback").
${extraVocabNote}
${asciiNote}
${grammarNote}
${vocabScoringNote}
${helpNote}

IMPORTANT: "feedback" MUST be the very first key in your JSON response.

Targeted Vocabulary:
${vocabList}

Targeted Grammar Rules:
${grammarList}

JSON format:
{
  "feedback": "<string (${nativeLanguage} feedback)>",
  "globalScore": <number>,
  "vocabularyUpdates": [ { "id": "<vocabulary ID>", "score": <number (0.0 to 1.0)>, "errorType": "<wrong_case|wrong_tense|wrong_gender|spelling|word_order|vocabulary_gap|null>" } ],
  "grammarUpdates": [ { "id": "<grammar ID>", "score": <number (0.0 to 1.0)>, "errorType": "<wrong_case|wrong_tense|wrong_gender|spelling|word_order|vocabulary_gap|null>" } ],
  "extraVocabLemmas": ["<${activeLanguageName} lemma 1>", "<${activeLanguageName} lemma 2>"]
}
For errorType: set to the most applicable error category if score < 0.8, otherwise null.`;

	const normalizedTarget = isNativeToTarget ? normalizeText(targetSentence) : targetSentence;
	const normalizedInput = isNativeToTarget ? normalizeText(userInput) : userInput;

	const userMessage = `Target Expected Output: ${normalizedTarget}\nUser Input: ${normalizedInput}`;
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
		result.vocabularyUpdates = result.vocabularyUpdates.map((u) => ({
			...u,
			score: Math.max(u.score, minItemScore),
			// Clear errorType when score is bumped up — the error was likely minor/false-positive
			errorType: u.score < minItemScore ? null : u.errorType
		}));
		result.grammarUpdates = result.grammarUpdates.map((u) => ({
			...u,
			score: Math.max(u.score, minItemScore),
			errorType: u.score < minItemScore ? null : u.errorType
		}));
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
