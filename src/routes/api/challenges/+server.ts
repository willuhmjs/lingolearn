import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const challenges = await prisma.challenge.findMany({
      where: {
        OR: [{ challengerId: session.user.id }, { challengeeId: session.user.id }]
      },
      include: {
        challenger: {
          select: { id: true, username: true, name: true, image: true }
        },
        challengee: {
          select: { id: true, username: true, name: true, image: true }
        },
        game: {
          select: { id: true, title: true, language: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return json({ challenges });
  } catch (error) {
    console.error('Failed to fetch challenges:', error);
    return json({ error: 'Failed to fetch challenges' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { gameId, challengeeId, scoreToBeat } = await request.json();

    if (!gameId || !challengeeId || scoreToBeat === undefined) {
      return json({ error: 'gameId, challengeeId, and scoreToBeat are required' }, { status: 400 });
    }

    // Verify game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!game) {
      return json({ error: 'Game not found' }, { status: 404 });
    }

    // Create challenge
    const challenge = await prisma.challenge.create({
      data: {
        challengerId: session.user.id,
        challengeeId,
        gameId,
        scoreToBeat,
        status: 'PENDING'
      }
    });

    return json({ challenge });
  } catch (error) {
    console.error('Failed to create challenge:', error);
    return json({ error: 'Failed to create challenge' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { challengeId, status } = await request.json();

    if (!challengeId || !['ACCEPTED', 'DECLINED', 'COMPLETED'].includes(status)) {
      return json({ error: 'Invalid data' }, { status: 400 });
    }

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      return json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (challenge.challengeeId !== session.user.id) {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.challenge.update({
      where: { id: challengeId },
      data: { status }
    });

    return json({ challenge: updated });
  } catch (error) {
    console.error('Failed to update challenge:', error);
    return json({ error: 'Failed to update challenge' }, { status: 500 });
  }
};
