import { prisma } from '$lib/server/prisma';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    throw redirect(303, '/login');
  }

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ initiatorId: session.user.id }, { receiverId: session.user.id }]
    },
    include: {
      initiator: {
        select: { id: true, username: true, name: true, image: true, lastActive: true }
      },
      receiver: {
        select: { id: true, username: true, name: true, image: true, lastActive: true }
      }
    }
  });

  const challenges = await prisma.challenge.findMany({
    where: {
      OR: [{ challengerId: session.user.id }, { challengeeId: session.user.id }]
    },
    include: {
      challenger: {
        select: { username: true }
      },
      challengee: {
        select: { username: true }
      },
      game: {
        select: { title: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return {
    friendships,
    challenges,
    userId: session.user.id
  };
};
