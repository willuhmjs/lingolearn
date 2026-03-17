/**
 * Half-Life Regression (HLR) — Settles & Meeder 2016 (Duolingo)
 *
 * Fits a log-linear model that predicts the memory half-life of an item from
 * a combination of review history features and item-level lexical features:
 *
 *   log2(half_life) = θ₀
 *                   + θ₁ · log2(correct_reviews + 1)
 *                   + θ₂ · log2(wrong_reviews + 1)
 *                   + θ₃ · log2(days_since_last + 1)
 *                   + θ₄ · log2(frequency_rank_bucket + 1)   (0 if unknown)
 *                   + θ₅ · cefr_index                        (0=A1 … 5=C2)
 *                   + θ₆ · is_verb                           (1/0)
 *                   + θ₇ · is_noun                           (1/0)
 *
 * Training: gradient descent on the squared loss between predicted and actual
 * half-life for each review event in ReviewLog where elapsedDays > 0.
 * The actual half-life for a review is estimated as:
 *   h ≈ elapsedDays / log2(1 / max(retrievability_at_review, 0.01))
 *
 * The fitted θ weights are stored on SiteSettings as a JSON blob so they are
 * shared across all users (global prior). Per-user FSRS weights already handle
 * individual variation — HLR provides a better *initial* stability for new items.
 *
 * Usage:
 *   - `fitHlrWeights()` — called daily by maintenance, saves weights to SiteSettings
 *   - `hlrInitialStability(item, weights)` — called in grader when repetitions === 0
 *     to replace the generic FSRS w[0..3] initialization with a feature-informed prior
 */

import { prisma } from './prisma';

export interface HlrWeights {
  theta: number[]; // 8 weights matching the feature vector above
  trainedAt: string; // ISO date string
  sampleSize: number;
}

const N_FEATURES = 8;
const LEARNING_RATE = 0.001;
const MAX_ITERATIONS = 500;
const MIN_SAMPLES = 100; // minimum review events required to fit
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Frequency rank bucketed into [0, 10] — 10 = most common, 0 = unknown/rare */
function freqBucket(rank: number | null): number {
  if (rank === null) return 0;
  if (rank <= 100) return 10;
  if (rank <= 500) return 8;
  if (rank <= 1000) return 6;
  if (rank <= 3000) return 4;
  if (rank <= 10000) return 2;
  return 1;
}

function cefrIndex(level: string): number {
  const idx = CEFR_LEVELS.indexOf(level);
  return idx >= 0 ? idx : 0;
}

/**
 * Build a feature vector for an item + review history snapshot.
 * All features are log-transformed or normalized to keep gradients stable.
 */
export function buildFeatureVector(
  correctReviews: number,
  wrongReviews: number,
  daysSinceLast: number,
  frequencyRank: number | null,
  cefrLevel: string,
  partOfSpeech: string | null
): number[] {
  return [
    1, // bias term
    Math.log2(correctReviews + 1),
    Math.log2(wrongReviews + 1),
    Math.log2(Math.max(daysSinceLast, 0) + 1),
    Math.log2(freqBucket(frequencyRank) + 1),
    cefrIndex(cefrLevel) / 5, // normalized 0..1
    partOfSpeech === 'verb' ? 1 : 0,
    partOfSpeech === 'noun' ? 1 : 0
  ];
}

/** Dot product of two equal-length arrays */
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Estimate actual half-life from a review event.
 * h ≈ elapsedDays / log2(1 / r) where r = retrievability at time of review.
 * We approximate r from whether the review was correct (rating >= 2).
 * For correct reviews we use r = 0.5 as the boundary assumption;
 * for incorrect we use r = 0.2 (lower — the card was already well below threshold).
 */
function estimateHalfLife(elapsedDays: number, correct: boolean): number | null {
  if (elapsedDays <= 0) return null;
  const r = correct ? 0.5 : 0.2;
  const denom = Math.log2(1 / r);
  if (denom <= 0) return null;
  return Math.max(0.1, elapsedDays / denom);
}

/**
 * Fit HLR weights from the ReviewLog table using gradient descent.
 * Joins with Vocabulary to get real lexical features (frequency, CEFR level, POS).
 * Returns null if there is insufficient data.
 */
export async function fitHlrWeights(): Promise<HlrWeights | null> {
  // Fetch review logs with real vocabulary metadata via join.
  // We join itemId → Vocabulary when itemType = 'vocabulary'.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = await (prisma as unknown as Record<string, any>).reviewLog.findMany({
    where: {
      elapsedDays: { gt: 0 },
      itemType: 'vocabulary'
    },
    select: {
      rating: true,
      elapsedDays: true,
      stability: true,
      difficulty: true,
      itemId: true
    },
    take: 10_000,
    orderBy: { createdAt: 'desc' }
  });

  if (logs.length < MIN_SAMPLES) return null;

  // Collect unique vocabularyIds and batch-fetch their metadata in one query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vocabIds: string[] = [...new Set((logs as any[]).map((l) => l.itemId as string))];
  const vocabRows = await prisma.vocabulary.findMany({
    where: { id: { in: vocabIds } },
    select: { id: true, frequency: true, cefrLevel: true, partOfSpeech: true }
  });
  const vocabMeta = new Map(vocabRows.map((v) => [v.id, v]));

  type Sample = { features: number[]; actualHalfLife: number };
  const samples: Sample[] = [];

  for (const log of logs) {
    const correct = log.rating >= 2;
    const halfLife = estimateHalfLife(log.elapsedDays, correct);
    if (halfLife === null) continue;

    // Use real vocabulary metadata when available; fall back to proxy values
    // for review log rows whose vocabulary has since been deleted.
    const meta = vocabMeta.get(log.itemId);
    const correctProxy = Math.max(0, log.stability / 2);
    const wrongProxy = log.difficulty - 1;
    const features = buildFeatureVector(
      Math.round(correctProxy),
      Math.round(wrongProxy),
      log.elapsedDays,
      meta?.frequency ?? null,
      meta?.cefrLevel ?? 'A1',
      meta?.partOfSpeech ?? null
    );

    samples.push({ features, actualHalfLife: halfLife });
  }

  if (samples.length < MIN_SAMPLES) return null;

  // Gradient descent (MSE on log2 half-life)
  const theta = new Array(N_FEATURES).fill(0.1);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const grad = new Array(N_FEATURES).fill(0);
    let loss = 0;

    for (const { features, actualHalfLife } of samples) {
      const predicted = dot(theta, features);
      const actual = Math.log2(Math.max(actualHalfLife, 0.01));
      const err = predicted - actual;
      loss += err * err;
      for (let j = 0; j < N_FEATURES; j++) {
        grad[j] += (2 * err * features[j]) / samples.length;
      }
    }

    for (let j = 0; j < N_FEATURES; j++) {
      theta[j] -= LEARNING_RATE * grad[j];
    }

    // Early exit if loss is very small
    if (loss / samples.length < 1e-6) break;
  }

  return {
    theta,
    trainedAt: new Date().toISOString(),
    sampleSize: samples.length
  };
}

/**
 * Use fitted HLR weights to predict initial FSRS stability for a brand-new item.
 * Returns a stability value (days) that replaces the generic FSRS w[0..3] initialization.
 *
 * Called only when repetitions === 0 (first review). For subsequent reviews,
 * FSRS's own update equations take over.
 */
export function hlrInitialStability(
  frequencyRank: number | null,
  cefrLevel: string,
  partOfSpeech: string | null,
  weights: HlrWeights
): number {
  // For a brand-new item: 0 correct, 0 wrong, 0 days since last
  const features = buildFeatureVector(0, 0, 0, frequencyRank, cefrLevel, partOfSpeech);
  const logHalfLife = dot(weights.theta, features);
  const halfLifeDays = Math.pow(2, logHalfLife);

  // Convert half-life to FSRS stability:
  // At stability S, retrievability at time t is R(t) = (1 + t/9S)^-1
  // Half-life h satisfies R(h) = 0.5 → h = 9S(2^(1/1) - 1) = 9S
  // So S = h / 9
  const stability = Math.max(0.1, Math.min(halfLifeDays / 9, 30));
  return stability;
}

/**
 * Load HLR weights from SiteSettings. Returns null if not yet fitted.
 */
export async function loadHlrWeights(): Promise<HlrWeights | null> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (settings as any).hlrWeights;
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as HlrWeights);
  } catch {
    return null;
  }
}

/**
 * Fit and persist HLR weights to SiteSettings.
 * Fire-and-forget safe — designed to be called from maintenance.
 */
export async function runHlrFit(): Promise<void> {
  const weights = await fitHlrWeights();
  if (!weights) {
    console.log('[HLR] Insufficient data to fit weights — skipping.');
    return;
  }

  await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { id: 'singleton', loadTimeSamples: [], hlrWeights: JSON.stringify(weights) } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { hlrWeights: JSON.stringify(weights) } as any
  });

  console.log(
    `[HLR] Fitted weights from ${weights.sampleSize} samples. theta=${weights.theta.map((v) => v.toFixed(4)).join(', ')}`
  );
}
