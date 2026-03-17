import { getCachedLanguages } from '$lib/server/cache';
import { prisma } from '$lib/server/prisma';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const languages = await getCachedLanguages();

  let onboardedLanguages: typeof languages = [];
  if (locals.user) {
    const progress = await prisma.userProgress.findMany({
      where: { userId: locals.user.id, hasOnboarded: true },
      select: { languageId: true }
    });
    const onboardedIds = new Set(progress.map((p) => p.languageId));
    onboardedLanguages = languages.filter((l) => onboardedIds.has(l.id));
  }

  let socialNotificationCount = 0;
  if (locals.user) {
    const [pendingFriendships, pendingChallenges] = await Promise.all([
      prisma.friendship.count({
        where: { receiverId: locals.user.id, status: 'PENDING' }
      }),
      prisma.challenge.count({
        where: { challengeeId: locals.user.id, status: 'PENDING' }
      })
    ]);
    socialNotificationCount = pendingFriendships + pendingChallenges;
  }

  return {
    user: locals.user,
    languages,
    onboardedLanguages,
    socialNotificationCount
  };
};
