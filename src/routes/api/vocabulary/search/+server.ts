import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { Prisma } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({ url, locals }: RequestEvent) => {
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

	// Very simple search implementation
	const results = await prisma.vocabulary.findMany({
		where: whereClause,
		take: 20,
		include: {
			meanings: true
		}
	});

	return json({ results });
};
