import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const userId = locals.user.id;

	const dueReviews = await prisma.userVocabularyProgress.findMany({
		where: {
			userId,
			nextReviewDate: {
				lte: new Date()
			},
			vocabulary: {
				meanings: { some: {} }
			}
		},
		include: {
			vocabulary: {
				include: {
					meanings: true
				}
			}
		},
		orderBy: {
			nextReviewDate: 'asc'
		}
	});

	return {
		dueReviews
	};
}
