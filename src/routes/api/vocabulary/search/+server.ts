import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { Prisma } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({ url, locals }: RequestEvent) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const query = url.searchParams.get('q');

	if (!query || query.trim().length === 0) {
		return json({ results: [] });
	}

	const activeLanguageId = locals.user?.activeLanguage?.id;

	const whereClause: Prisma.VocabularyWhereInput = {
		OR: [
			{
				lemma: {
					contains: query,
					mode: 'insensitive'
				}
			},
			{
				meanings: {
					some: {
						value: {
							contains: query,
							mode: 'insensitive'
						}
					}
				}
			} as any
		]
	};

	if (activeLanguageId) {
		whereClause.languageId = activeLanguageId;
	}

	const userId = locals.user.id;

	const results = await prisma.vocabulary.findMany({
		where: whereClause,
		take: 20,
		orderBy: [{ frequency: 'asc' }],
		include: {
			meanings: true,
			users: {
				where: { userId },
				select: { srsState: true }
			}
		}
	});

	// Flatten userSrsState onto each result
	const enriched = results.map((r) => ({
		...r,
		userSrsState: r.users?.[0]?.srsState ?? null
	}));

	return json({ results: enriched });
};
