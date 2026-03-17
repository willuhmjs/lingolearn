/**
 * Centralized configuration for Spaced Repetition System (SRS) and CEFR level progression.
 * All tuning parameters are defined here for easy adjustment and consistency.
 */

// ELO Rating System Configuration
export const ELO_CONFIG = {
  // Mode weights: scale the Bayesian ELO update by task difficulty.
  // Higher weight = more evidence from a correct answer.
  K_MULTIPLIERS: {
    MULTIPLE_CHOICE: 0.5, // Recognition task — less evidence than production
    TARGET_TO_NATIVE: 0.5, // Translation to native — recognition
    NATIVE_TO_TARGET: 1.2, // Production in target language — strongest signal
    FILL_BLANK: 1.0 // Default
  },

  // Default starting ELO rating
  DEFAULT_ELO: 1000
} as const;

// CEFR Level Configuration
export const CEFR_CONFIG = {
  // CEFR level names in order
  LEVELS: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const,

  // Base ELO difficulty for each CEFR level (used for vocabulary/grammar)
  BASE_ELO: {
    A1: 1000,
    A2: 1200,
    B1: 1400,
    B2: 1600,
    C1: 1800,
    C2: 2000
  } as const,

  // Target average ELO to advance to next level
  ELO_TARGETS: {
    A1: 1150,
    A2: 1350,
    B1: 1550,
    B2: 1750,
    C1: 1950
  } as const,

  // Number of top-frequency vocab words at each level that must be KNOWN/MASTERED to level up.
  // The lesson generator surfaces words in corpus-frequency order (ASC), so users encounter
  // these before any AI-generated enrichment words. The gate is immune to DB growth: adding
  // new AI-generated words doesn't change which words rank highest by corpus frequency.
  VOCAB_FREQ_GATE: {
    A1: 50,
    A2: 60,
    B1: 70,
    B2: 80,
    C1: 90
  } as const,

  // Percentage of interacted grammar rules that must be KNOWN/MASTERED to level up.
  GRAMMAR_MASTERY_THRESHOLD: 0.9,

  // Minimum number of grammar rules at the current level the user must have interacted with
  // before the mastery threshold applies. Prevents levelling up without ever touching grammar.
  // Self-sizing: if the level has fewer rules than this, all of them are required.
  GRAMMAR_MIN_INTERACTION: 3,

  // ELO decay configuration (for items not reviewed recently)
  DECAY: {
    THRESHOLD_DAYS: 30, // Items not reviewed for this many days will decay
    RATE: 0.05 // 5% decay toward baseline per decay period
  }
} as const;

// XP Rewards Configuration
export const XP_CONFIG = {
  // Base XP awarded for correct answers by game mode
  CORRECT_ANSWER: {
    MULTIPLE_CHOICE: 5, // Easier mode = less XP
    OTHER_MODES: 10 // Translation, fill-in-blank, etc.
  },

  // Bonus XP multiplier per CEFR level above A1 (stacks: A2=+1, B1=+2, etc.)
  LEVEL_BONUS_PER_CEFR_TIER: 2,

  // XP awarded when the user levels up to a new CEFR level
  LEVEL_UP_BONUS: {
    A2: 100,
    B1: 200,
    B2: 350,
    C1: 500,
    C2: 750
  },

  // Minimum score threshold to earn XP
  SCORE_THRESHOLD: 0.8 // 80% or higher
} as const;

// Lesson Generation Configuration
export const LESSON_CONFIG = {
  // Maximum size of the LEARNING vocabulary pool
  LEARNING_POOL_MAX: 6,
  // Replenish pool when it drops below this count
  LEARNING_POOL_MIN: 3,
  // How many words to surface per lesson from the learning pool
  LESSON_VOCAB_MAX: 6,
  // Adaptive new-word cap bounds. The actual daily cap floats between these values
  // based on the user's recent session success EMA (see computeAdaptiveNewWordCap).
  NEW_WORDS_PER_DAY_CAP_MIN: 5,
  NEW_WORDS_PER_DAY_CAP_MAX: 20,
  // EMA smoothing factor α for session success rate updates.
  // α = 0.2 → each session contributes 20% weight; prior ~5 sessions dominate.
  SESSION_SUCCESS_EMA_ALPHA: 0.2,
  // Number of due MASTERED vocab items to interleave into each lesson.
  // Research (Kornell & Bjork 2008) shows mixed practice improves long-term retention
  // over blocked (same-state-only) practice. Kept small so new learning isn't crowded out.
  INTERLEAVE_MASTERED_COUNT: 2
} as const;

/**
 * Compute the per-day new-word cap from the user's recent session success EMA.
 *
 * A success EMA near 1.0 → user is sailing through material → raise the cap.
 * A success EMA near 0.0 → user is struggling → lower the cap to reduce overload.
 *
 * The cap is linearly interpolated between MIN and MAX:
 *   cap = MIN + (MAX - MIN) * ema
 *
 * Example (MIN=5, MAX=20):
 *   ema=0.9 → cap=18  (strong performer, push the pace)
 *   ema=0.75 → cap=16 (default / neutral)
 *   ema=0.5 → cap=12  (struggling, slow down)
 *   ema=0.3 → cap=9   (significant difficulty, protect working memory)
 */
export function computeAdaptiveNewWordCap(sessionSuccessEma: number): number {
  const ema = Math.max(0, Math.min(1, sessionSuccessEma));
  const raw =
    LESSON_CONFIG.NEW_WORDS_PER_DAY_CAP_MIN +
    (LESSON_CONFIG.NEW_WORDS_PER_DAY_CAP_MAX - LESSON_CONFIG.NEW_WORDS_PER_DAY_CAP_MIN) * ema;
  return Math.round(raw);
}

/**
 * Update the session success EMA after a lesson answer is graded.
 * @param currentEma The stored EMA value [0, 1]
 * @param wasCorrect Whether this answer was correct (score >= 0.5)
 * @returns Updated EMA value
 */
export function updateSessionSuccessEma(currentEma: number, wasCorrect: boolean): number {
  const outcome = wasCorrect ? 1.0 : 0.0;
  return currentEma + LESSON_CONFIG.SESSION_SUCCESS_EMA_ALPHA * (outcome - currentEma);
}

// ---------------------------------------------------------------------------
// Thompson-sampling bandit for interleave count selection
// ---------------------------------------------------------------------------

/**
 * Maximum number of MASTERED items the bandit may choose to interleave.
 * Arms are indexed 0..MAX_INTERLEAVE (arm k = interleave k items).
 */
export const MAX_INTERLEAVE = 4;

export interface BanditArm {
  alpha: number; // Beta distribution shape — successes + 1
  beta: number; // Beta distribution shape — failures + 1
}

export interface BanditState {
  arms: BanditArm[]; // one per possible interleave count (0..MAX_INTERLEAVE)
}

/** Parse stored JSON into BanditState, falling back to uninformative priors. */
export function parseBanditState(raw: string | null | undefined): BanditState {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.arms) && parsed.arms.length === MAX_INTERLEAVE + 1) {
        return parsed as BanditState;
      }
    } catch {
      // fall through to default
    }
  }
  // Uninformative Beta(1,1) priors — every arm equally likely to be best.
  return { arms: Array.from({ length: MAX_INTERLEAVE + 1 }, () => ({ alpha: 1, beta: 1 })) };
}

/**
 * Sample a Beta(α, β) random variate using the Johnk method.
 * Pure TS — no external library required.
 */
function sampleBeta(alpha: number, beta: number): number {
  // Johnk's method: sample X~Gamma(α,1), Y~Gamma(β,1), return X/(X+Y)
  // For small integer-ish α,β, Gamma can be sampled via the log-sum-of-uniforms trick.
  const gammaApprox = (shape: number): number => {
    // Marsaglia–Tsang's method approximation for shape >= 1
    if (shape < 1) return gammaApprox(1 + shape) * Math.pow(Math.random(), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = (Math.random() * 2 - 1) * 3; // rough normal approximation via Box-Muller is better, but this converges
        // Use Box-Muller for a proper normal sample
        const u1 = Math.random();
        const u2 = Math.random();
        x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const x = gammaApprox(alpha);
  const y = gammaApprox(beta);
  return x / (x + y);
}

/**
 * Thompson-sample the bandit to pick how many MASTERED items to interleave.
 * Returns an integer in [0, MAX_INTERLEAVE].
 */
export function thompsonSampleInterleave(state: BanditState): number {
  let bestArm = 0;
  let bestSample = -Infinity;
  for (let k = 0; k <= MAX_INTERLEAVE; k++) {
    const { alpha, beta } = state.arms[k];
    const sample = sampleBeta(alpha, beta);
    if (sample > bestSample) {
      bestSample = sample;
      bestArm = k;
    }
  }
  return bestArm;
}

/**
 * Update the bandit posterior for the chosen arm after observing an outcome.
 * @param state Current bandit state
 * @param arm The arm that was played (interleave count used)
 * @param wasCorrect Whether the answer for that lesson was correct (score >= 0.5)
 * @returns Updated BanditState (immutable — returns new object)
 */
export function updateBandit(state: BanditState, arm: number, wasCorrect: boolean): BanditState {
  const newArms = state.arms.map((a, i) =>
    i === arm ? { alpha: a.alpha + (wasCorrect ? 1 : 0), beta: a.beta + (wasCorrect ? 0 : 1) } : a
  );
  return { arms: newArms };
}

// Gamification Configuration
export const GAMIFICATION_CONFIG = {
  // Throttle for lastActive updates (milliseconds)
  LAST_ACTIVE_THROTTLE_MS: 5 * 60 * 1000 // 5 minutes
} as const;

// Type exports for TypeScript
export type CefrLevel = (typeof CEFR_CONFIG.LEVELS)[number];
export type GameMode = keyof typeof ELO_CONFIG.K_MULTIPLIERS;

/**
 * Compute XP to award for a correct answer.
 * Base amount scales up by LEVEL_BONUS_PER_CEFR_TIER for each CEFR tier above A1,
 * rewarding higher-level learners more for the same effort.
 *
 * Example (OTHER_MODES base = 10, bonus = 2):
 *   A1 → 10, A2 → 12, B1 → 14, B2 → 16, C1 → 18, C2 → 20
 */
export function computeAnswerXp(baseXp: number, cefrLevel: string): number {
  const tierIndex = CEFR_CONFIG.LEVELS.indexOf(cefrLevel as CefrLevel);
  const tier = tierIndex >= 0 ? tierIndex : 0;
  return baseXp + tier * XP_CONFIG.LEVEL_BONUS_PER_CEFR_TIER;
}

/**
 * XP bonus for levelling up to a new CEFR level. Returns 0 if the level has no bonus.
 */
export function levelUpXp(newLevel: string): number {
  return XP_CONFIG.LEVEL_UP_BONUS[newLevel as keyof typeof XP_CONFIG.LEVEL_UP_BONUS] ?? 0;
}
