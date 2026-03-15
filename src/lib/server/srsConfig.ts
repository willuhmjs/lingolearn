/**
 * Centralized configuration for Spaced Repetition System (SRS) and CEFR level progression.
 * All tuning parameters are defined here for easy adjustment and consistency.
 */

// ELO Rating System Configuration
export const ELO_CONFIG = {
	// K-factor determines how much ratings change per game
	K_FACTOR: 96,

	// K-factor multipliers by game mode (affects learning evidence weight)
	K_MULTIPLIERS: {
		MULTIPLE_CHOICE: 0.5, // Recognition tasks provide less evidence
		TARGET_TO_NATIVE: 0.5, // Translation from target to native (recognition)
		NATIVE_TO_TARGET: 1.2, // Production into target language (most difficult)
		FILL_BLANK: 1.0, // Default multiplier
	},

	// K-factor decay: reduces sensitivity as the user accumulates repetitions.
	// Effective K = max(K_MIN, K_FACTOR - repetitions * K_DECAY_PER_REP)
	// This keeps new learners responsive while stabilising experienced users.
	K_DECAY_PER_REP: 1.5,
	K_MIN: 24,

	// Default starting ELO ratings
	DEFAULT_ELO: 1000,
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
		C2: 2000,
	} as const,

	// Target average ELO to advance to next level
	ELO_TARGETS: {
		A1: 1150,
		A2: 1350,
		B1: 1550,
		B2: 1750,
		C1: 1950,
	} as const,

	// Minimum percentage of encountered vocabulary that must be KNOWN or MASTERED to level up
	VOCAB_MASTERY_THRESHOLD: 0.8,

	// Percentage of grammar rules the user has INTERACTED with that must be KNOWN or MASTERED to level up.
	// Uses interacted rules as denominator (not all DB rules) so unencountered rules don't block progress.
	GRAMMAR_MASTERY_THRESHOLD: 0.9,

	// Minimum number of words a user must have encountered (non-UNSEEN) at a level
	// before they can level up. Prevents levelling up on a tiny sample of words.
	MIN_ENCOUNTERED_VOCAB: 10,

	// ELO decay configuration (for items not reviewed recently)
	DECAY: {
		THRESHOLD_DAYS: 30, // Items not reviewed for this many days will decay
		RATE: 0.05, // 5% decay toward baseline per decay period
	},
} as const;

// XP Rewards Configuration
export const XP_CONFIG = {
	// Base XP awarded for correct answers by game mode
	CORRECT_ANSWER: {
		MULTIPLE_CHOICE: 5, // Easier mode = less XP
		OTHER_MODES: 10, // Translation, fill-in-blank, etc.
	},

	// Bonus XP multiplier per CEFR level above A1 (stacks: A2=+1, B1=+2, etc.)
	LEVEL_BONUS_PER_CEFR_TIER: 2,

	// XP awarded when the user levels up to a new CEFR level
	LEVEL_UP_BONUS: {
		A2: 100,
		B1: 200,
		B2: 350,
		C1: 500,
		C2: 750,
	},

	// Minimum score threshold to earn XP
	SCORE_THRESHOLD: 0.8, // 80% or higher
} as const;

// Lesson Generation Configuration
export const LESSON_CONFIG = {
	// Maximum size of the LEARNING vocabulary pool
	LEARNING_POOL_MAX: 6,
	// Replenish pool when it drops below this count
	LEARNING_POOL_MIN: 3,
	// How many words to surface per lesson from the learning pool
	LESSON_VOCAB_MAX: 6,
	// Maximum number of brand-new (UNSEEN) words that can be introduced per calendar day.
	// Prevents working-memory overload for motivated users doing many lessons in a row.
	NEW_WORDS_PER_DAY_CAP: 10,
	// Number of due MASTERED vocab items to interleave into each lesson.
	// Research (Kornell & Bjork 2008) shows mixed practice improves long-term retention
	// over blocked (same-state-only) practice. Kept small so new learning isn't crowded out.
	INTERLEAVE_MASTERED_COUNT: 2,
} as const;

// Gamification Configuration
export const GAMIFICATION_CONFIG = {
	// Throttle for lastActive updates (milliseconds)
	LAST_ACTIVE_THROTTLE_MS: 5 * 60 * 1000, // 5 minutes
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
