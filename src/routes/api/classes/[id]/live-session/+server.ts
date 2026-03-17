import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export async function GET({ params, locals }) {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const classId = params.id;

  const liveSession = await prisma.liveSession.findFirst({
    where: { classId },
    orderBy: { createdAt: 'desc' },
    include: {
      participants: {
        include: { user: true }
      },
      game: {
        include: {
          questions: {
            orderBy: { order: 'asc' }
          }
        }
      }
    }
  });

  if (!liveSession) {
    return json({ session: null, userId });
  }

  return json({ session: liveSession, userId });
}

export async function POST({ params, request, locals }) {
  const authSession = await locals.auth();
  if (!authSession?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = authSession.user.id;

  const classId = params.id;
  const data = await request.json();

  // Check if user is a teacher of this class
  const classMember = await prisma.classMember.findFirst({
    where: { classId, userId, role: 'TEACHER' }
  });

  if (!classMember) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, status, currentQuestionIndex, gameId } = data;

  if (action === 'start') {
    if (!gameId) {
      return json({ error: 'gameId is required to start a session' }, { status: 400 });
    }

    const existingSession = await prisma.liveSession.findFirst({
      where: { classId, status: { in: ['waiting', 'active'] } }
    });
    if (existingSession) {
      return json({ session: existingSession });
    }
    const newSession = await prisma.liveSession.create({
      data: {
        classId,
        gameId,
        status: 'waiting',
        currentQuestionIndex: 0
      }
    });
    return json({ session: newSession });
  }

  if (action === 'update') {
    const activeSession = await prisma.liveSession.findFirst({
      where: { classId, status: { in: ['waiting', 'active', 'showing_answer'] } },
      orderBy: { createdAt: 'desc' }
    });

    if (!activeSession) {
      return json({ error: 'No active session found' }, { status: 404 });
    }

    const updatedSession = await prisma.liveSession.update({
      where: { id: activeSession.id },
      data: {
        status: status !== undefined ? status : activeSession.status,
        currentQuestionIndex:
          currentQuestionIndex !== undefined
            ? currentQuestionIndex
            : activeSession.currentQuestionIndex
      }
    });

    // If moving to next question, reset participant answer status
    if (
      currentQuestionIndex !== undefined &&
      currentQuestionIndex !== activeSession.currentQuestionIndex
    ) {
      await prisma.liveSessionParticipant.updateMany({
        where: { sessionId: activeSession.id },
        data: { hasAnswered: false }
      });
    }

    return json({ session: updatedSession });
  }

  if (action === 'end') {
    const activeSession = await prisma.liveSession.findFirst({
      where: { classId, status: { in: ['waiting', 'active', 'showing_answer'] } },
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
