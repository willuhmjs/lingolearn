import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;

  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { languageId } = await request.json();

    if (!languageId) {
      return json({ error: 'Language ID is required' }, { status: 400 });
    }

    // Verify the language exists
    const language = await prisma.language.findUnique({
      where: { id: languageId }
    });

    if (!language) {
      return json({ error: 'Language not found' }, { status: 404 });
    }

    // Update user's active language
    await prisma.user.update({
      where: { id: user.id },
      data: { activeLanguageId: languageId }
    });

    // Return whether the user has already onboarded for this language so the
    // client can decide where to navigate (onboarding vs. current page).
    const progress = await prisma.userProgress.findUnique({
      where: { userId_languageId: { userId: user.id, languageId } },
      select: { hasOnboarded: true }
    });

    return json({ success: true, hasOnboarded: progress?.hasOnboarded ?? false });
  } catch (error) {
    console.error('Failed to update active language:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
