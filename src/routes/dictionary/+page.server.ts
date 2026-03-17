import { redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const load = async ({ locals }: ServerLoadEvent) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  if (!locals.user.hasOnboarded) {
    throw redirect(302, '/onboarding');
  }

  const userId = locals.user.id;
  const activeLanguageId = locals.user.activeLanguage?.id;

  let grammarRules: any[] = [];
  let learningWords: any[] = [];

  let userGrammarProgress: any[] = [];

  if (activeLanguageId) {
    [grammarRules, learningWords, userGrammarProgress] = await Promise.all([
      prisma.grammarRule.findMany({
        where: { languageId: activeLanguageId },
        orderBy: [{ level: 'asc' }, { title: 'asc' }],
        include: {
          dependencies: { select: { id: true, title: true, level: true } },
          dependents: { select: { id: true, title: true, level: true } }
        }
      }),
      prisma.userVocabulary
        .findMany({
          where: { userId, srsState: 'LEARNING', vocabulary: { languageId: activeLanguageId } },
          include: {
            vocabulary: { include: { meanings: true } }
          },
          orderBy: { updatedAt: 'desc' },
          take: 50
        })
        .then((rows) =>
          rows.map((r) => ({
            ...r.vocabulary,
            userSrsState: r.srsState
          }))
        ),
      prisma.userGrammarRule.findMany({
        where: { userId, grammarRule: { languageId: activeLanguageId } },
        select: { grammarRuleId: true, srsState: true, eloRating: true }
      })
    ]);
  } else {
    grammarRules = await prisma.grammarRule.findMany({
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
      include: {
        dependencies: { select: { id: true, title: true, level: true } },
        dependents: { select: { id: true, title: true, level: true } }
      }
    });
  }

  return {
    user: locals.user,
    grammarRules,
    learningWords,
    userGrammarProgress
  };
};
