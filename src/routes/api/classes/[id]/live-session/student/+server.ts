import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export async function POST({ params, request, locals }) {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const classId = params.id;
	const userId = user.id;
	const data = await request.json();
	const { action, isCorrect } = data;

	const activeSession = await prisma.liveSession.findFirst({
		where: { classId, status: { in: ['waiting', 'active'] } },
		orderBy: { createdAt: 'desc' }
	});

	if (!activeSession) {
		return json({ error: 'No active session' }, { status: 404 });
	}

	if (action === 'join') {
		const participant = await prisma.liveSessionParticipant.upsert({
			where: {
				sessionId_userId: { sessionId: activeSession.id, userId }
			},
			update: { joinedAt: new Date() },
			create: {
				sessionId: activeSession.id,
				userId
			}
		});
		return json({ success: true, participant });
	}

	if (action === 'answer') {
		const participant = await prisma.liveSessionParticipant.findUnique({
			where: { sessionId_userId: { sessionId: activeSession.id, userId } }
		});

		if (!participant) {
			return json({ error: 'Not joined' }, { status: 400 });
		}

		if (participant.hasAnswered) {
			return json({ error: 'Already answered' }, { status: 400 });
		}

		await prisma.liveSessionParticipant.update({
			where: { id: participant.id },
			data: {
				hasAnswered: true,
				score: isCorrect ? participant.score + 100 : participant.score
			}
		});

		return json({ success: true });
	}

	return json({ error: 'Invalid action' }, { status: 400 });
}
