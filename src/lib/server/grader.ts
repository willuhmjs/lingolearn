import { prisma } from './prisma';
import { ELO_CONFIG, CEFR_CONFIG } from './srsConfig';
import { reviewCard, scoreToRating, deriveSrsStateFromFsrs, DEFAULT_FSRS_PARAMETERS } from './fsrs';
import type { FsrsCard, Rating } from './fsrs';
import { loadHlrWeights, hlrInitialStability } from './hlr';
import type { HlrWeights } from './hlr';

// Module-level HLR weight cache — refreshed at most once per hour to avoid
// a DB read on every review without going stale for too long after a daily fit.
let _hlrWeightsCache: HlrWeights | null = null;
let _hlrWeightsCachedAt = 0;
const HLR_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getHlrWeights(): Promise<HlrWeights | null> {
  const now = Date.now();
  if (_hlrWeightsCache && now - _hlrWeightsCachedAt < HLR_CACHE_TTL_MS) {
    return _hlrWeightsCache;
  }
  _hlrWeightsCache = await loadHlrWeights();
  _hlrWeightsCachedAt = now;
  return _hlrWeightsCache;
}

/**
 * Fire-and-forget ReviewLog write. Never awaited — must not block grading.
 * The maintenance job in maintenance.ts prunes rows older than 30 days.
 */
function logReview(
  userId: string,
  itemId: string,
  itemType: 'vocabulary' | 'grammar',
  rating: number,
  priorStability: number,
  priorDifficulty: number,
  priorLastReviewDate: Date | null,
  responseTimeMs: number | null = null
): void {
  const elapsedDays = priorLastReviewDate
    ? (Date.now() - priorLastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const scheduledDays = priorLastReviewDate ? elapsedDays : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as unknown as Record<string, any>).reviewLog
    .create({
      data: {
        userId,
        itemId,
        itemType,
        rating,
        elapsedDays,
        scheduledDays,
        stability: priorStability,
        difficulty: priorDifficulty,
        ...(responseTimeMs !== null ? { responseTimeMs } : {})
      }
    })
    .catch((err: unknown) => console.error('[ReviewLog] write failed:', err));
}
import { srsRepository } from './srsRepository';
import type { SrsType } from './srsRepository';
import type {
  Vocabulary as PrismaVocabulary,
  UserVocabulary as PrismaUserVocabulary,
  UserVocabularyProgress as PrismaUserVocabularyProgress,
  GrammarRule as PrismaGrammarRule,
  UserGrammarRule as PrismaUserGrammarRule,
  UserGrammarRuleProgress as PrismaUserGrammarRuleProgress
} from '@prisma/client';
import { parseErrorCounts, updateErrorCounts } from './errorCounts';

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
  | 'wrong_case' // wrong grammatical case (Akkusativ, Dativ, etc.)
  | 'wrong_tense' // wrong verb tense or aspect
  | 'wrong_gender' // wrong article gender (der/die/das)
  | 'spelling' // misspelling not covered by ASCII equivalence
  | 'word_order' // incorrect sentence word order
  | 'vocabulary_gap'; // wrong or missing word — meaning not conveyed

export interface EvaluationPayload {
  globalScore: number;
  vocabularyUpdates: {
    id: string;
    score: number;
    errorType?: ErrorType | null;
    eloBefore?: number;
    eloAfter?: number;
  }[];
  grammarUpdates: {
    id: string;
    score: number;
    errorType?: ErrorType | null;
    eloBefore?: number;
    eloAfter?: number;
  }[];
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

  const vocabList = targetedVocabulary
    .map((v, i) => {
      const meanings = (v.meanings as { value: string }[] | undefined)
        ?.map((m) => m.value)
        .filter(Boolean)
        .join(' / ');
      return `- ${v.lemma} (ID: v${i})${meanings ? ` — accepted meanings: ${meanings}` : ''}`;
    })
    .join('\n');
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

    const userMessage = `Complete sentence: ${normalizeText(targetSentence)}\nStudent's sentence (blanks filled in): ${normalizeText(userInput)}`;
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
    } catch (_) {
      try {
        payload = JSON.parse(cleanedContent + '"}');
      } catch (_) {
        try {
          payload = JSON.parse(cleanedContent + '"]]}');
        } catch (_) {
          throw e; // throw original error if recovery fails
        }
      }
    }
  }

  const VALID_ERROR_TYPES = new Set([
    'wrong_case',
    'wrong_tense',
    'wrong_gender',
    'spelling',
    'word_order',
    'vocabulary_gap'
  ]);

  // Ensure backwards compatibility if LLM returns "success" (boolean) instead of "score"
  const mapItem = (item: {
    id: string;
    score?: number;
    success?: boolean;
    errorType?: string | null;
  }) => ({
    id: item.id,
    score: typeof item.score === 'number' ? item.score : item.success ? 1.0 : 0.0,
    errorType: (item.errorType && VALID_ERROR_TYPES.has(item.errorType)
      ? item.errorType
      : null) as ErrorType | null
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
  return (
    CEFR_CONFIG.BASE_ELO[level.toUpperCase() as keyof typeof CEFR_CONFIG.BASE_ELO] ||
    CEFR_CONFIG.BASE_ELO.A1
  );
}

/**
 * Bayesian ELO update (Glicko-inspired).
 *
 * Maintains a per-item variance σ² that starts high (large uncertainty about
 * the item's true difficulty for this user) and shrinks with each observation.
 * The effective update step is derived from σ², so new items are highly
 * responsive and well-reviewed items are stable — eliminating the manual
 * K-decay heuristic.
 *
 * Returns { newMu, newVariance }.
 */
function calculateNewElo(
  currentMu: number,
  currentVariance: number,
  score: number,
  baseDifficulty: number,
  gameMode: string
): { newMu: number; newVariance: number } {
  let modeWeight = 1.0;
  if (gameMode === 'multiple-choice') modeWeight = ELO_CONFIG.K_MULTIPLIERS.MULTIPLE_CHOICE;
  else if (gameMode === 'target-to-native') modeWeight = ELO_CONFIG.K_MULTIPLIERS.TARGET_TO_NATIVE;
  else if (gameMode === 'native-to-target') modeWeight = ELO_CONFIG.K_MULTIPLIERS.NATIVE_TO_TARGET;
  else if (gameMode === 'fill-blank') modeWeight = ELO_CONFIG.K_MULTIPLIERS.FILL_BLANK;

  const q = Math.log(10) / 400; // ≈ 0.005756
  const expected = 1 / (1 + Math.pow(10, (baseDifficulty - currentMu) / 400));
  // Uncertainty attenuation factor g ∈ (0, modeWeight] — shrinks as σ² grows
  const g = modeWeight / Math.sqrt(1 + (3 * q * q * currentVariance) / (Math.PI * Math.PI));
  // Information gain from this observation (q² term per Glicko-1 so variance decays gradually)
  const d2 = 1 / (q * q * g * g * expected * (1 - expected) + 1e-8);
  // Posterior mean update
  const updateStep = ((score - expected) * g) / (1 / currentVariance + 1 / d2);
  // Cap per-review delta to prevent wild swings on first reviews / high-variance items
  const MAX_ELO_DELTA = 40;
  const rawDelta = (1 / q) * updateStep;
  const clampedDelta = Math.max(-MAX_ELO_DELTA, Math.min(MAX_ELO_DELTA, rawDelta));
  const newMu = Math.max(500, Math.min(2500, currentMu + clampedDelta));
  // Posterior variance shrinks with each observation; floor at 25 (σ=5) to retain responsiveness
  const newVariance = Math.max(25, 1 / (1 / currentVariance + 1 / d2));

  return { newMu, newVariance };
}

/**
 * Runs FSRS review on a card loaded from the DB progress record.
 * Returns updated FSRS fields and the next review date.
 */
/**
 * Adjust a base FSRS rating using response time relative to the item's stored median.
 *
 * Rules (only applied when responseTimeMs and medianResponseMs are both available):
 *   - Correct + very fast (< 50% of median): upgrade Good→Easy (3→4). Fluent recall.
 *   - Correct + very slow (> 200% of median): downgrade Easy→Good or Good→Hard (4→3, 3→2).
 *     Effortful retrieval is still learning — don't over-reward.
 *   - Incorrect + very fast (< 50% of median): downgrade Again by 0 (keep 1). Likely a
 *     guess or inattention — don't double-penalise, but don't soften either.
 *
 * Thresholds are intentionally conservative to avoid over-correcting on sparse data.
 */
function adjustRatingForResponseTime(
  baseRating: Rating,
  score: number,
  responseTimeMs: number | null,
  medianResponseMs: number | null
): Rating {
  if (responseTimeMs === null || medianResponseMs === null || medianResponseMs <= 0) {
    return baseRating;
  }
  const ratio = responseTimeMs / medianResponseMs;
  const correct = score >= 0.5;

  if (correct) {
    if (ratio < 0.5 && baseRating === 3) return 4; // fast correct Good → Easy
    if (ratio > 2.0 && baseRating === 4) return 3; // slow correct Easy → Good
    if (ratio > 2.0 && baseRating === 3) return 2; // slow correct Good → Hard
  }
  // For incorrect answers, rating stays as-is — response time doesn't change the failure penalty.
  return baseRating;
}

async function computeFsrsUpdate(
  score: number,
  current: {
    difficulty: number;
    stability: number;
    retrievability: number;
    repetitions: number;
    lapses: number;
    lastReviewDate: Date | null;
    medianResponseMs?: number | null;
    // Optional item metadata used for HLR initial stability on first review
    frequencyRank?: number | null;
    cefrLevel?: string | null;
    partOfSpeech?: string | null;
  },
  requestRetention: number = DEFAULT_FSRS_PARAMETERS.requestRetention,
  userWeights?: number[],
  responseTimeMs: number | null = null
) {
  // On first review, use HLR to compute a better initial stability prior.
  // This replaces the generic w[0..3] FSRS initialization with an item-informed estimate.
  let overrideStability: number | undefined;
  if (current.repetitions === 0 && (current.frequencyRank !== undefined || current.cefrLevel)) {
    const hlrWeights = await getHlrWeights();
    if (hlrWeights) {
      overrideStability = hlrInitialStability(
        current.frequencyRank ?? null,
        current.cefrLevel ?? 'A1',
        current.partOfSpeech ?? null,
        hlrWeights
      );
    }
  }

  const card: FsrsCard = {
    difficulty: current.difficulty,
    stability: overrideStability ?? current.stability,
    retrievability: current.retrievability,
    repetitions: current.repetitions,
    lapses: current.lapses,
    lastReviewDate: current.lastReviewDate ?? undefined
  };

  const w = userWeights?.length === 19 ? userWeights : DEFAULT_FSRS_PARAMETERS.w;
  const params = { ...DEFAULT_FSRS_PARAMETERS, requestRetention, w };
  const baseRating = scoreToRating(score);
  const rating = adjustRatingForResponseTime(
    baseRating,
    score,
    responseTimeMs,
    current.medianResponseMs ?? null
  );
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

/**
 * Incrementally update the stored median response time using the Welford-style
 * running estimate: new_median ≈ old_median + 0.1 * (responseTimeMs - old_median).
 * This is a smoothed running estimate, not a true median, but converges quickly
 * and requires no stored history.
 */
function updateRunningMedian(current: number | null, newValue: number): number {
  if (current === null) return newValue;
  return Math.round(current + 0.1 * (newValue - current));
}

export async function updateSrsMetrics(
  userId: string,
  itemId: string,
  score: number,
  type: SrsType = 'vocabulary',
  overridden = false,
  responseTimeMs: number | null = null,
  isProduction = false
) {
  // Fetch user's FSRS retention preference and optimized weights once
  const userPrefs = await prisma.user.findUnique({
    where: { id: userId },
    select: { fsrsRetention: true, fsrsWeights: true }
  });
  const userRetention = userPrefs?.fsrsRetention ?? DEFAULT_FSRS_PARAMETERS.requestRetention;
  const userWeights = userPrefs?.fsrsWeights?.length === 19 ? userPrefs.fsrsWeights : undefined;

  const hasProducedUpdate = isProduction && score >= 0.8;
  const currentProgress = await srsRepository.getProgress(userId, itemId, type);

  const priorState = {
    difficulty: currentProgress?.difficulty ?? 5.0,
    stability: currentProgress?.stability ?? 0.0,
    retrievability: currentProgress?.retrievability ?? 1.0,
    repetitions: currentProgress?.repetitions ?? 0,
    lapses: currentProgress?.lapses ?? 0,
    lastReviewDate: currentProgress?.lastReviewDate ?? null,
    medianResponseMs: currentProgress?.medianResponseMs ?? null
  };

  const fsrs = await computeFsrsUpdate(
    score,
    priorState,
    userRetention,
    userWeights,
    responseTimeMs
  );

  const newMedianMs =
    responseTimeMs !== null
      ? updateRunningMedian(currentProgress?.medianResponseMs ?? null, responseTimeMs)
      : undefined;

  await srsRepository.update({
    userId,
    itemId,
    type,
    fsrs: { ...fsrs, nextReviewDate: fsrs.nextReviewDate },
    medianResponseMs: newMedianMs,
    hasProduced: hasProducedUpdate,
    overrideIncrement: overridden ? 1 : 0
  });

  logReview(
    userId,
    itemId,
    type,
    scoreToRating(score),
    priorState.stability,
    priorState.difficulty,
    priorState.lastReviewDate,
    responseTimeMs
  );

  return fsrs;
}

export async function updateSrsMetricsBatch(
  userId: string,
  itemIds: string[],
  score: number,
  type: SrsType = 'vocabulary',
  overridden = false,
  responseTimeMs: number | null = null,
  isProduction = false
) {
  if (itemIds.length === 0) return;

  const [userPrefs, progressRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { fsrsRetention: true, fsrsWeights: true }
    }),
    type === 'vocabulary'
      ? prisma.userVocabularyProgress.findMany({ where: { userId, vocabularyId: { in: itemIds } } })
      : prisma.userGrammarRuleProgress.findMany({
          where: { userId, grammarRuleId: { in: itemIds } }
        })
  ]);

  const userRetention = userPrefs?.fsrsRetention ?? DEFAULT_FSRS_PARAMETERS.requestRetention;
  const userWeights = userPrefs?.fsrsWeights?.length === 19 ? userPrefs.fsrsWeights : undefined;

  const progressMap = new Map<string, any>(
    progressRows.map(
      (p) =>
        [
          type === 'vocabulary'
            ? (p as PrismaUserVocabularyProgress).vocabularyId
            : (p as PrismaUserGrammarRuleProgress).grammarRuleId,
          p
        ] as [string, any]
    )
  );

  // Also need frequency/CEFR info if it's vocabulary for HLR initialization on first review
  let vocabInfoMap = new Map<string, any>();
  if (type === 'vocabulary') {
    const vocabRows = await prisma.vocabulary.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, frequency: true, cefrLevel: true, partOfSpeech: true }
    });
    vocabInfoMap = new Map(vocabRows.map((v) => [v.id, v]));
  }

  const updateParams: import('./srsRepository').SrsUpdateParams[] = [];

  for (const itemId of itemIds) {
    const currentProgress = progressMap.get(itemId) as any;
    const vocabInfo = vocabInfoMap.get(itemId);

    const priorState = {
      difficulty: currentProgress?.difficulty ?? 5.0,
      stability: currentProgress?.stability ?? 0.0,
      retrievability: currentProgress?.retrievability ?? 1.0,
      repetitions: currentProgress?.repetitions ?? 0,
      lapses: currentProgress?.lapses ?? 0,
      lastReviewDate: currentProgress?.lastReviewDate ?? null,
      medianResponseMs: currentProgress?.medianResponseMs ?? null,
      frequencyRank: vocabInfo?.frequency ?? null,
      cefrLevel: vocabInfo?.cefrLevel ?? 'A1',
      partOfSpeech: vocabInfo?.partOfSpeech ?? null
    };

    const fsrs = await computeFsrsUpdate(
      score,
      priorState,
      userRetention,
      userWeights,
      responseTimeMs
    );

    const newMedianMs =
      responseTimeMs !== null
        ? updateRunningMedian(priorState.medianResponseMs, responseTimeMs)
        : undefined;

    const hasProducedUpdate = isProduction && score >= 0.8;

    updateParams.push({
      userId,
      itemId,
      type,
      fsrs: { ...fsrs, nextReviewDate: fsrs.nextReviewDate },
      medianResponseMs: newMedianMs,
      hasProduced: hasProducedUpdate,
      overrideIncrement: overridden ? 1 : 0
    });

    logReview(
      userId,
      itemId,
      type,
      scoreToRating(score),
      priorState.stability,
      priorState.difficulty,
      priorState.lastReviewDate,
      responseTimeMs
    );
  }

  await srsRepository.batchUpdateSrsMetrics(updateParams);
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
  gameMode: string = 'native-to-target',
  responseTimeMs: number | null = null
) {
  console.log(`Updating Elos for user ${userId} with payload:`, JSON.stringify(payload, null, 2));

  const vocabIds = (payload.vocabularyUpdates || []).map((u) => u.id);
  const grammarIds = (payload.grammarUpdates || []).map((u) => u.id);

  // Batch-prefetch everything we need across all items in 7 parallel queries.
  const emptyVocab: PrismaVocabulary[] = [];
  const emptyUserVocab: PrismaUserVocabulary[] = [];
  const emptyVocabProgress: PrismaUserVocabularyProgress[] = [];
  const emptyGrammar: PrismaGrammarRule[] = [];
  const emptyUserGrammar: PrismaUserGrammarRule[] = [];
  const emptyGrammarProgress: PrismaUserGrammarRuleProgress[] = [];

  const [
    userPrefsForElo,
    vocabRows,
    userVocabRows,
    vocabProgressRows,
    grammarRows,
    userGrammarRows,
    grammarProgressRows
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { fsrsRetention: true, fsrsWeights: true }
    }),
    vocabIds.length > 0
      ? prisma.vocabulary.findMany({ where: { id: { in: vocabIds } } })
      : Promise.resolve(emptyVocab),
    vocabIds.length > 0
      ? prisma.userVocabulary.findMany({ where: { userId, vocabularyId: { in: vocabIds } } })
      : Promise.resolve(emptyUserVocab),
    vocabIds.length > 0
      ? prisma.userVocabularyProgress.findMany({
          where: { userId, vocabularyId: { in: vocabIds } }
        })
      : Promise.resolve(emptyVocabProgress),
    grammarIds.length > 0
      ? prisma.grammarRule.findMany({ where: { id: { in: grammarIds } } })
      : Promise.resolve(emptyGrammar),
    grammarIds.length > 0
      ? prisma.userGrammarRule.findMany({ where: { userId, grammarRuleId: { in: grammarIds } } })
      : Promise.resolve(emptyUserGrammar),
    grammarIds.length > 0
      ? prisma.userGrammarRuleProgress.findMany({
          where: { userId, grammarRuleId: { in: grammarIds } }
        })
      : Promise.resolve(emptyGrammarProgress)
  ]);

  const userRetention = userPrefsForElo?.fsrsRetention ?? DEFAULT_FSRS_PARAMETERS.requestRetention;
  const userWeightsForElo =
    userPrefsForElo?.fsrsWeights?.length === 19 ? userPrefsForElo.fsrsWeights : undefined;

  // Build O(1) lookup maps from the prefetched rows.
  const vocabMap = new Map<string, PrismaVocabulary>(
    vocabRows.map((v: PrismaVocabulary) => [v.id, v])
  );
  const userVocabMap = new Map<string, PrismaUserVocabulary>(
    userVocabRows.map((v: PrismaUserVocabulary) => [v.vocabularyId, v])
  );
  const vocabProgressMap = new Map<string, PrismaUserVocabularyProgress>(
    vocabProgressRows.map((p: PrismaUserVocabularyProgress) => [p.vocabularyId, p])
  );
  const grammarMap = new Map<string, PrismaGrammarRule>(
    grammarRows.map((g: PrismaGrammarRule) => [g.id, g])
  );
  const userGrammarMap = new Map<string, PrismaUserGrammarRule>(
    userGrammarRows.map((g: PrismaUserGrammarRule) => [g.grammarRuleId, g])
  );
  const grammarProgressMap = new Map<string, PrismaUserGrammarRuleProgress>(
    grammarProgressRows.map((p: PrismaUserGrammarRuleProgress) => [p.grammarRuleId, p])
  );

  // Process a single item update (vocabulary or grammar) using prefetched data (zero extra reads).
  async function processItemUpdate(
    itemUpdate:
      | EvaluationPayload['vocabularyUpdates'][number]
      | EvaluationPayload['grammarUpdates'][number],
    itemType: SrsType
  ) {
    let itemBase: any;
    if (itemType === 'vocabulary') {
      itemBase = vocabMap.get(itemUpdate.id);
      if (!itemBase) {
        // Rare case: ID came from LLM and doesn't exist yet — create a stub.
        itemBase = await prisma.vocabulary.create({
          data: { id: itemUpdate.id, lemma: itemUpdate.id }
        });
      }
    } else {
      itemBase = grammarMap.get(itemUpdate.id);
      if (!itemBase) {
        console.warn(`Attempted to update non-existent grammar rule: ${itemUpdate.id}`);
        return;
      }
    }

    const level = itemType === 'vocabulary' ? itemBase.cefrLevel || 'A1' : itemBase.level || 'A1';
    const baseDifficulty = mapLevelToElo(level);
    const metrics =
      itemType === 'vocabulary' ? userVocabMap.get(itemBase.id) : userGrammarMap.get(itemBase.id);
    const currentElo = metrics?.eloRating ?? baseDifficulty;
    const currentVariance = metrics?.eloVariance ?? 400;

    const currentProgress =
      itemType === 'vocabulary'
        ? vocabProgressMap.get(itemBase.id)
        : grammarProgressMap.get(itemBase.id);
    const priorState = {
      difficulty: currentProgress?.difficulty ?? 5.0,
      stability: currentProgress?.stability ?? 0.0,
      retrievability: currentProgress?.retrievability ?? 1.0,
      repetitions: currentProgress?.repetitions ?? 0,
      lapses: currentProgress?.lapses ?? 0,
      lastReviewDate: currentProgress?.lastReviewDate ?? null,
      medianResponseMs: currentProgress?.medianResponseMs ?? null,
      frequencyRank: itemType === 'vocabulary' ? (itemBase.frequency ?? null) : null,
      cefrLevel: level,
      partOfSpeech: itemType === 'vocabulary' ? (itemBase.partOfSpeech ?? null) : null
    };

    const fsrs = await computeFsrsUpdate(
      itemUpdate.score,
      priorState,
      userRetention,
      userWeightsForElo,
      responseTimeMs
    );

    const { newMu: newElo, newVariance } = calculateNewElo(
      currentElo,
      currentVariance,
      itemUpdate.score,
      baseDifficulty,
      gameMode
    );

    itemUpdate.eloBefore = currentElo;
    itemUpdate.eloAfter = newElo;

    const newState = deriveSrsStateFromFsrs(fsrs.repetitions, fsrs.stability, fsrs.lapses);
    const errorType = itemUpdate.score < 0.8 ? (itemUpdate.errorType ?? null) : null;

    const currentErrorCounts = parseErrorCounts(currentProgress?.errorCounts ?? null);
    const newErrorCounts = updateErrorCounts(
      currentErrorCounts,
      priorState.lastReviewDate,
      errorType
    );

    const newMedianMs =
      responseTimeMs !== null
        ? updateRunningMedian(priorState.medianResponseMs, responseTimeMs)
        : undefined;

    const isProduction = gameMode === 'native-to-target' || gameMode === 'fill-blank';
    const hasProducedUpdate = isProduction && itemUpdate.score >= 0.8;

    await srsRepository.update({
      userId,
      itemId: itemBase.id,
      type: itemType,
      fsrs: { ...fsrs, nextReviewDate: fsrs.nextReviewDate },
      elo: { rating: newElo, variance: newVariance },
      state: newState,
      errorType,
      errorCounts: newErrorCounts,
      medianResponseMs: newMedianMs,
      hasProduced: hasProducedUpdate
    });

    logReview(
      userId,
      itemBase.id,
      itemType,
      scoreToRating(itemUpdate.score),
      priorState.stability,
      priorState.difficulty,
      priorState.lastReviewDate,
      responseTimeMs
    );
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

    const fsrs = await computeFsrsUpdate(
      1.0,
      {
        difficulty: currentProgress?.difficulty ?? 5.0,
        stability: currentProgress?.stability ?? 0.0,
        retrievability: currentProgress?.retrievability ?? 1.0,
        repetitions: currentProgress?.repetitions ?? 0,
        lapses: currentProgress?.lapses ?? 0,
        lastReviewDate: currentProgress?.lastReviewDate ?? null
      },
      userRetention,
      userWeightsForElo
    );

    const currentVarianceExtra = userVocab?.eloVariance ?? 400;
    const { newMu: newEloExtra, newVariance: newVarianceExtra } = calculateNewElo(
      currentElo,
      currentVarianceExtra,
      1.0,
      baseDifficulty,
      gameMode
    );
    const newState = deriveSrsStateFromFsrs(fsrs.repetitions, fsrs.stability, fsrs.lapses);

    await srsRepository.update({
      userId,
      itemId: vocab.id,
      type: 'vocabulary',
      fsrs: { ...fsrs, nextReviewDate: fsrs.nextReviewDate },
      elo: { rating: newEloExtra, variance: newVarianceExtra },
      state: newState
    });
  }

  // Run all vocab, grammar, and extra-lemma updates in parallel.
  await Promise.all([
    ...(payload.vocabularyUpdates || []).map((u) =>
      processItemUpdate(u, 'vocabulary').catch((err) =>
        console.error(`Failed to update user vocabulary ${u.id}:`, err)
      )
    ),
    ...(payload.grammarUpdates || []).map((u) =>
      processItemUpdate(u, 'grammar').catch((err) =>
        console.error(`Failed to update user grammar rule ${u.id}:`, err)
      )
    ),
    ...(payload.extraVocabLemmas || [])
      .filter(Boolean)
      .map((lemma) =>
        processExtraLemma(lemma).catch((err) =>
          console.error(`Failed to process extra vocab lemma ${lemma}:`, err)
        )
      )
  ]);
}
