import { prisma } from './prisma';

export async function updateGamification(userId: string, xpToAdd: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastActivityDate: true,
      totalXp: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const now = new Date();
  let newStreak = user.currentStreak;
  let newLongestStreak = user.longestStreak;

  if (user.lastActivityDate) {
    const lastActivity = new Date(user.lastActivityDate);
    // Normalize to start of day for accurate day differences
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActiveDay = new Date(
      lastActivity.getFullYear(),
      lastActivity.getMonth(),
      lastActivity.getDate()
    );

    const diffTime = Math.abs(today.getTime() - lastActiveDay.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Activity was yesterday
      newStreak += 1;
    } else if (diffDays > 1) {
      // Activity was before yesterday
      newStreak = 1;
    }
    // If diffDays === 0, activity was today, keep the same streak
  } else {
    // First activity
    newStreak = 1;
  }

  if (newStreak > newLongestStreak) {
    newLongestStreak = newStreak;
  }

  return await prisma.user.update({
    where: { id: userId },
    data: {
      totalXp: { increment: xpToAdd },
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: now,
    },
  });
}
