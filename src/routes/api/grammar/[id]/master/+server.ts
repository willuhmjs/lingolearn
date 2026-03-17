import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { reviewCard, DEFAULT_FSRS_PARAMETERS, initializeFsrsCard } from '$lib/server/fsrs';

export async function POST(event) {
  const { params, locals } = event;

  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const grammarRuleId = params.id;
  const userId = locals.user.id;

  const grammarRule = await prisma.grammarRule.findUnique({
    where: { id: grammarRuleId },
    include: { dependencies: true }
  });

  if (!grammarRule) {
    return json({ error: 'Grammar rule not found' }, { status: 404 });
  }

  // Server-side validate all prerequisites are mastered
  if (grammarRule.dependencies.length > 0) {
    const prereqStatuses = await prisma.userGrammarRule.findMany({
      where: {
        userId,
        grammarRuleId: { in: grammarRule.dependencies.map((d) => d.id) }
      },
      select: { grammarRuleId: true, srsState: true }
    });

    const allMastered = grammarRule.dependencies.every((dep) => {
      const status = prereqStatuses.find((s) => s.grammarRuleId === dep.id);
      return status?.srsState === 'MASTERED';
    });

    if (!allMastered) {
      return json(
        { error: 'All prerequisites must be mastered before marking this rule as mastered.' },
        { status: 403 }
      );
    }
  }

  // Run three "Easy" (rating 4) reviews to push the card into MASTERED state
  let card = initializeFsrsCard();
  let lastResult = reviewCard(card, 4, new Date(), DEFAULT_FSRS_PARAMETERS);
  card = lastResult.card;
  lastResult = reviewCard(card, 4, new Date(), DEFAULT_FSRS_PARAMETERS);
  card = lastResult.card;
  lastResult = reviewCard(card, 4, new Date(), DEFAULT_FSRS_PARAMETERS);

  const nextReviewDate = lastResult.nextReviewDate;
  const fsrsData = {
    difficulty: lastResult.card.difficulty,
    stability: lastResult.card.stability,
    retrievability: lastResult.card.retrievability ?? 1,
    repetitions: lastResult.card.repetitions,
    lapses: lastResult.card.lapses,
    lastReviewDate: new Date(),
    nextReviewDate
  };

  await prisma.userGrammarRuleProgress.upsert({
    where: { userId_grammarRuleId: { userId, grammarRuleId } },
    create: { userId, grammarRuleId, ...fsrsData },
    update: fsrsData
  });

  await prisma.userGrammarRule.upsert({
    where: { userId_grammarRuleId: { userId, grammarRuleId } },
    create: {
      userId,
      grammarRuleId,
      eloRating: 1200,
      srsState: 'MASTERED',
      nextReviewDate
    },
    update: {
      srsState: 'MASTERED',
      eloRating: 1200,
      nextReviewDate
    }
  });

  return json({ success: true });
}
