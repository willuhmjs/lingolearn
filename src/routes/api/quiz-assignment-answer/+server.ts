import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { quizAnswerRateLimiter } from '$lib/server/ratelimit';

export const POST = async (event: any) => {
  const { request, locals } = event;

  if (await quizAnswerRateLimiter.isLimited(event)) {
    return json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
  }
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assignmentId, isCorrect } = await request.json();

  if (!assignmentId || typeof isCorrect !== 'boolean') {
    return json({ error: 'assignmentId and isCorrect are required' }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    return json({ error: 'Assignment not found' }, { status: 404 });
  }

  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId: assignment.classId, userId: locals.user.id } }
  });
  if (!member) {
    return json({ error: 'Not a member of this class' }, { status: 403 });
  }

  const increment = isCorrect ? 1 : 0;
  const current = await prisma.assignmentScore.findUnique({
    where: { assignmentId_userId: { assignmentId, userId: locals.user.id } }
  });

  const newScore = (current?.score ?? 0) + increment;
  const passed = newScore >= assignment.targetScore;

  const updated = await prisma.assignmentScore.upsert({
    where: { assignmentId_userId: { assignmentId, userId: locals.user.id } },
    create: { assignmentId, userId: locals.user.id, score: newScore, passed },
    update: { score: newScore, passed }
  });

  return json({
    assignmentProgress: {
      score: updated.score,
      targetScore: assignment.targetScore,
      passed: updated.passed
    }
  });
};
