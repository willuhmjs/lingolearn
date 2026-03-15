/**
 * Fuzzy matching helpers for pre-checking answers before calling the LLM.
 * Uses token Jaccard similarity (multiset/bag-of-words, handles word reordering/paraphrasing)
 * and normalized Levenshtein distance (catches near-identical strings with minor typos).
 *
 * Only returns true when confidence is high — conservative thresholds to avoid false positives.
 */

import { stemmer as germanStemmer } from '@orama/stemmers/german';

/**
 * Reduce a normalised (already ASCII-lowercased by normalizeForFuzzy) word to
 * its approximate stem for token comparison.
 *
 * normalizeForFuzzy has already converted ß→ss, ä→ae, ö→oe, ü→ue, so both
 * the user input and the reference are in the same ASCII space before we reach
 * here. Snowball operates on that same ASCII space, so stems from user and
 * reference are directly comparable without umlaut restoration.
 */
function stemForComparison(word: string): string {
	return germanStemmer(word);
}

function normalizeForFuzzy(text: string): string {
	return text
		.toLowerCase()
		// Normalize German special characters so "ß"/"ss", "ä"/"ae", etc. compare equal
		.replace(/ß/g, 'ss')
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/[^\w\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function tokenize(text: string): string[] {
	return text.split(' ').filter(Boolean).map(stemForComparison);
}

/**
 * Multiset (bag-of-words) Jaccard similarity.
 * Unlike set-based Jaccard, duplicate tokens are counted, so "ich ich" ≠ "ich".
 */
function jaccardSimilarity(a: string[], b: string[]): number {
	if (a.length === 0 && b.length === 0) return 1;
	if (a.length === 0 || b.length === 0) return 0;

	const countA = new Map<string, number>();
	const countB = new Map<string, number>();
	for (const w of a) countA.set(w, (countA.get(w) ?? 0) + 1);
	for (const w of b) countB.set(w, (countB.get(w) ?? 0) + 1);

	let intersection = 0;
	for (const [w, ca] of countA) {
		intersection += Math.min(ca, countB.get(w) ?? 0);
	}
	const union = a.length + b.length - intersection;
	return intersection / union;
}

function levenshteinSimilarity(a: string, b: string): number {
	if (a === b) return 1;
	const maxLen = Math.max(a.length, b.length);
	if (maxLen === 0) return 1;
	// Guard against very long strings where O(n*m) would be expensive
	if (maxLen > 500) return 0;
	const m = a.length,
		n = b.length;
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= m; i++) {
		const curr = [i];
		for (let j = 1; j <= n; j++) {
			curr[j] =
				a[i - 1] === b[j - 1]
					? prev[j - 1]
					: 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
		}
		prev = curr;
	}
	return 1 - prev[n] / maxLen;
}

/**
 * Returns true if the user's answer is clearly correct without needing LLM grading.
 * - Exact match after normalization → true
 * - Multiset token Jaccard ≥ threshold (scales with sentence length) → true
 * - Normalized Levenshtein similarity ≥ 0.92 (near-identical strings) → true
 *
 * Jaccard threshold scales with reference token count so that short sentences
 * (where one wrong word has high impact) require higher precision than long ones.
 */
export function isClearlyCorrect(userAnswer: string, referenceAnswer: string): boolean {
	const normUser = normalizeForFuzzy(userAnswer);
	const normRef = normalizeForFuzzy(referenceAnswer);

	if (normUser === normRef) return true;

	const userTokens = tokenize(normUser);
	const refTokens = tokenize(normRef);

	// Scale Jaccard threshold down for longer sentences:
	// ≤3 tokens → 0.90, 4–6 tokens → 0.85, 7+ tokens → 0.80
	const len = refTokens.length;
	const jaccardThreshold = len <= 3 ? 0.90 : len <= 6 ? 0.85 : 0.80;

	if (jaccardSimilarity(userTokens, refTokens) >= jaccardThreshold) return true;
	if (levenshteinSimilarity(normUser, normRef) >= 0.92) return true;

	return false;
}

/**
 * Returns true if the user's answer is clearly wrong and can skip the LLM entirely.
 * - Empty or whitespace-only input → true
 * - Levenshtein similarity ≤ 0.15 (almost nothing in common character-wise) → true
 * - Jaccard token overlap = 0 (zero shared content words) → true
 *
 * Only triggers when confidence is high to avoid false negatives.
 */
export function isClearlyWrong(userAnswer: string, referenceAnswer: string): boolean {
	const trimmed = userAnswer.trim();
	if (!trimmed) return true;

	const normUser = normalizeForFuzzy(trimmed);
	const normRef = normalizeForFuzzy(referenceAnswer);

	// Guard: very short inputs (1-2 chars) can't be meaningfully judged as wrong
	if (normUser.length <= 2) return false;

	if (levenshteinSimilarity(normUser, normRef) <= 0.15) return true;

	const userTokens = tokenize(normUser);
	const refTokens = tokenize(normRef);
	if (jaccardSimilarity(userTokens, refTokens) === 0) return true;

	return false;
}
