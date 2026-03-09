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
		const assignmentId = params.assignmentId;

		// Verify the user is a TEACHER in this class
		if (locals.user.role !== 'ADMIN') {
			await requireClassRole(classId, locals.user.id, 'TEACHER');
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
		if (typeof error === 'object' && error !== null && 'status' in error && 'body' in error) {
			const e = error as { status: number; body: { message: string } };
			return json({ error: e.body.message }, { status: e.status });
		}
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
		if (locals.user.role !== 'ADMIN') {
			await requireClassRole(classId, locals.user.id, 'TEACHER');
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
				description: data.description?.trim() || null,
				gamemode: data.gamemode || undefined,
				targetScore: data.targetScore ? parseInt(data.targetScore, 10) : undefined,
				passThreshold: data.passThreshold !== undefined ? parseInt(data.passThreshold, 10) : undefined,
				language: data.language || undefined,
				targetCefrLevel: data.targetCefrLevel || null,
				topic: data.topic?.trim() || null,
				targetGrammar: data.targetGrammar || [],
				targetVocab: data.targetVocab || []
			}
		});

		return json(updatedAssignment);
	} catch (error) {
		console.error('Failed to update assignment:', error);
		if (typeof error === 'object' && error !== null && 'status' in error && 'body' in error) {
			const e = error as { status: number; body: { message: string } };
			return json({ error: e.body.message }, { status: e.status });
		}
		return json({ error: 'Failed to update assignment' }, { status: 500 });
	}
};
