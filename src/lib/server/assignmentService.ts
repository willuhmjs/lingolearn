import { prisma } from './prisma';

/** Track a correct/incorrect answer against an assignment score record. */
export async function updateAssignmentScore(
  assignmentId: string,
  userId: string,
  isCorrect: boolean
) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    console.error(`Assignment ${assignmentId} not found`);
    throw new Error('Assignment not found');
  }

  // Verify the user is a member of the assignment's class
  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId: assignment.classId, userId } }
  });
  if (!member) {
    throw new Error('User is not a member of this class');
  }

  const increment = isCorrect ? 1 : 0;

  const current = await prisma.assignmentScore.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } }
  });

  const newScore = (current?.score ?? 0) + increment;
  const passed = newScore >= assignment.targetScore;

  const updated = await prisma.assignmentScore.upsert({
    where: { assignmentId_userId: { assignmentId, userId } },
    create: { assignmentId, userId, score: newScore, passed },
    update: { score: newScore, passed }
  });

  return { score: updated.score, targetScore: assignment.targetScore, passed: updated.passed };
}

/** Track a correct answer against an assignment score record for immerse mode. */
export async function updateImmersionAssignmentScore(
  assignmentId: string,
  userId: string,
  correctCount: number
) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return null;

  // Verify the user is a member of the assignment's class
  const member = await prisma.classMember.findUnique({
    where: { classId_userId: { classId: assignment.classId, userId } }
  });
  if (!member) return null;

  const current = await prisma.assignmentScore.findUnique({
    where: { assignmentId_userId: { assignmentId, userId } }
  });

  const newScore = (current?.score ?? 0) + correctCount;
  const passed = newScore >= assignment.targetScore;

  const updated = await prisma.assignmentScore.upsert({
    where: { assignmentId_userId: { assignmentId, userId } },
    create: { assignmentId, userId, score: newScore, passed },
    update: { score: newScore, passed }
  });

  return { score: updated.score, targetScore: assignment.targetScore, passed: updated.passed };
}
