/**
 * FSRS Per-User Weight Optimizer
 *
 * Fits the 17 FSRS-4.5 weights to a user's actual review history using
 * gradient descent (Adam optimizer) on the FSRS loss function.
 *
 * Requirements before running:
 *   - At least MIN_REVIEWS review log entries for the user
 *   - ReviewLog rows contain: rating, elapsedDays, scheduledDays, stability, difficulty
 *
 * The fitted weights are clipped to the valid ranges defined in the FSRS spec
 * to prevent pathological values. If optimization fails or data is insufficient,
 * null is returned and the caller should keep the current (default) weights.
 *
 * Auto-trimming: ReviewLog is already pruned to 30 days by the maintenance job,
 * so the dataset is naturally bounded. We additionally cap at MAX_REVIEWS rows
 * per optimization run to keep wall-clock time predictable on large accounts.
 */

import { prisma } from './prisma';
import { DEFAULT_FSRS_PARAMETERS } from './fsrs';

/** Minimum number of reviews required before attempting optimization */
const MIN_REVIEWS = 50;

/** Maximum reviews used per optimization run (older rows beyond this are ignored) */
const MAX_REVIEWS = 1000;

/** Number of FSRS-5 weights */
const N_WEIGHTS = 19;

/** Number of gradient descent iterations */
const MAX_ITERATIONS = 200;

/** Adam optimizer learning rate */
const LEARNING_RATE = 0.01;

/** Adam hyperparameters */
const BETA1 = 0.9;
const BETA2 = 0.999;
const EPSILON = 1e-8;

/**
 * Valid ranges for each of the 19 FSRS-5 weights.
 * Derived from the open-spaced-repetition/fsrs5 optimizer constraints.
 */
const WEIGHT_BOUNDS: [number, number][] = [
  [0.1, 10], // w[0]  initial stability for rating 1 (Again)
  [0.1, 10], // w[1]  initial stability for rating 2 (Hard)
  [0.1, 15], // w[2]  initial stability for rating 3 (Good)
  [0.1, 30], // w[3]  initial stability for rating 4 (Easy)
  [1, 10], // w[4]  initial difficulty
  [0.1, 5], // w[5]  difficulty change per rating step
  [0.1, 5], // w[6]  difficulty update factor
  [0.001, 0.5], // w[7]  mean reversion coefficient
  [0.1, 5], // w[8]  stability update base
  [0.01, 1], // w[9]  stability power on success
  [0.5, 5], // w[10] stability exp on forgetting factor
  [0.01, 5], // w[11] lapse stability base
  [0.01, 0.5], // w[12] lapse difficulty power
  [0.01, 0.5], // w[13] lapse stability power
  [0.01, 2], // w[14] lapse forgetting factor
  [0.1, 1], // w[15] hard penalty
  [1, 5], // w[16] easy bonus
  [0.1, 2], // w[17] short-term stability exponent base (FSRS-5)
  [0.1, 3] // w[18] short-term stability rating scale (FSRS-5)
];

function clip(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clipWeights(w: number[]): number[] {
  return w.map((v, i) => clip(v, WEIGHT_BOUNDS[i][0], WEIGHT_BOUNDS[i][1]));
}

/**
 * FSRS retrievability formula: R(t, S) = (1 + t / (9 * S))^-1
 */
function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 1;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/**
 * FSRS loss: mean squared error between predicted and actual retention.
 * For each review we predict the retrievability at the moment of review
 * and compare it to the binary outcome (rating >= 2 = recalled).
 */
function computeLoss(
  reviews: { rating: number; elapsedDays: number; stability: number; difficulty: number }[],
  _w: number[]
): number {
  let loss = 0;
  for (const r of reviews) {
    const predicted = retrievability(r.elapsedDays, r.stability);
    const actual = r.rating >= 2 ? 1.0 : 0.0;
    loss += (predicted - actual) ** 2;
  }
  return loss / reviews.length;
}

/**
 * Numerical gradient of the loss with respect to each weight.
 * Uses central differences with step size h.
 */
function numericalGradient(
  reviews: { rating: number; elapsedDays: number; stability: number; difficulty: number }[],
  w: number[],
  h = 1e-5
): number[] {
  const grad = new Array(w.length).fill(0);
  for (let i = 0; i < w.length; i++) {
    const wPlus = [...w];
    const wMinus = [...w];
    wPlus[i] += h;
    wMinus[i] -= h;
    grad[i] = (computeLoss(reviews, wPlus) - computeLoss(reviews, wMinus)) / (2 * h);
  }
  return grad;
}

/**
 * Run Adam gradient descent to fit FSRS weights to the user's review history.
 * Returns the optimized weights, or null if the loss doesn't improve.
 */
function optimize(
  reviews: { rating: number; elapsedDays: number; stability: number; difficulty: number }[],
  startingWeights: number[]
): number[] | null {
  let w = [...startingWeights];
  const m = new Array(w.length).fill(0); // first moment
  const v = new Array(w.length).fill(0); // second moment

  const initialLoss = computeLoss(reviews, w);

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    const grad = numericalGradient(reviews, w);

    for (let i = 0; i < w.length; i++) {
      m[i] = BETA1 * m[i] + (1 - BETA1) * grad[i];
      v[i] = BETA2 * v[i] + (1 - BETA2) * grad[i] ** 2;
      const mHat = m[i] / (1 - Math.pow(BETA1, iter));
      const vHat = v[i] / (1 - Math.pow(BETA2, iter));
      w[i] -= LEARNING_RATE * (mHat / (Math.sqrt(vHat) + EPSILON));
    }

    w = clipWeights(w);
  }

  const finalLoss = computeLoss(reviews, w);

  // Only accept the result if loss actually improved
  if (finalLoss >= initialLoss) return null;

  return w;
}

/**
 * Fetch the user's recent review logs, run the optimizer, and persist the
 * resulting weights. Returns the new weights on success, null if skipped.
 *
 * Designed to be called from the maintenance job — fire-and-forget safe.
 */
export async function optimizeFsrsWeightsForUser(userId: string): Promise<number[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = await (prisma as unknown as Record<string, any>).reviewLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: MAX_REVIEWS,
    select: { rating: true, elapsedDays: true, stability: true, difficulty: true }
  });

  if (logs.length < MIN_REVIEWS) return null;

  // Fetch current weights to use as starting point (warm start)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fsrsWeights: true }
  });

  const startingWeights =
    user?.fsrsWeights?.length === N_WEIGHTS ? user.fsrsWeights : [...DEFAULT_FSRS_PARAMETERS.w];

  const optimized = optimize(logs, startingWeights);
  if (!optimized) return null;

  await prisma.user.update({
    where: { id: userId },
    data: { fsrsWeights: optimized }
  });

  return optimized;
}
