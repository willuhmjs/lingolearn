/**
 * Performance Factor Analysis (PFA) — Koedinger et al. 2012
 *
 * Fits three parameters per grammar rule from aggregate review history:
 *
 *   P(correct | user, rule) = logistic(γ_k + ρ_k · s_uk - δ_k · f_uk)
 *
 * where:
 *   γ_k  — baseline log-odds of correctness for rule k (higher = globally easier)
 *   ρ_k  — learning rate: log-odds gain per prior success on rule k
 *   δ_k  — forgetting rate: log-odds loss per prior failure on rule k
 *   s_uk — number of prior successful reviews of rule k by user u
 *   f_uk — number of prior failed reviews of rule k by user u
 *
 * The parameters are fitted per grammar rule across all users using gradient
 * descent on binary cross-entropy (correct/incorrect outcome per review event).
 *
 * The fitted parameters (γ, ρ, δ) are stored directly on the GrammarRule row.
 * At lesson generation time, the lesson selector uses P(correct) to:
 *   1. Prioritize rules with low P(correct) that are not yet due per FSRS
 *      (catching items the user is about to forget before FSRS notices)
 *   2. Annotate rules with their current difficulty signal in the prompt
 *
 * Data source: ReviewLog rows where itemType = 'grammar'.
 * Minimum reviews per rule required before fitting: PFA_MIN_REVIEWS_PER_RULE.
 */

import { prisma } from './prisma';

const LEARNING_RATE = 0.01;
const MAX_ITERATIONS = 300;
const PFA_MIN_REVIEWS_PER_RULE = 20; // minimum events per rule to fit reliably

/**
 * Exponential decay half-life for success/failure counts (in days).
 * Events older than ~4 half-lives (240 days) contribute < 7% weight.
 * This keeps PFA predictions responsive to recent performance rather than
 * accumulating stale evidence from months-old review sessions.
 */
const PFA_DECAY_HALF_LIFE_DAYS = 60;

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

interface ReviewEvent {
  correct: boolean;
  successesBefore: number; // s_uk: exponentially decayed prior successes
  failuresBefore: number; // f_uk: exponentially decayed prior failures
}

interface PfaParams {
  gamma: number;
  rho: number;
  delta: number;
}

/**
 * Fit PFA parameters for a single grammar rule from its review events.
 * Events must be ordered chronologically per user so successesBefore/failuresBefore
 * are correct running counts.
 */
function fitPfaForRule(events: ReviewEvent[]): PfaParams {
  let gamma = 0.0;
  let rho = 0.1;
  let delta = 0.1;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let dGamma = 0,
      dRho = 0,
      dDelta = 0;

    for (const ev of events) {
      const logit = gamma + rho * ev.successesBefore - delta * ev.failuresBefore;
      const p = logistic(logit);
      const y = ev.correct ? 1 : 0;
      const err = p - y; // gradient of cross-entropy w.r.t. logit

      dGamma += err;
      dRho += err * ev.successesBefore;
      dDelta += -err * ev.failuresBefore;
    }

    const n = events.length;
    gamma -= (LEARNING_RATE * dGamma) / n;
    rho -= (LEARNING_RATE * dRho) / n;
    delta -= (LEARNING_RATE * dDelta) / n;

    // Keep ρ and δ non-negative — negative learning/forgetting rates are non-sensical
    rho = Math.max(0, rho);
    delta = Math.max(0, delta);
  }

  return { gamma, rho, delta };
}

/**
 * Fit PFA parameters for all grammar rules that have sufficient review data,
 * and persist the results to the GrammarRule table.
 */
export async function runPfaFit(): Promise<void> {
  // Fetch all grammar review events from ReviewLog
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = await (prisma as unknown as Record<string, any>).reviewLog.findMany({
    where: { itemType: 'grammar' },
    select: { itemId: true, userId: true, rating: true, createdAt: true }, // createdAt required for time-decay
    orderBy: { createdAt: 'asc' } // chronological — required for running success/failure counts
  });

  if (logs.length === 0) {
    console.log('[PFA] No grammar review events found — skipping.');
    return;
  }

  // Group events by rule, building per-user exponentially decayed success/failure counts.
  // Map: ruleId → array of ReviewEvent
  const ruleEvents = new Map<string, ReviewEvent[]>();

  // Per-user running decayed counts: Map<ruleId+userId, {s, f, lastTs}>
  // s and f are floating-point decayed accumulators, not raw integer counts.
  const userCounts = new Map<string, { s: number; f: number; lastTs: number }>();

  const decayLambda = Math.LN2 / PFA_DECAY_HALF_LIFE_DAYS; // λ = ln2 / t½

  for (const log of logs) {
    const ruleId = log.itemId;
    const key = `${ruleId}:${log.userId}`;
    const ts = new Date(log.createdAt).getTime() / (1000 * 60 * 60 * 24); // days since epoch
    const state = userCounts.get(key) ?? { s: 0, f: 0, lastTs: ts };

    // Decay existing counts to the current timestamp before using them
    const dtDays = Math.max(0, ts - state.lastTs);
    const decayFactor = Math.exp(-decayLambda * dtDays);
    const decayedS = state.s * decayFactor;
    const decayedF = state.f * decayFactor;

    const correct = log.rating >= 2;

    const event: ReviewEvent = {
      correct,
      successesBefore: decayedS,
      failuresBefore: decayedF
    };

    if (!ruleEvents.has(ruleId)) ruleEvents.set(ruleId, []);
    ruleEvents.get(ruleId)!.push(event);

    // Add this outcome to the decayed accumulator, advance timestamp
    userCounts.set(key, {
      s: decayedS + (correct ? 1 : 0),
      f: decayedF + (correct ? 0 : 1),
      lastTs: ts
    });
  }

  // Fit PFA for each rule with sufficient data and persist
  let fitted = 0;
  let skipped = 0;
  const updates: Promise<unknown>[] = [];

  for (const [ruleId, events] of ruleEvents) {
    if (events.length < PFA_MIN_REVIEWS_PER_RULE) {
      skipped++;
      continue;
    }

    const params = fitPfaForRule(events);
    updates.push(
      prisma.grammarRule
        .update({
          where: { id: ruleId },
          data: {
            pfaGamma: params.gamma,
            pfaRho: params.rho,
            pfaDelta: params.delta
          }
        })
        .catch((err: unknown) => {
          console.error(`[PFA] Failed to update rule ${ruleId}:`, err);
        })
    );
    fitted++;
  }

  await Promise.all(updates);

  // Record the last PFA fit time on SiteSettings
  await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { id: 'singleton', loadTimeSamples: [], pfaUpdatedAt: new Date() } as any,
    update: { pfaUpdatedAt: new Date() }
  });

  console.log(
    `[PFA] Fit complete: ${fitted} rules fitted, ${skipped} skipped (< ${PFA_MIN_REVIEWS_PER_RULE} events)`
  );
}

/**
 * Compute P(correct on next attempt) for a user on a given grammar rule using
 * the rule's fitted PFA parameters and the user's accumulated success/failure counts.
 *
 * Returns null if the rule has no fitted PFA params yet.
 */
export function pfaPredictCorrect(
  pfaGamma: number | null,
  pfaRho: number | null,
  pfaDelta: number | null,
  userSuccesses: number,
  userFailures: number
): number | null {
  if (pfaGamma === null || pfaRho === null || pfaDelta === null) return null;
  return logistic(pfaGamma + pfaRho * userSuccesses - pfaDelta * userFailures);
}
