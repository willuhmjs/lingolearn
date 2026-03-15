/**
 * Onboarding placement quiz — grade a completed round.
 *
 * Receives the answers for one CEFR level round, computes the score,
 * seeds SRS state for answered vocab/grammar items, then returns:
 *   - `advance: true`  → client should fetch the next level's round
 *   - `readyForChat: true` → client should start the short post-quiz AI chat
 *     (placement is tentative; chat can nudge it ±1 level)
 *
 * Scoring thresholds:
 *   ≥ 75 % correct  → advance to next level
 *   50–74 %         → stop, place at this level, go to chat
 *   < 50 %          → stop, place at previous level (or A1), go to chat
 *
 * SRS seeding (only on finalize, not on advance — we want real study to seed
 * passed levels properly via applyGrammarMasteryForLevel):
 *   Correct vocab → KNOWN
 *   Wrong vocab   → LEARNING
 *   Grammar handled the same way
 */

import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestEvent } from './$types';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type CefrLevel = (typeof CEFR_LEVELS)[number];

const ADVANCE_THRESHOLD = 0.75;
const DROP_THRESHOLD = 0.5;

function prevLevel(level: string): CefrLevel {
	const idx = CEFR_LEVELS.indexOf(level as CefrLevel);
	return idx > 0 ? CEFR_LEVELS[idx - 1] : 'A1';
}

function nextLevel(level: string): CefrLevel | null {
	const idx = CEFR_LEVELS.indexOf(level as CefrLevel);
	return idx >= 0 && idx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[idx + 1] : null;
}

export async function POST({ request, locals }: RequestEvent) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const activeLanguage = locals.user.activeLanguage;
	if (!activeLanguage) {
		return json({ error: 'Active language is required' }, { status: 400 });
	}

	const langId = activeLanguage.id;

	const body = await request.json().catch(() => ({}));

	/**
	 * Expected body shape:
	 * {
	 *   level: string,           // the level just tested
	 *   totalQuestions: number,
	 *   correctCount: number,
	 *   // Items graded at this level — used for SRS seeding on finalize
	 *   vocabResults: Array<{ vocabId: string; correct: boolean }>,
	 *   grammarResults: Array<{ grammarRuleId: string; correct: boolean }>,
	 *   // Accumulated quiz context for the post-quiz chat prompt
	 *   quizSummary: {
	 *     levelsAttempted: string[],
	 *     scoresByLevel: Record<string, number>,  // pct 0-1
	 *     wrongVocabLemmas: string[],
	 *     wrongGrammarTitles: string[],
	 *   }
	 * }
	 */

	const level: string = CEFR_LEVELS.includes(body.level) ? body.level : 'A1';
	const totalQuestions: number = Math.max(1, Number(body.totalQuestions) || 1);
	const correctCount: number = Math.min(Number(body.correctCount) || 0, totalQuestions);
	const score = correctCount / totalQuestions;

	const vocabResults: Array<{ vocabId: string; correct: boolean }> = Array.isArray(
		body.vocabResults
	)
		? body.vocabResults
		: [];
	const grammarResults: Array<{ grammarRuleId: string; correct: boolean }> = Array.isArray(
		body.grammarResults
	)
		? body.grammarResults
		: [];
	const quizSummary = body.quizSummary ?? {};

	const BASE_ELO: Record<string, number> = {
		A1: 1000,
		A2: 1200,
		B1: 1400,
		B2: 1600,
		C1: 1800,
		C2: 2000
	};
	const startingElo = BASE_ELO[level] ?? 1000;

	// ── Advance or stop? ──────────────────────────────────────────────────────
	const next = nextLevel(level);
	const shouldAdvance = score >= ADVANCE_THRESHOLD && next !== null;

	if (shouldAdvance) {
		// Don't seed SRS yet — we're still climbing levels.
		// Just tell the client to fetch the next level round.
		return json({
			level,
			score,
			correctCount,
			totalQuestions,
			advance: true,
			nextLevel: next,
			readyForChat: false
		});
	}

	// ── Finalize placement ────────────────────────────────────────────────────
	// Determine tentative placed level
	const tentativeLevel: CefrLevel =
		score < DROP_THRESHOLD ? prevLevel(level) : (level as CefrLevel);

	// Seed SRS for vocab answered in this round
	if (vocabResults.length > 0) {
		const vocabIds = vocabResults.map((r) => r.vocabId);
		const existingUserVocab = await prisma.userVocabulary.findMany({
			where: { userId, vocabularyId: { in: vocabIds } },
			select: { vocabularyId: true }
		});
		const existingSet = new Set(existingUserVocab.map((v) => v.vocabularyId));

		await Promise.allSettled(
			vocabResults.map((r) => {
				const srsState = r.correct ? ('KNOWN' as const) : ('LEARNING' as const);
				if (existingSet.has(r.vocabId)) {
					return prisma.userVocabulary.update({
						where: { userId_vocabularyId: { userId, vocabularyId: r.vocabId } },
						data: { srsState }
					});
				} else {
					return prisma.userVocabulary.create({
						data: { userId, vocabularyId: r.vocabId, srsState, eloRating: startingElo }
					});
				}
			})
		);
	}

	// Seed SRS for grammar answered in this round
	if (grammarResults.length > 0) {
		const grammarIds = grammarResults.map((r) => r.grammarRuleId);
		const existingUserGrammar = await prisma.userGrammarRule.findMany({
			where: { userId, grammarRuleId: { in: grammarIds } },
			select: { grammarRuleId: true }
		});
		const existingSet = new Set(existingUserGrammar.map((g) => g.grammarRuleId));

		await Promise.allSettled(
			grammarResults.map((r) => {
				const srsState = r.correct ? ('KNOWN' as const) : ('LEARNING' as const);
				if (existingSet.has(r.grammarRuleId)) {
					return prisma.userGrammarRule.update({
						where: { userId_grammarRuleId: { userId, grammarRuleId: r.grammarRuleId } },
						data: { srsState }
					});
				} else {
					return prisma.userGrammarRule.create({
						data: {
							userId,
							grammarRuleId: r.grammarRuleId,
							srsState,
							eloRating: startingElo
						}
					});
				}
			})
		);

		// Also seed all grammar rules for levels below tentativeLevel as MASTERED
		// (will be done properly in the chat finalize step via applyGrammarMasteryForLevel)
	}

	return json({
		level,
		score,
		correctCount,
		totalQuestions,
		advance: false,
		readyForChat: true,
		tentativeLevel,
		quizSummary
	});
}
