import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { username } = params;

  try {
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
      return json({ error: 'User not found' }, { status: 404 });
    }

    return json({ user });
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
};
