import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requireClassRole } from '$lib/server/classAuth';

export const POST: RequestHandler = async ({ request, params, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const classId = params.id;
    const {
      title,
      description,
      gamemode,
      gameId,
      language,
      targetScore,
      passThreshold,
      targetCefrLevel,
      dueDate,
      topic,
      targetGrammar,
      targetVocab,
      disableHoverTranslation
    } = await request.json();

    if (!title || !gamemode || !language || targetScore === undefined) {
      return json(
        { error: 'Title, gamemode, language, and targetScore are required' },
        { status: 400 }
      );
    }

    if (gamemode === 'quiz' && !gameId) {
      return json({ error: 'A quiz must be selected for quiz assignments' }, { status: 400 });
    }

    // Verify the user is a TEACHER in this class
    if (locals.user.role !== 'ADMIN') {
      await requireClassRole(classId, locals.user.id, 'TEACHER');
    }

    // Enforce assignment limit (30)
    const assignmentCount = await prisma.assignment.count({
      where: { classId }
    });

    if (assignmentCount >= 30) {
      return json(
        { error: 'Maximum assignment limit reached for this class (30)' },
        { status: 403 }
      );
    }

    // Create the assignment
    const assignment = await prisma.assignment.create({
      data: {
        classId,
        title,
        description: description || null,
        gamemode,
        gameId: gameId || null,
        language,
        targetScore: Number(targetScore),
        passThreshold: passThreshold !== undefined ? Number(passThreshold) : 50,
        targetCefrLevel: targetCefrLevel || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        topic: topic || null,
        targetGrammar: Array.isArray(targetGrammar) ? targetGrammar : [],
        targetVocab: Array.isArray(targetVocab) ? targetVocab : [],
        disableHoverTranslation: !!disableHoverTranslation
      }
    });

    return json({ success: true, assignment });
  } catch (error) {
    console.error('Failed to create assignment:', error);
    if (typeof error === 'object' && error !== null && 'status' in error && 'body' in error) {
      const e = error as { status: number; body: { message: string } };
      return json({ error: e.body.message }, { status: e.status });
    }
    return json({ error: 'Failed to create assignment' }, { status: 500 });
  }
};
