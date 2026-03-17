import { prisma } from '$lib/server/prisma';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const { username } = params;
  const session = await locals.auth();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      image: true,
      createdAt: true,
      lastActive: true,
      currentStreak: true,
      longestStreak: true,
      totalXp: true,
      activeLanguage: {
        select: {
          id: true,
          name: true,
          flag: true
        }
      },
      progress: {
        include: {
          language: true
        }
      }
    }
  });

  if (!user) {
    throw error(404, 'User not found');
  }

  // Check friendship status if logged in
  let friendshipStatus = null;
  if (session?.user?.id && session.user.id !== user.id) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: session.user.id, receiverId: user.id },
          { initiatorId: user.id, receiverId: session.user.id }
        ]
      }
    });
    friendshipStatus = friendship ? friendship.status : null;
  }

  return {
    profile: user,
    friendshipStatus,
    isOwnProfile: session?.user?.id === user.id
  };
};
