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
  const { action, selectedAnswer } = data;

  const activeSession = await prisma.liveSession.findFirst({
    where: { classId, status: { in: ['waiting', 'active', 'showing_answer'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      game: {
        include: {
          questions: { orderBy: { order: 'asc' } }
        }
      }
    }
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
    if (activeSession.status !== 'active') {
      return json({ error: 'Cannot answer right now' }, { status: 400 });
    }

    if (typeof selectedAnswer !== 'string' || !selectedAnswer.trim()) {
      return json({ error: 'selectedAnswer is required' }, { status: 400 });
    }

    // Server-side correctness check — never trust the client's isCorrect flag
    const currentQuestion = activeSession.game?.questions?.[activeSession.currentQuestionIndex];
    if (!currentQuestion) {
      return json({ error: 'Question not found' }, { status: 400 });
    }
    const isCorrect =
      selectedAnswer.trim().toLowerCase() === currentQuestion.answer.trim().toLowerCase();

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

    return json({ success: true, isCorrect });
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}
