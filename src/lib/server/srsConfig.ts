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

	// All grammar rules at the current level must be KNOWN or MASTERED to level up
	GRAMMAR_MASTERY_THRESHOLD: 1.0,

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
	// XP awarded for correct answers by game mode
	CORRECT_ANSWER: {
		MULTIPLE_CHOICE: 5, // Easier mode = less XP
		OTHER_MODES: 10, // Translation, fill-in-blank, etc.
	},

	// Minimum score threshold to earn XP
	SCORE_THRESHOLD: 0.8, // 80% or higher
} as const;

// Gamification Configuration
export const GAMIFICATION_CONFIG = {
	// Throttle for lastActive updates (milliseconds)
	LAST_ACTIVE_THROTTLE_MS: 5 * 60 * 1000, // 5 minutes
} as const;

// Type exports for TypeScript
export type CefrLevel = (typeof CEFR_CONFIG.LEVELS)[number];
export type GameMode = keyof typeof ELO_CONFIG.K_MULTIPLIERS;
