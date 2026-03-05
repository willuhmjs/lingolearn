import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

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
		const currentUserMember = await prisma.classMember.findUnique({
			where: {
				classId_userId: {
					classId,
					userId: locals.user.id
				}
			}
		});

		if (!currentUserMember || currentUserMember.role !== 'TEACHER') {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		// Verify the target user is a member of the class
		const targetUserMember = await prisma.classMember.findUnique({
			where: {
				classId_userId: {
					classId,
					userId: targetUserId
				}
			}
		});

		if (!targetUserMember) {
			return json({ error: 'User is not a member of this class' }, { status: 404 });
		}

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
		return json({ error: 'Failed to kick member' }, { status: 500 });
	}
};
