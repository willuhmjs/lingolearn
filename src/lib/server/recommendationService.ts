import { prisma } from '$lib/server/prisma';
import type { Game } from '@prisma/client';

export type RecommendedGame = Game & {
  recommendationReason: string;
};

/**
 * Identifies at-risk vocabulary and grammar, then finds community games
 * that help reinforce those weak areas.
 */
export async function getRecommendedGames(userId: string): Promise<RecommendedGame[]> {
  // 1. Identify top 5 "at risk" vocabulary words (lowest stability)
  const weakVocab = await prisma.userVocabularyProgress.findMany({
    where: { userId },
    orderBy: { stability: 'asc' },
    take: 5,
    include: { vocabulary: true }
  });

  // 2. Identify top 3 "at risk" grammar rules (lowest ELO)
  const weakGrammar = await prisma.userGrammarRule.findMany({
    where: { userId },
    orderBy: { eloRating: 'asc' },
    take: 3,
    include: { grammarRule: true }
  });

  const recommendations: RecommendedGame[] = [];
  const seenGameIds = new Set<string>();

  // 3. Search for games targeting weak grammar rules
  for (const rule of weakGrammar) {
    const games = await prisma.game.findMany({
      where: {
        isPublished: true,
        OR: [
          { title: { contains: rule.grammarRule.title, mode: 'insensitive' } },
          { description: { contains: rule.grammarRule.title, mode: 'insensitive' } }
        ]
      },
      take: 2
    });

    for (const game of games) {
      if (!seenGameIds.has(game.id)) {
        recommendations.push({
          ...game,
          recommendationReason: `Targets weak grammar: ${rule.grammarRule.title}`
        });
        seenGameIds.add(game.id);
      }
    }
  }

  // 4. Search for games containing weak vocabulary
  for (const v of weakVocab) {
    // Only look for games if we haven't filled up recommendations too much (cap at 6-8 total)
    if (recommendations.length >= 8) break;

    const lemma = v.vocabulary.lemma;
    const games = await prisma.game.findMany({
      where: {
        isPublished: true,
        questions: {
          some: {
            OR: [
              { question: { contains: lemma, mode: 'insensitive' } },
              { answer: { contains: lemma, mode: 'insensitive' } }
            ]
          }
        }
      },
      take: 1
    });

    for (const game of games) {
      if (!seenGameIds.has(game.id)) {
        recommendations.push({
          ...game,
          recommendationReason: `Reinforces weak vocabulary: ${lemma}`
        });
        seenGameIds.add(game.id);
      }
    }
  }

  return recommendations;
}
