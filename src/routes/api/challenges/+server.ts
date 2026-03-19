import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';
import { successResponse, errorResponse } from '$lib/server/apiResponse';

export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return errorResponse('Unauthorized', 401);
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

    return successResponse({ challenges });
  } catch (error) {
    console.error('Failed to fetch challenges:', error);
    return errorResponse('Failed to fetch challenges', 500);
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { gameId, challengeeId, scoreToBeat } = await request.json();

    if (!gameId || !challengeeId || scoreToBeat === undefined) {
      return errorResponse('gameId, challengeeId, and scoreToBeat are required', 400);
    }

    // Verify game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!game) {
      return errorResponse('Game not found', 404);
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

    return successResponse({ challenge });
  } catch (error) {
    console.error('Failed to create challenge:', error);
    return errorResponse('Failed to create challenge', 500);
  }
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { challengeId, status } = await request.json();

    if (!challengeId || !['ACCEPTED', 'DECLINED', 'COMPLETED'].includes(status)) {
      return errorResponse('Invalid data', 400);
    }

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId }
    });

    if (!challenge) {
      return errorResponse('Challenge not found', 404);
    }

    if (challenge.challengeeId !== session.user.id) {
      return errorResponse('Forbidden', 403);
    }

    const updated = await prisma.challenge.update({
      where: { id: challengeId },
      data: { status }
    });

    return successResponse({ challenge: updated });
  } catch (error) {
    console.error('Failed to update challenge:', error);
    return errorResponse('Failed to update challenge', 500);
  }
};
