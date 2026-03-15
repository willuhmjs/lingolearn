import { json } from '@sveltejs/kit';
import { updateSrsMetrics } from '$lib/server/grader';
import { updateGamification } from '$lib/server/gamification';
import { XP_CONFIG, computeAnswerXp } from '$lib/server/srsConfig';

export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { vocabularyId, score, overridden } = await request.json();

		if (!vocabularyId || typeof score !== 'number') {
			return json({ error: 'Missing vocabularyId or score' }, { status: 400 });
		}

		const wasOverridden = overridden === true;

		// Cap overridden scores at 0.8 (FSRS "Good" not "Easy") so overrides
		// don't inflate stability as fast as a genuinely perfect answer.
		const effectiveScore = wasOverridden ? Math.min(score, 0.8) : score;

		await updateSrsMetrics(locals.user.id, vocabularyId, effectiveScore, 'vocabulary', wasOverridden);

		if (effectiveScore >= XP_CONFIG.SCORE_THRESHOLD) {
			const cefrLevel = locals.user.cefrLevel || 'A1';
			const xpToAdd = computeAnswerXp(XP_CONFIG.CORRECT_ANSWER.OTHER_MODES, cefrLevel);
			await updateGamification(locals.user.id, xpToAdd);
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to submit review', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
