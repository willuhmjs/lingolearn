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

  // 3. Search for games targeting weak grammar rules (Combined)
  if (weakGrammar.length > 0) {
    const grammarGames = await prisma.game.findMany({
      where: {
        isPublished: true,
        OR: weakGrammar.flatMap((rule) => [
          { title: { contains: rule.grammarRule.title, mode: 'insensitive' } },
          { description: { contains: rule.grammarRule.title, mode: 'insensitive' } }
        ])
      },
      take: 10 // Fetch a few more to allow for filtering
    });

    for (const rule of weakGrammar) {
      const matches = grammarGames.filter(
        (g) =>
          g.title.toLowerCase().includes(rule.grammarRule.title.toLowerCase()) ||
          g.description?.toLowerCase().includes(rule.grammarRule.title.toLowerCase())
      );
      for (const game of matches.slice(0, 2)) {
        if (!seenGameIds.has(game.id)) {
          recommendations.push({
            ...game,
            recommendationReason: `Targets weak grammar: ${rule.grammarRule.title}`
          });
          seenGameIds.add(game.id);
        }
      }
    }
  }

  // 4. Search for games containing weak vocabulary (Combined)
  if (weakVocab.length > 0 && recommendations.length < 8) {
    const vocabLemmas = weakVocab.map((v) => v.vocabulary.lemma);
    const vocabGames = await prisma.game.findMany({
      where: {
        isPublished: true,
        questions: {
          some: {
            OR: vocabLemmas.flatMap((lemma) => [
              { question: { contains: lemma, mode: 'insensitive' } },
              { answer: { contains: lemma, mode: 'insensitive' } }
            ])
          }
        }
      },
      include: {
        questions: {
          select: { question: true, answer: true }
        }
      },
      take: 15
    });

    for (const v of weakVocab) {
      if (recommendations.length >= 8) break;
      const lemma = v.vocabulary.lemma.toLowerCase();
      const match = vocabGames.find(
        (g) =>
          !seenGameIds.has(g.id) &&
          g.questions.some(
            (q) =>
              q.question.toLowerCase().includes(lemma) || q.answer.toLowerCase().includes(lemma)
          )
      );

      if (match) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { questions, ...gameData } = match;
        recommendations.push({
          ...(gameData as Game),
          recommendationReason: `Reinforces weak vocabulary: ${v.vocabulary.lemma}`
        });
        seenGameIds.add(match.id);
      }
    }
  }

  return recommendations;
}
