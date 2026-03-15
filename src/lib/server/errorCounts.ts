/**
 * Persistent Error-Type Count Vector
 *
 * Replaces the single `lastErrorType` field with a per-item decayed count
 * vector that accumulates evidence across all review sessions, not just the
 * most recent one.
 *
 * Structure (stored as JSON in the `errorCounts` DB column):
 *   { wrong_case: 2.4, wrong_gender: 1.1, spelling: 0.3, ... }
 *
 * Each review event:
 *   1. Decays all existing counts toward zero using exponential decay
 *      (half-life = DECAY_HALF_LIFE_DAYS). Events older than ~4 half-lives
 *      contribute < 7% of their original weight.
 *   2. Increments the count for any error types observed in this review.
 *      A correct answer (no error type) still decays the vector but adds nothing.
 *
 * Reading:
 *   - `getDominantErrors(counts, threshold)` — returns error types whose
 *     decayed count exceeds a threshold, ranked by count descending.
 *     Used by lesson generation and the error co-occurrence matrix to get
 *     a richer, time-weighted picture of the user's persistent weaknesses.
 */

import type { ErrorType } from './grader';

export type ErrorCountVector = Partial<Record<ErrorType, number>>;

/** Exponential decay half-life in days. ~4 half-lives ≈ 120 days of memory. */
const DECAY_HALF_LIFE_DAYS = 30;
const DECAY_LAMBDA = Math.LN2 / DECAY_HALF_LIFE_DAYS;

/** Minimum count to retain in storage — prune near-zero entries to keep JSON small. */
const PRUNE_THRESHOLD = 0.05;

/**
 * Parse a stored JSON string into an ErrorCountVector.
 * Returns an empty object on null or invalid JSON.
 */
export function parseErrorCounts(raw: string | null | undefined): ErrorCountVector {
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
			return parsed as ErrorCountVector;
		}
	} catch {
		// fall through
	}
	return {};
}

/**
 * Decay all counts in the vector based on elapsed days since the last review.
 * Prunes entries below PRUNE_THRESHOLD to keep the JSON footprint small.
 */
function decayCounts(counts: ErrorCountVector, elapsedDays: number): ErrorCountVector {
	if (elapsedDays <= 0) return counts;
	const factor = Math.exp(-DECAY_LAMBDA * elapsedDays);
	const result: ErrorCountVector = {};
	for (const [key, value] of Object.entries(counts) as [ErrorType, number][]) {
		const decayed = (value ?? 0) * factor;
		if (decayed >= PRUNE_THRESHOLD) {
			result[key] = decayed;
		}
	}
	return result;
}

/**
 * Update the error count vector for a single review event.
 *
 * @param currentCounts  The stored vector (from parseErrorCounts)
 * @param lastReviewDate The date of the previous review (for decay calculation)
 * @param errorType      The error type observed this review, or null if correct
 * @param reviewDate     The date of this review (defaults to now)
 * @returns Updated vector, serialized as JSON for storage
 */
export function updateErrorCounts(
	currentCounts: ErrorCountVector,
	lastReviewDate: Date | null,
	errorType: ErrorType | null,
	reviewDate: Date = new Date()
): string {
	const elapsedDays = lastReviewDate
		? (reviewDate.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
		: 0;

	// Decay existing counts
	const decayed = decayCounts(currentCounts, elapsedDays);

	// Increment the count for the observed error type
	if (errorType) {
		decayed[errorType] = (decayed[errorType] ?? 0) + 1;
	}

	return JSON.stringify(decayed);
}

/**
 * Return error types whose decayed count exceeds `threshold`, ranked by
 * count descending. Default threshold = 0.5 (equivalent to ~1 error within
 * the last half-life).
 */
export function getDominantErrors(
	counts: ErrorCountVector,
	threshold = 0.5
): ErrorType[] {
	return (Object.entries(counts) as [ErrorType, number][])
		.filter(([, v]) => v >= threshold)
		.sort((a, b) => b[1] - a[1])
		.map(([k]) => k);
}
