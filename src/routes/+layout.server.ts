import { getCachedLanguages } from '$lib/server/cache';
import { prisma } from '$lib/server/prisma';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const languages = await getCachedLanguages();

	let onboardedLanguages: typeof languages = [];
	if (locals.user) {
		const progress = await prisma.userProgress.findMany({
			where: { userId: locals.user.id, hasOnboarded: true },
			select: { languageId: true }
		});
		const onboardedIds = new Set(progress.map((p) => p.languageId));
		onboardedLanguages = languages.filter((l) => onboardedIds.has(l.id));
	}

	return {
		user: locals.user,
		languages,
		onboardedLanguages
	};
};
