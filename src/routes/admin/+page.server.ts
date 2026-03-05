import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { runSeed } from '../../../prisma/seed';
import { getSiteSettings, updateSiteSettings } from '$lib/server/settings';

export const load: PageServerLoad = async ({ locals }) => {
	// Additional fallback check though hooks.server.ts handles it
	if (!locals.user || locals.user.role !== 'ADMIN') {
		throw redirect(303, '/');
	}

	const [users, settings, languages] = await Promise.all([
		prisma.user.findMany({
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				username: true,
				email: true,
				role: true,
				createdAt: true,
				lastActive: true,
				activeLanguage: true,
				progress: {
					include: { language: true }
				}
			}
		}),
		getSiteSettings(),
		(prisma as any).language.findMany({
			orderBy: { name: 'asc' },
			include: {
				_count: { select: { vocabularies: true, grammarRules: true } }
			}
		})
	]);

	return { users, localLoginEnabled: settings.localLoginEnabled, languages };
};

export const actions: Actions = {
	runSeed: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'ADMIN') {
			return fail(403, { message: 'Unauthorized' });
		}

		try {
			await runSeed(prisma, true);
			return { success: true, message: 'Seed script executed successfully.' };
		} catch (error) {
			console.error('Seed execution failed:', error);
			return fail(500, { message: 'Failed to run seed script.' });
		}
	},
	toggleLocalLogin: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'ADMIN') {
			return fail(403, { message: 'Unauthorized' });
		}

		try {
			const current = await getSiteSettings();
			await updateSiteSettings({ localLoginEnabled: !current.localLoginEnabled });
			const status = !current.localLoginEnabled ? 'enabled' : 'disabled';
			return { success: true, message: `Local login ${status}.` };
		} catch (error) {
			console.error('Toggle local login failed:', error);
			return fail(500, { message: 'Failed to toggle local login.' });
		}
	}
};