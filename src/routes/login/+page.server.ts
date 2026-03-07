import { prisma } from '$lib/server/prisma';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { getSiteSettings } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	const settings = await getSiteSettings();
	return { localLoginEnabled: settings.localLoginEnabled };
};

export const actions: Actions = {
	default: async (event) => {
		const settings = await getSiteSettings();
		if (!settings.localLoginEnabled) {
			return fail(403, { error: 'Local login is disabled' });
		}
		const formData = await event.request.formData();
		const identifier = formData.get('identifier') as string;
		const password = formData.get('password') as string;

		if (!identifier || !password) {
			return fail(400, { error: 'Email/username and password are required' });
		}

		const user = await prisma.user.findFirst({
			where: {
				OR: [
					{ email: identifier },
					{ username: identifier }
				]
			}
		});

		if (!user || !user.passwordHash) {
			return fail(400, { error: 'Invalid credentials' });
		}

		const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
		if (!passwordsMatch) {
			return fail(400, { error: 'Invalid credentials' });
		}

		// Create a database session
		const sessionToken = randomUUID();
		const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

		await prisma.session.create({
			data: {
				sessionToken,
				userId: user.id,
				expires
			}
		});

		const secure = event.url.protocol === 'https:';
		const cookieName = secure ? '__Secure-authjs.session-token' : 'authjs.session-token';

		event.cookies.set(cookieName, sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure,
			expires
		});

		const redirectTo = event.url.searchParams.get('redirectTo');
		let redirectPath = '/dashboard';
		if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
			redirectPath = redirectTo;
		}

		throw redirect(302, redirectPath);
	}
} satisfies Actions;
