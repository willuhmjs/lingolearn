import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const classId = params.id;
		const { title, description, gamemode, language, targetScore, dueDate } = await request.json();

		if (!title || !gamemode || !language || targetScore === undefined) {
			return json({ error: 'Title, gamemode, language, and targetScore are required' }, { status: 400 });
		}

		// Verify the user is a TEACHER in this class
		const member = await prisma.classMember.findUnique({
			where: {
				classId_userId: {
					classId,
					userId: locals.user.id
				}
			}
		});

		if (!member || member.role !== 'TEACHER') {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		// Enforce assignment limit (100)
		const assignmentCount = await prisma.assignment.count({
			where: { classId }
		});

		if (assignmentCount >= 100) {
			return json({ error: 'Maximum assignment limit reached for this class (100)' }, { status: 403 });
		}

		// Create the assignment
		const assignment = await prisma.assignment.create({
			data: {
				classId,
				title,
				description: description || null,
				gamemode,
				language,
				targetScore: Number(targetScore),
				dueDate: dueDate ? new Date(dueDate) : null
			}
		});

		return json({ success: true, assignment });
	} catch (error) {
		console.error('Failed to create assignment:', error);
		return json({ error: 'Failed to create assignment' }, { status: 500 });
	}
};
