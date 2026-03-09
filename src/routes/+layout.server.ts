import { getCachedLanguages } from '$lib/server/cache';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const languages = await getCachedLanguages();

	return {
		user: locals.user,
		languages
	};
};
