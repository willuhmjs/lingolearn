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

    // Cannot kick yourself
    if (targetUserId === locals.user.id) {
      return json({ error: 'You cannot kick yourself' }, { status: 400 });
    }

    // Verify the current user is a TEACHER in this class
    if (locals.user.role !== 'ADMIN') {
      await requireClassRole(classId, locals.user.id, 'TEACHER');
    }

    // Verify the target user is a member of the class
    await requireClassRole(classId, targetUserId);

    // Remove the member
    await prisma.classMember.delete({
      where: {
        classId_userId: {
          classId,
          userId: targetUserId
        }
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
    console.error('Failed to kick member:', error);
    if (typeof error === 'object' && error !== null && 'status' in error && 'body' in error) {
      const e = error as { status: number; body: { message: string } };
      return json({ error: e.body.message }, { status: e.status });
    }
    return json({ error: 'Failed to kick member' }, { status: 500 });
  }
};
