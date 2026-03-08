import { prisma } from '$lib/server/prisma';
import { error } from '@sveltejs/kit';

export async function load({ params, locals }) {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw error(401, 'Unauthorized');
	}

	const classId = params.id;
	const userId = session.user.id;

	const classMember = await prisma.classMember.findFirst({
		where: { classId, userId, role: 'TEACHER' }
	});

	if (!classMember) {
		throw error(403, 'Forbidden');
	}

	const classDetails = await prisma.class.findUnique({
		where: { id: classId },
		select: { name: true }
	});

	if (!classDetails) {
		throw error(404, 'Class not found');
	}

	return {
		className: classDetails.name
	};
}
