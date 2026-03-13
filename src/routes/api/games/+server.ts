import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
		const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '10') || 10), 50);
		const category = url.searchParams.get('category') || 'All';

		const skip = (page - 1) * limit;

		const where = { 
			isPublished: true,
			...(category && category !== 'All' ? { category } : {})
		};

		const [games, total] = await Promise.all([
			prisma.game.findMany({
				where,
				include: {
					creator: {
						select: { name: true, image: true, username: true }
					},
					_count: {
						select: { questions: true }
					}
				},
				orderBy: { createdAt: 'desc' },
				skip,
				take: limit
			}),
			prisma.game.count({ where })
		]);

		return json({
			games,
			pagination: {
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit)
			}
		});
	} catch (error) {
		console.error('Failed to fetch games:', error);
		return json({ error: 'Failed to fetch games' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { title, description, language } = await request.json();

		if (!title || !language) {
			return json({ error: 'Title and language are required' }, { status: 400 });
		}

		const game = await prisma.game.create({
			data: {
				title,
				description,
				language,
				creatorId: session.user.id,
			}
		});

		return json({ game });
	} catch (error) {
		console.error('Failed to create game:', error);
		return json({ error: 'Failed to create game' }, { status: 500 });
	}
};
