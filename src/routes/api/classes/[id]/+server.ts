import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requireClassRole } from '$lib/server/classAuth';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const classId = params.id;
		const userId = locals.user.id;

		if (locals.user.role !== 'ADMIN') {
			await requireClassRole(classId, userId, 'TEACHER');
		}

		await prisma.class.delete({
			where: { id: classId }
		});

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete class:', error);
		return json({ error: 'Failed to delete class' }, { status: 500 });
	}
};
