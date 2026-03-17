import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestEvent } from '@sveltejs/kit';

export const POST = async ({ request, locals }: RequestEvent) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { vocabularyId } = body;

  if (!vocabularyId) {
    return json({ error: 'Missing vocabularyId' }, { status: 400 });
  }

  try {
    // Verify the vocabulary exists and belongs to user's active language
    const vocabulary = await prisma.vocabulary.findUnique({
      where: { id: vocabularyId },
      select: { languageId: true }
    });

    if (!vocabulary) {
      return json({ error: 'Vocabulary not found' }, { status: 404 });
    }

    // Ensure vocabulary belongs to user's active language
    if (locals.user.activeLanguage && vocabulary.languageId !== locals.user.activeLanguage.id) {
      return json({ error: 'Vocabulary does not belong to your active language' }, { status: 400 });
    }

    const result = await prisma.userVocabulary.upsert({
      where: {
        userId_vocabularyId: {
          userId: locals.user.id,
          vocabularyId
        }
      },
      update: {}, // Do nothing if it already exists
      create: {
        userId: locals.user.id,
        vocabularyId,
        srsState: 'UNSEEN',
        eloRating: 1000
      }
    });

    return json({ success: true, result });
  } catch (error) {
    console.error('Failed to add vocabulary:', error);
    return json({ error: 'Failed to add vocabulary' }, { status: 500 });
  }
};
