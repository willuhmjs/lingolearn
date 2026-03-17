import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { question, answer, options, order } = await request.json();

    if (!question || !answer) {
      return json({ error: 'Question and answer are required' }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: { id: params.id },
      include: { questions: true }
    });

    if (!game) {
      return json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.creatorId !== session.user.id) {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    const nextOrder = order !== undefined ? order : game.questions.length;

    // Filter out the correct answer from options if it somehow got included
    const filteredOptions = Array.isArray(options)
      ? options.filter((opt: string) => opt.toLowerCase() !== answer.toLowerCase())
      : [];

    const gameQuestion = await prisma.gameQuestion.create({
      data: {
        gameId: params.id,
        question,
        answer,
        options: filteredOptions,
        order: nextOrder
      }
    });

    if (game.isPublished) {
      await prisma.game.update({
        where: { id: params.id },
        data: { isPublished: false }
      });
    }

    return json({ question: gameQuestion });
  } catch (error) {
    console.error('Failed to create question:', error);
    return json({ error: 'Failed to create question' }, { status: 500 });
  }
};
