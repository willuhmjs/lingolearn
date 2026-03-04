import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	if (!locals.user.hasOnboarded) {
		throw redirect(302, '/onboarding');
	}

	const user = locals.user;

	const vocabularies = await prisma.userVocabulary.findMany({
		where: { userId: user.id },
		include: { vocabulary: true },
		orderBy: { eloRating: 'desc' }
	});

	const grammarRules = await prisma.userGrammarRule.findMany({
		where: { userId: user.id },
		include: { grammarRule: true },
		orderBy: { eloRating: 'desc' }
	});

	return {
		vocabularies,
		grammarRules
	};
};
