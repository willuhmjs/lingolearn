import { prisma } from '$lib/server/prisma';
import { gradeImmersionAnswer } from '$lib/server/immersionService';
import { successResponse, errorResponse } from '$lib/server/apiResponse';

export async function POST({ request, locals }) {
  if (!locals.user) {
    return errorResponse('Unauthorized', 401);
  }

  const userId = locals.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { useLocalLlm: true }
  });
  const useLocalLlm = dbUser?.useLocalLlm ?? false;

  try {
    const data = await request.json();
    const result = await gradeImmersionAnswer(userId, data, useLocalLlm);
    return successResponse(result);
  } catch (error) {
    console.error('Immersion grade error:', error);
    const message =
      error instanceof Error ? error.message : 'Could not grade your answer. Please try again.';
    return successResponse({ score: 0, feedback: message });
  }
}
