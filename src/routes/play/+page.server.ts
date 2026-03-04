import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	if (!locals.user.hasOnboarded) {
		throw redirect(302, '/onboarding');
	}

	const cefrLevel = locals.user.cefrLevel || 'A1';
	return {
		cefrLevel
	};
};
