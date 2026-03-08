import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { title, description, isPublished } = await request.json();

		const game = await prisma.game.findUnique({
			where: { id: params.id }
		});

		if (!game) {
			return json({ error: 'Game not found' }, { status: 404 });
		}

		if (game.creatorId !== session.user.id && locals.user?.role !== 'ADMIN') {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const updatedGame = await prisma.game.update({
			where: { id: params.id },
			data: {
				title: title !== undefined ? title : game.title,
				description: description !== undefined ? description : game.description,
				isPublished: (title !== undefined || description !== undefined) ? false : (isPublished !== undefined ? isPublished : game.isPublished),
			}
		});

		return json({ game: updatedGame });
	} catch (error) {
		console.error('Failed to update game:', error);
		return json({ error: 'Failed to update game' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const game = await prisma.game.findUnique({
			where: { id: params.id }
		});

		if (!game) {
			return json({ error: 'Game not found' }, { status: 404 });
		}

		if (game.creatorId !== session.user.id && locals.user?.role !== 'ADMIN') {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await prisma.game.delete({
			where: { id: params.id }
		});

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete game:', error);
		return json({ error: 'Failed to delete game' }, { status: 500 });
	}
};
