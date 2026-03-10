import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getSiteSettings } from '$lib/server/settings';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const [user, settings, userProgress] = await Promise.all([
		prisma.user.findUnique({
			where: { id: locals.user.id },
			select: { passwordHash: true }
		}),
		getSiteSettings(),
		prisma.userProgress.findMany({
			where: { userId: locals.user.id },
			include: { language: true }
		})
	]);

	const activeProgress = userProgress.find(
		(p: { languageId: string }) => p.languageId === locals.user?.activeLanguage?.id
	);

	return {
		user: locals.user,
		hasPassword: !!user?.passwordHash,
		localLoginEnabled: settings.localLoginEnabled,
		activeProgress,
		allProgress: userProgress
	};
};

const passwordSchema = z.object({
	currentPassword: z.string().optional(),
	newPassword: z.string().min(8).max(128)
});

export const actions: Actions = {
	updatePassword: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const settings = await getSiteSettings();
		if (!settings.localLoginEnabled) {
			return fail(403, { error: 'Password updates are disabled because local login is disabled.' });
		}

		const formData = await request.formData();
		const data = Object.fromEntries(formData);
		const parsed = passwordSchema.safeParse(data);

		if (!parsed.success) {
			return fail(400, { error: 'Invalid input. Password must be at least 8 characters.' });
		}

		const { currentPassword, newPassword } = parsed.data;

		const user = await prisma.user.findUnique({
			where: { id: locals.user.id }
		});

		if (!user) {
			return fail(404, { error: 'User not found' });
		}

		if (user.passwordHash) {
			if (!currentPassword) {
				return fail(400, { error: 'Current password is required' });
			}
			const match = await bcrypt.compare(currentPassword, user.passwordHash);
			if (!match) {
				return fail(400, { error: 'Incorrect current password' });
			}
		}

		const passwordHash = await bcrypt.hash(newPassword, 10);

		await prisma.user.update({
			where: { id: locals.user.id },
			data: { passwordHash }
		});

		return { success: 'Password updated successfully' };
	},

	updateTheme: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const theme = formData.get('theme');

		if (!theme || typeof theme !== 'string' || !['default', 'dark'].includes(theme)) {
			return fail(400, { themeError: 'Invalid theme selected' });
		}

		await prisma.user.update({
			where: { id: locals.user.id },
			data: { theme }
		});

		return { themeSuccess: 'Theme updated successfully' };
	},

	updateLlmSettings: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const useLocalLlm = formData.get('useLocalLlm') === 'on';
		const llmBaseUrl = formData.get('llmBaseUrl')?.toString() || null;
		const llmApiKey = formData.get('llmApiKey')?.toString() || null;

		try {
			await prisma.user.update({
				where: { id: locals.user.id },
				data: {
					useLocalLlm,
					llmBaseUrl,
					llmApiKey
				}
			});

			return { llmSuccess: 'LLM settings updated successfully' };
		} catch (error) {
			console.error('Error updating LLM settings:', error);
			return fail(500, { llmError: 'Failed to update LLM settings' });
		}
	},

	deleteAccount: async ({ locals, cookies }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		// Prisma will cascade delete UserVocabulary, UserGrammarRule, Accounts, Sessions
		// due to the onDelete: Cascade in the schema
		await prisma.user.delete({
			where: { id: locals.user.id }
		});

		// Clear auth cookies using Auth.js standard session cookie names
		// This ensures the user is logged out
		cookies.delete('authjs.session-token', { path: '/' });
		cookies.delete('authjs.csrf-token', { path: '/' });
		cookies.delete('authjs.callback-url', { path: '/' });

		// We could also call the signout endpoint, but redirecting to / with a cleared cookie usually works well
		// and we don't want to get stuck in a weird state.

		throw redirect(303, '/login');
	}
};
