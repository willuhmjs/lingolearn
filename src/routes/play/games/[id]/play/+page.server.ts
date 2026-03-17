import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const load = async ({ params, locals, url }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const assignmentId = url.searchParams.get('assignmentId');

  const game = await prisma.game.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!game) {
    throw redirect(302, '/play?tab=games');
  }

  // Allow access if: game is published, user is the creator, user is admin,
  // or user is accessing via a valid quiz assignment
  let hasAssignmentAccess = false;
  let assignment = null;
  let assignmentScore = null;

  if (assignmentId) {
    assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { class: { select: { id: true, name: true } } }
    });

    if (assignment && assignment.gameId === game.id) {
      const member = await prisma.classMember.findUnique({
        where: { classId_userId: { classId: assignment.classId, userId: locals.user.id } }
      });
      if (member) {
        hasAssignmentAccess = true;
        assignmentScore = await prisma.assignmentScore.findUnique({
          where: { assignmentId_userId: { assignmentId, userId: locals.user.id } }
        });
      }
    }
  }

  if (
    !game.isPublished &&
    game.creatorId !== locals.user.id &&
    locals.user.role !== 'ADMIN' &&
    !hasAssignmentAccess
  ) {
    throw redirect(302, '/play?tab=games');
  }

  const friends = await prisma.friendship.findMany({
    where: {
      OR: [{ initiatorId: locals.user.id }, { receiverId: locals.user.id }],
      status: 'ACCEPTED'
    },
    include: {
      initiator: { select: { id: true, username: true } },
      receiver: { select: { id: true, username: true } }
    }
  });

  return {
    game,
    assignment: hasAssignmentAccess ? assignment : null,
    assignmentScore: hasAssignmentAccess ? assignmentScore : null,
    friends: friends.map((f) => (f.initiatorId === locals.user.id ? f.receiver : f.initiator))
  };
};
