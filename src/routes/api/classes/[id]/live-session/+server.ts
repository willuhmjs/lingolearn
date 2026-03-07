import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export async function GET({ params, locals }) {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const classId = params.id;

	const liveSession = await prisma.liveSession.findFirst({
		where: { classId },
		orderBy: { createdAt: 'desc' },
		include: {
			participants: {
				include: { user: true }
			}
		}
	});

	if (!liveSession) {
		return json({ session: null, userId: user.id });
	}

	return json({ session: liveSession, userId: user.id });
}

export async function POST({ params, request, locals }) {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const classId = params.id;
	const data = await request.json();

	// Check if user is a teacher of this class
	const classMember = await prisma.classMember.findUnique({
		where: { classId_userId: { classId, userId: user.id } }
	});

	if (!classMember || classMember.role !== 'TEACHER') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const { action, currentQuestion, status } = data;

	if (action === 'start') {
		const existingSession = await prisma.liveSession.findFirst({
			where: { classId, status: { in: ['waiting', 'active'] } }
		});
		if (existingSession) {
			return json({ session: existingSession });
		}
		const newSession = await prisma.liveSession.create({
			data: {
				classId,
				status: 'waiting'
			}
		});
		return json({ session: newSession });
	}

	if (action === 'update') {
		const activeSession = await prisma.liveSession.findFirst({
			where: { classId, status: { in: ['waiting', 'active'] } },
			orderBy: { createdAt: 'desc' }
		});

		if (!activeSession) {
			return json({ error: 'No active session found' }, { status: 404 });
		}

		const updatedSession = await prisma.liveSession.update({
			where: { id: activeSession.id },
			data: {
				status: status !== undefined ? status : activeSession.status,
				currentQuestion: currentQuestion !== undefined ? currentQuestion : activeSession.currentQuestion
			}
		});

		// If moving to next question, reset participant answer status
		if (currentQuestion && currentQuestion !== activeSession.currentQuestion) {
			await prisma.liveSessionParticipant.updateMany({
				where: { sessionId: activeSession.id },
				data: { hasAnswered: false }
			});
		}

		return json({ session: updatedSession });
	}

	if (action === 'end') {
		const activeSession = await prisma.liveSession.findFirst({
			where: { classId, status: { in: ['waiting', 'active'] } },
			orderBy: { createdAt: 'desc' }
		});

		if (activeSession) {
			await prisma.liveSession.update({
				where: { id: activeSession.id },
				data: { status: 'finished' }
			});
		}
		return json({ success: true });
	}

	return json({ error: 'Invalid action' }, { status: 400 });
}
