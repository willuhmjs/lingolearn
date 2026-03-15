import { json } from '@sveltejs/kit';
import { loadRetentionStats } from '$lib/server/retentionStats';

/**
 * GET /api/user/retention-stats
 *
 * Returns per-user vocabulary retention analytics derived from FSRS progress records.
 * See src/lib/server/retentionStats.ts for the full metric definitions.
 */
export async function GET({ locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const stats = await loadRetentionStats(locals.user.id);
	return json(stats);
}
