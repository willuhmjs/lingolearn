import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { CefrService } from '$lib/server/cefrService';
import { env } from '$env/dynamic/private';

/**
 * GET /api/cron/elo-decay
 *
 * Scheduled job: applies ELO decay for all active users across all their languages.
 * Must be called by a cron runner (e.g. Vercel Cron, GitHub Actions, external scheduler)
 * with the CRON_SECRET header matching the CRON_SECRET environment variable.
 *
 * Replaces the previous pattern of firing decay as a per-request side effect on every
 * lesson generate and submit-answer call, which caused:
 *   - Redundant DB reads on every request for users whose items weren't stale
 *   - Race conditions when two concurrent requests both triggered decay at once
 *   - No guarantee that low-activity users ever received decay
 *
 * Recommended schedule: once daily (e.g. 02:00 UTC).
 */
export async function GET({ request }) {
	const secret = env.CRON_SECRET;
	if (!secret) {
		return json({ error: 'CRON_SECRET not configured' }, { status: 500 });
	}

	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${secret}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		// Find all (userId, languageId) pairs for users who have any vocabulary progress.
		// We use userProgress (CEFR progress records) as the source of truth for which
		// language each user is actively learning — this is more reliable than activeLanguageId
		// since a user may learn multiple languages over time.
		const activeProgresses = await prisma.userProgress.findMany({
			where: { hasOnboarded: true },
			select: { userId: true, languageId: true }
		});

		if (activeProgresses.length === 0) {
			return json({ processed: 0, message: 'No active users to process' });
		}

		let successCount = 0;
		let errorCount = 0;

		// Process users in serial to avoid overwhelming the DB with parallel transactions.
		// Decay is a background job with no latency requirements, so throughput > concurrency.
		for (const { userId, languageId } of activeProgresses) {
			try {
				await CefrService.applyEloDecay(userId, languageId);
				successCount++;
			} catch (err) {
				console.error(`[ELO Decay Cron] Failed for user=${userId} lang=${languageId}:`, err);
				errorCount++;
			}
		}

		console.log(
			`[ELO Decay Cron] Completed: ${successCount} succeeded, ${errorCount} failed out of ${activeProgresses.length} user-language pairs`
		);

		return json({
			processed: activeProgresses.length,
			succeeded: successCount,
			failed: errorCount
		});
	} catch (err) {
		console.error('[ELO Decay Cron] Fatal error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
