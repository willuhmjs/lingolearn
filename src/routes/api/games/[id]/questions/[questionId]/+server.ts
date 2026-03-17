import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { question, answer, options, order } = await request.json();

    const game = await prisma.game.findUnique({
      where: { id: params.id }
    });

    if (!game) {
      return json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.creatorId !== session.user.id) {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    const gameQuestion = await prisma.gameQuestion.findUnique({
      where: { id: params.questionId }
    });

    if (!gameQuestion || gameQuestion.gameId !== params.id) {
      return json({ error: 'Question not found' }, { status: 404 });
    }

    // Filter out the correct answer from options if it somehow got included
    let filteredOptions = options;
    if (options !== undefined && Array.isArray(options)) {
      const targetAnswer = answer !== undefined ? answer : gameQuestion.answer;
      filteredOptions = options.filter(
        (opt: string) => opt.toLowerCase() !== targetAnswer.toLowerCase()
      );
    }

    const updatedQuestion = await prisma.gameQuestion.update({
      where: { id: params.questionId },
      data: {
        question: question !== undefined ? question : gameQuestion.question,
        answer: answer !== undefined ? answer : gameQuestion.answer,
        options: filteredOptions !== undefined ? filteredOptions : gameQuestion.options,
        order: order !== undefined ? order : gameQuestion.order
      }
    });

    if (game.isPublished) {
      await prisma.game.update({
        where: { id: params.id },
        data: { isPublished: false }
      });
    }

    return json({ question: updatedQuestion });
  } catch (error) {
    console.error('Failed to update question:', error);
    return json({ error: 'Failed to update question' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: params.id }
    });

    if (!game) {
      return json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.creatorId !== session.user.id) {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    const gameQuestion = await prisma.gameQuestion.findUnique({
      where: { id: params.questionId }
    });

    if (!gameQuestion || gameQuestion.gameId !== params.id) {
      return json({ error: 'Question not found' }, { status: 404 });
    }

    await prisma.gameQuestion.delete({
      where: { id: params.questionId }
    });

    if (game.isPublished) {
      await prisma.game.update({
        where: { id: params.id },
        data: { isPublished: false }
      });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Failed to delete question:', error);
    return json({ error: 'Failed to delete question' }, { status: 500 });
  }
};
