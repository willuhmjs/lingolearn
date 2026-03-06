import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const classId = params.id;
		const assignmentId = params.assignmentId;

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

		// Delete the assignment
		await prisma.assignment.delete({
			where: {
				id: assignmentId,
				classId: classId
			}
		});

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete assignment:', error);
		return json({ error: 'Failed to delete assignment' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const classId = params.id;
		const assignmentId = params.assignmentId;
		const data = await request.json();

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

		if (!data.title?.trim()) {
			return json({ error: 'Title is required' }, { status: 400 });
		}

		const updatedAssignment = await prisma.assignment.update({
			where: {
				id: assignmentId,
				classId: classId
			},
			data: {
				title: data.title.trim(),
				description: data.description?.trim() || null
			}
		});

		return json(updatedAssignment);
	} catch (error) {
		console.error('Failed to update assignment:', error);
		return json({ error: 'Failed to update assignment' }, { status: 500 });
	}
};
