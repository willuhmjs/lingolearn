import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requireClassRole } from '$lib/server/classAuth';

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const classId = params.id;
    const userId = locals.user.id;

    const member = await requireClassRole(classId, userId);

    // Teachers cannot leave if they are the only teacher
    if (member.role === 'TEACHER') {
      const teacherCount = await prisma.classMember.count({
        where: { classId, role: 'TEACHER' }
      });
      if (teacherCount <= 1) {
        return json(
          {
            error:
              'Cannot leave: you are the only teacher. Promote another member first or delete the class.'
          },
          { status: 400 }
        );
      }
    }

    await prisma.classMember.delete({
      where: {
        classId_userId: { classId, userId }
      }
    });

    // Check if class is empty and delete it
    const remainingMembers = await prisma.classMember.count({
      where: { classId }
    });

    if (remainingMembers === 0) {
      await prisma.class.delete({
        where: { id: classId }
      });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Failed to leave class:', error);
    if (typeof error === 'object' && error !== null && 'status' in error && 'body' in error) {
      const e = error as { status: number; body: { message: string } };
      return json({ error: e.body.message }, { status: e.status });
    }
    return json({ error: 'Failed to leave class' }, { status: 500 });
  }
};
