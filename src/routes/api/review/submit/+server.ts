import { json } from '@sveltejs/kit';
import { updateSrsMetrics } from '$lib/server/grader';
import { updateGamification } from '$lib/server/gamification';

export async function POST({ request, locals }) {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { vocabularyId, score } = await request.json();

		if (!vocabularyId || typeof score !== 'number') {
			return json({ error: 'Missing vocabularyId or score' }, { status: 400 });
		}

		await updateSrsMetrics(locals.user.id, vocabularyId, score);

		const xpToAdd = score >= 0.8 ? 10 : 0;
		if (xpToAdd > 0) {
			await updateGamification(locals.user.id, xpToAdd);
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to submit review', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
