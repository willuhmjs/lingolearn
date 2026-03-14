/**
 * FSRS (Free Spaced Repetition Scheduler) Algorithm Implementation
 * A modern, research-backed alternative to SM-2 with better retention predictions.
 *
 * Based on the FSRS-4.5 algorithm: https://github.com/open-spaced-repetition/fsrs4anki
 */

export interface FsrsCard {
	difficulty: number; // Range: [1, 10], higher = harder for the user
	stability: number; // Days until retrievability drops to 90%
	retrievability?: number; // Current memory strength [0, 1]
	lastReviewDate?: Date;
	repetitions: number; // Total number of reviews
	lapses: number; // Number of times forgotten
}

export interface FsrsReviewResult {
	card: FsrsCard;
	nextReviewDate: Date;
	interval: number; // Days until next review
	state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
}

export interface FsrsParameters {
	// Model parameters (optimized through research)
	w: number[]; // 17 weights
	requestRetention: number; // Target retention rate (default: 0.9)
	maximumInterval: number; // Max days between reviews (default: 365)
	easyBonus: number; // Multiplier for easy answers (default: 1.3)
	hardInterval: number; // Multiplier for hard answers (default: 1.2)
}

// Default FSRS-4.5 parameters (optimized for general learning)
export const DEFAULT_FSRS_PARAMETERS: FsrsParameters = {
	w: [
		0.4072, 1.1829, 3.1262, 15.4722, 7.2102,
		0.5316, 1.0651, 0.0234, 1.616, 0.1544,
		1.0824, 1.9813, 0.0953, 0.2975, 2.2042,
		0.2407, 2.9466
	],
	requestRetention: 0.9,
	maximumInterval: 365,
	easyBonus: 1.3,
	hardInterval: 1.2
};

/**
 * Rating scale:
 * 1 = Again (complete failure, need to relearn)
 * 2 = Hard (difficult but eventually recalled)
 * 3 = Good (recalled with normal effort)
 * 4 = Easy (recalled instantly and effortlessly)
 */
export type Rating = 1 | 2 | 3 | 4;

/**
 * Converts a 0-1 score to FSRS rating
 */
export function scoreToRating(score: number): Rating {
	if (score < 0.3) return 1; // Again
	if (score < 0.6) return 2; // Hard
	if (score < 0.9) return 3; // Good
	return 4; // Easy
}

/**
 * Initialize a new card with default FSRS values
 */
export function initializeFsrsCard(): FsrsCard {
	return {
		difficulty: 5, // Middle difficulty
		stability: 0,
		retrievability: 1,
		lastReviewDate: new Date(),
		repetitions: 0,
		lapses: 0
	};
}

/**
 * Calculate the initial difficulty based on rating
 */
function initDifficulty(rating: Rating, params: FsrsParameters): number {
	const { w } = params;
	const difficulty = w[4] - (rating - 3) * w[5];
	return Math.max(1, Math.min(10, difficulty));
}

/**
 * Calculate the initial stability based on rating
 */
function initStability(rating: Rating, params: FsrsParameters): number {
	const { w } = params;
	return Math.max(0.1, w[rating - 1]);
}

/**
 * Calculate retrievability (memory strength) based on elapsed time
 */
function calculateRetrievability(elapsedDays: number, stability: number): number {
	if (stability === 0) return 1;
	return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/**
 * Calculate next difficulty based on current difficulty and rating
 */
function nextDifficulty(difficulty: number, rating: Rating, params: FsrsParameters): number {
	const { w } = params;
	const delta = rating - 3;
	const difficultyChange = -w[6] * delta;
	const newDifficulty = difficulty + difficultyChange;

	// Mean reversion to prevent extreme values
	const meanReversion = w[7] * (5 - newDifficulty);
	const finalDifficulty = newDifficulty + meanReversion;

	return Math.max(1, Math.min(10, finalDifficulty));
}

/**
 * Calculate next stability for a review state card
 */
function nextStability(
	stability: number,
	difficulty: number,
	retrievability: number,
	rating: Rating,
	params: FsrsParameters
): number {
	const { w } = params;
	const hardPenalty = rating === 2 ? w[15] : 1;
	const easyBonus = rating === 4 ? w[16] : 1;

	const successFactor = 1 +
		Math.exp(w[8]) *
		(11 - difficulty) *
		Math.pow(stability, -w[9]) *
		(Math.exp((1 - retrievability) * w[10]) - 1) *
		hardPenalty *
		easyBonus;

	return stability * successFactor;
}

/**
 * Calculate next stability for a relearning state (after forgetting)
 */
function nextStabilityAfterLapse(
	stability: number,
	difficulty: number,
	retrievability: number,
	params: FsrsParameters
): number {
	const { w } = params;
	const lapseFactor = Math.exp(w[11]) *
		Math.pow(difficulty, -w[12]) *
		(Math.pow(stability, w[13]) - 1) *
		Math.exp((1 - retrievability) * w[14]);

	return Math.max(0.1, stability * lapseFactor);
}

/**
 * Calculate the interval until next review based on stability and desired retention
 */
function calculateInterval(stability: number, requestRetention: number): number {
	if (stability === 0) return 0.1;
	const interval = (9 * stability / requestRetention) * (Math.pow(requestRetention, 1 / 9) - 1);
	return Math.max(1, Math.round(interval));
}

/**
 * Review a card and get the updated state
 */
export function reviewCard(
	card: FsrsCard,
	rating: Rating,
	reviewDate: Date = new Date(),
	params: FsrsParameters = DEFAULT_FSRS_PARAMETERS
): FsrsReviewResult {
	const newCard = { ...card };

	// Calculate elapsed time since last review
	const elapsedDays = card.lastReviewDate
		? (reviewDate.getTime() - card.lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
		: 0;

	// Calculate current retrievability
	const retrievability = card.stability > 0
		? calculateRetrievability(elapsedDays, card.stability)
		: 1;

	// Determine state
	let state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING' = 'REVIEW';

	if (card.repetitions === 0) {
		// First time seeing this card
		state = 'NEW';
		newCard.difficulty = initDifficulty(rating, params);
		newCard.stability = initStability(rating, params);
		newCard.repetitions = 1;

		if (rating === 1) {
			state = 'LEARNING';
		}
	} else if (rating === 1) {
		// Forgot the card
		state = 'RELEARNING';
		newCard.difficulty = nextDifficulty(card.difficulty, rating, params);
		newCard.stability = nextStabilityAfterLapse(
			card.stability,
			card.difficulty,
			retrievability,
			params
		);
		newCard.lapses += 1;
		newCard.repetitions += 1;
	} else {
		// Successfully recalled
		state = newCard.lapses > 0 && newCard.repetitions < 3 ? 'RELEARNING' : 'REVIEW';
		newCard.difficulty = nextDifficulty(card.difficulty, rating, params);
		newCard.stability = nextStability(
			card.stability,
			card.difficulty,
			retrievability,
			rating,
			params
		);
		newCard.repetitions += 1;
	}

	// Calculate interval
	let interval = calculateInterval(newCard.stability, params.requestRetention);

	// Apply rating-specific modifiers
	if (rating === 2) {
		interval = Math.round(interval * params.hardInterval);
	} else if (rating === 4) {
		interval = Math.round(interval * params.easyBonus);
	}

	// Cap interval at maximum
	interval = Math.min(interval, params.maximumInterval);

	// Calculate next review date
	const nextReviewDate = new Date(reviewDate);
	nextReviewDate.setDate(nextReviewDate.getDate() + interval);

	newCard.lastReviewDate = reviewDate;
	newCard.retrievability = retrievability;

	return {
		card: newCard,
		nextReviewDate,
		interval,
		state
	};
}

/**
 * Get optimal intervals for all four rating options (for preview)
 */
export function getSchedulingInfo(
	card: FsrsCard,
	reviewDate: Date = new Date(),
	params: FsrsParameters = DEFAULT_FSRS_PARAMETERS
): Record<Rating, { interval: number; nextReviewDate: Date }> {
	const ratings: Rating[] = [1, 2, 3, 4];
	const result = {} as Record<Rating, { interval: number; nextReviewDate: Date }>;

	for (const rating of ratings) {
		const review = reviewCard(card, rating, reviewDate, params);
		result[rating] = {
			interval: review.interval,
			nextReviewDate: review.nextReviewDate
		};
	}

	return result;
}

/**
 * Derive SRS state from FSRS metrics
 */
export function deriveSrsStateFromFsrs(
	repetitions: number,
	stability: number,
	lapses: number
): 'UNSEEN' | 'LEARNING' | 'KNOWN' | 'MASTERED' {
	if (repetitions === 0) return 'UNSEEN';
	if (lapses > 0 && repetitions < 3) return 'LEARNING';
	if (repetitions >= 3 && stability >= 21) return 'MASTERED';
	if (repetitions >= 2) return 'KNOWN';
	return 'LEARNING';
}
