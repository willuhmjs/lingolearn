import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export async function POST({ params, request, locals }) {
  if (!locals.user || locals.user.role !== 'ADMIN') {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { languageId } = await request.json();

    if (!languageId) {
      return json({ error: 'Language ID is required' }, { status: 400 });
    }

    const userId = params.id;

    // Delete all user vocabulary, grammar, SRS progress, and level-up history
    await prisma.$transaction([
      prisma.userVocabularyProgress.deleteMany({
        where: {
          userId,
          vocabulary: { languageId }
        }
      }),
      prisma.userGrammarRuleProgress.deleteMany({
        where: {
          userId,
          grammarRule: { languageId }
        }
      }),
      prisma.userVocabulary.deleteMany({
        where: {
          userId,
          vocabulary: { languageId }
        }
      }),
      prisma.userGrammarRule.deleteMany({
        where: {
          userId,
          grammarRule: { languageId }
        }
      }),
      prisma.levelUpEvent.deleteMany({
        where: { userId, languageId }
      }),
      prisma.userProgress.updateMany({
        where: { userId, languageId },
        data: { cefrLevel: 'A1', hasOnboarded: false }
      })
    ]);

    return json({ success: true });
  } catch (error) {
    console.error('Error resetting user progress:', error);
    return json({ error: 'Failed to reset progress' }, { status: 500 });
  }
}
