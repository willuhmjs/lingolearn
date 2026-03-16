import { prisma } from '$lib/server/prisma';
import { todayUtc } from '$lib/server/dateUtils';

/**
 * Daily token quota for users on the public LLM.
 * Effective usage = tokensUsed - goodWillTokens.
 * Good-will tokens are refunded for calls that genuinely benefit the shared
 * database (e.g. enriching or creating vocabulary that was persisted).
 *
 * Set very liberally by default — tighten via code when needed.
 */
export const DAILY_TOKEN_QUOTA = 500_000;

/**
 * Returns the user's current effective token usage for today.
 * Returns null if there is no usage record yet (i.e. 0 used).
 */
export async function getDailyUsage(
	userId: string
): Promise<{ tokensUsed: number; goodWillTokens: number; effectiveUsage: number } | null> {
	const record = await prisma.userAiUsage.findUnique({
		where: { userId_date: { userId, date: todayUtc() } }
	});
	if (!record) return null;
	return {
		tokensUsed: record.tokensUsed,
		goodWillTokens: record.goodWillTokens,
		effectiveUsage: Math.max(0, record.tokensUsed - record.goodWillTokens)
	};
}

/**
 * Returns true if the user has exceeded their daily quota.
 * Users on a local/custom LLM are never quota-limited.
 */
export async function isQuotaExceeded(userId: string, useLocalLlm: boolean): Promise<boolean> {
	if (useLocalLlm) return false;
	const usage = await getDailyUsage(userId);
	if (!usage) return false;
	return usage.effectiveUsage >= DAILY_TOKEN_QUOTA;
}

/**
 * Records token usage for a public-LLM call.
 * Fire-and-forget safe — errors are logged but not thrown.
 *
 * @param tokens  Total tokens consumed by the call (prompt + completion).
 * @param goodWill  If true, these tokens are also credited back as good-will
 *                  (they don't count against the daily budget). Use this when
 *                  the call directly benefited the shared database.
 */
export async function recordTokenUsage(
	userId: string,
	tokens: number,
	goodWill = false
): Promise<void> {
	if (tokens <= 0) return;
	try {
		await prisma.userAiUsage.upsert({
			where: { userId_date: { userId, date: todayUtc() } },
			create: {
				userId,
				date: todayUtc(),
				tokensUsed: tokens,
				goodWillTokens: goodWill ? tokens : 0
			},
			update: {
				tokensUsed: { increment: tokens },
				...(goodWill ? { goodWillTokens: { increment: tokens } } : {})
			}
		});
	} catch (err) {
		console.error('[aiQuota] Failed to record token usage', err);
	}
}
