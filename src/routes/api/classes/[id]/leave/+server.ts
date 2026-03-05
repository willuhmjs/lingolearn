import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const classId = params.id;
		const userId = locals.user.id;

		const member = await prisma.classMember.findUnique({
			where: {
				classId_userId: { classId, userId }
			}
		});

		if (!member) {
			return json({ error: 'You are not a member of this class' }, { status: 404 });
		}

		// Teachers cannot leave if they are the only teacher
		if (member.role === 'TEACHER') {
			const teacherCount = await prisma.classMember.count({
				where: { classId, role: 'TEACHER' }
			});
			if (teacherCount <= 1) {
				return json({ error: 'Cannot leave: you are the only teacher. Promote another member first or delete the class.' }, { status: 400 });
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
		return json({ error: 'Failed to leave class' }, { status: 500 });
	}
};
