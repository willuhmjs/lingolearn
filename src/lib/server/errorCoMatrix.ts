/**
 * Error Co-occurrence Matrix
 *
 * Tracks how often pairs of error types appear together within the same review
 * event (i.e. when the LLM reports two error types in a single answer).
 *
 * The matrix is stored as a symmetric count table:
 *   { wrong_case: { wrong_gender: 47, spelling: 12, ... }, ... }
 *
 * It is fitted daily by the maintenance job from UserVocabularyProgress and
 * UserGrammarRuleProgress `lastErrorType` fields (one scan of all users'
 * recent errors). Because individual review events don't carry multiple
 * simultaneous errors in the current schema, we use a sliding-window
 * co-occurrence: for each user, errors on different items within the same
 * calendar day are considered co-occurring (they likely stem from the same
 * session and the same underlying gap).
 *
 * Usage:
 *   - `buildErrorCoMatrix()` — called daily by maintenance
 *   - `getRelatedErrorTypes(errorType)` — returns a ranked list of error types
 *     that most frequently co-occur with the given type (descending count)
 *   - `loadErrorCoMatrix()` / `saveErrorCoMatrix()` — persistence helpers
 */

import { prisma } from './prisma';
import type { ErrorType } from './grader';
import { parseErrorCounts, getDominantErrors } from './errorCounts';

export type CoMatrix = Partial<Record<ErrorType, Partial<Record<ErrorType, number>>>>;

const ERROR_TYPES: ErrorType[] = [
	'wrong_case',
	'wrong_tense',
	'wrong_gender',
	'spelling',
	'word_order',
	'vocabulary_gap'
];

/**
 * Load the co-occurrence matrix from SiteSettings.
 * Returns an empty matrix if not yet fitted.
 */
export async function loadErrorCoMatrix(): Promise<CoMatrix> {
	const settings = await prisma.siteSettings.findUnique({ where: { id: 'singleton' } });
	if (!settings) return {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const raw = (settings as any).errorCoMatrix;
	if (!raw) return {};
	try {
		return typeof raw === 'string' ? JSON.parse(raw) : (raw as CoMatrix);
	} catch {
		return {};
	}
}

/**
 * Return error types ranked by co-occurrence count with the given type.
 * Excludes the input type itself. Returns [] if no data.
 */
export function getRelatedErrorTypes(matrix: CoMatrix, errorType: ErrorType): ErrorType[] {
	const row = matrix[errorType];
	if (!row) return [];
	return (Object.entries(row) as [ErrorType, number][])
		.sort((a, b) => b[1] - a[1])
		.map(([type]) => type);
}

/**
 * Build the co-occurrence matrix from recent progress records.
 *
 * Strategy: for each user, collect all items that have a non-null lastErrorType.
 * Treat every pair of error types present for that user as co-occurring once
 * (regardless of which item carried each error). This is a conservative
 * approximation — it over-counts slightly but requires no session-level data.
 */
export async function buildErrorCoMatrix(): Promise<CoMatrix> {
	// Fetch all rows that have either a lastErrorType or a non-null errorCounts vector.
	// errorCounts gives us persistent, decayed evidence across all past sessions —
	// far richer than lastErrorType which only captures the most recent review.
	const [vocabErrors, grammarErrors] = await Promise.all([
		prisma.userVocabularyProgress.findMany({
			where: { OR: [{ lastErrorType: { not: null } }, { errorCounts: { not: null } }] },
			select: { userId: true, lastErrorType: true, errorCounts: true }
		}),
		prisma.userGrammarRuleProgress.findMany({
			where: { OR: [{ lastErrorType: { not: null } }, { errorCounts: { not: null } }] },
			select: { userId: true, lastErrorType: true, errorCounts: true }
		})
	]);

	// Group error types by user, preferring the richer errorCounts vector when available.
	// getDominantErrors returns types whose decayed count exceeds 0.5 (≈1 error within
	// the last half-life), so stale ancient errors don't permanently inflate the matrix.
	const userErrors = new Map<string, Set<ErrorType>>();
	for (const row of [...vocabErrors, ...grammarErrors]) {
		const counts = parseErrorCounts(row.errorCounts);
		const dominant = getDominantErrors(counts);

		// Use errorCounts if we have any dominant errors; fall back to lastErrorType.
		const types: ErrorType[] =
			dominant.length > 0
				? dominant
				: row.lastErrorType && ERROR_TYPES.includes(row.lastErrorType as ErrorType)
					? [row.lastErrorType as ErrorType]
					: [];

		if (types.length === 0) continue;
		if (!userErrors.has(row.userId)) userErrors.set(row.userId, new Set());
		for (const et of types) userErrors.get(row.userId)!.add(et);
	}

	// Build symmetric co-occurrence counts
	const matrix: CoMatrix = {};

	for (const errors of userErrors.values()) {
		const types = Array.from(errors);
		for (let i = 0; i < types.length; i++) {
			for (let j = i + 1; j < types.length; j++) {
				const a = types[i];
				const b = types[j];
				if (!matrix[a]) matrix[a] = {};
				if (!matrix[b]) matrix[b] = {};
				matrix[a]![b] = (matrix[a]![b] ?? 0) + 1;
				matrix[b]![a] = (matrix[b]![a] ?? 0) + 1;
			}
		}
	}

	return matrix;
}

/**
 * Fit and persist the error co-occurrence matrix to SiteSettings.
 * Fire-and-forget safe — designed to be called from maintenance.
 */
export async function runErrorCoMatrixFit(): Promise<void> {
	const matrix = await buildErrorCoMatrix();
	const totalPairs = Object.values(matrix).reduce(
		(s, row) => s + Object.values(row ?? {}).reduce((rs, c) => rs + c, 0),
		0
	);

	if (totalPairs === 0) {
		console.log('[ErrorCoMatrix] No co-occurring errors found — skipping.');
		return;
	}

	await prisma.siteSettings.upsert({
		where: { id: 'singleton' },
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		create: { id: 'singleton', loadTimeSamples: [], errorCoMatrix: JSON.stringify(matrix) } as any,
		update: { errorCoMatrix: JSON.stringify(matrix) } as any
	});

	console.log(`[ErrorCoMatrix] Fitted matrix with ${totalPairs / 2} unique co-occurrence pairs.`);
}
