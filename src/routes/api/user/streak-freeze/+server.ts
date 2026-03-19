import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

const FREEZE_XP_COST = 500;

export async function POST({ locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: locals.user.id },
    select: { totalXp: true, streakFreezes: true }
  });

  if (!user) return json({ error: 'User not found' }, { status: 404 });

  if (user.totalXp < FREEZE_XP_COST) {
    return json(
      { error: `You need at least ${FREEZE_XP_COST} XP to buy a streak freeze.` },
      { status: 400 }
    );
  }

  if (user.streakFreezes >= 5) {
    return json(
      { error: 'You already have the maximum number of streak freezes (5).' },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: locals.user.id },
    data: {
      totalXp: { decrement: FREEZE_XP_COST },
      streakFreezes: { increment: 1 }
    },
    select: { totalXp: true, streakFreezes: true }
  });

  return json({ totalXp: updated.totalXp, streakFreezes: updated.streakFreezes });
}
