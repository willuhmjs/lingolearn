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
    const targetUserId = params.userId;

    // Verify the current user is a TEACHER in this class
    if (locals.user.role !== 'ADMIN') {
      await requireClassRole(classId, locals.user.id, 'TEACHER');
    }

    // Verify the target user is a member of the class
    await requireClassRole(classId, targetUserId);

    // Promote the user
    const updatedMember = await prisma.classMember.update({
      where: {
        classId_userId: {
          classId,
          userId: targetUserId
        }
      },
      data: {
        role: 'TEACHER'
      }
    });

    return json({ success: true, member: updatedMember });
  } catch (error) {
    console.error('Failed to promote member:', error);
    if (typeof error === 'object' && error !== null && 'status' in error && 'body' in error) {
      const e = error as { status: number; body: { message: string } };
      return json({ error: e.body.message }, { status: e.status });
    }
    return json({ error: 'Failed to promote member' }, { status: 500 });
  }
};
