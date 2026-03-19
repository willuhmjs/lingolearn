import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { gradeReviewAnswer } from '$lib/server/reviewService';

export async function POST({ request, locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = locals.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { useLocalLlm: true }
  });
  const useLocalLlm = dbUser?.useLocalLlm ?? false;

  try {
    const { userAnswer, lemma, correctMeaning } = await request.json();

    const result = await gradeReviewAnswer(userId, userAnswer, lemma, correctMeaning, useLocalLlm);

    return json(result);
  } catch (error) {
    console.error('Failed to grade review answer', error);
    return json({ correct: false, score: 0 });
  }
}
