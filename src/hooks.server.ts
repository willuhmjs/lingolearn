import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';
import type { Handle } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { initLoadTimeStat } from '$lib/server/loadTimeStat';
import { apiRateLimiter, authRateLimiter } from '$lib/server/ratelimit';

// Hydrate rolling load-time average from DB on startup
initLoadTimeStat();

const authorization: Handle = async ({ event, resolve }) => {
	// Rate limiting logic
	if (event.url.pathname.startsWith('/api')) {
		if (await apiRateLimiter.isLimited(event)) {
			return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
			});
		}
	} else if (event.url.pathname.startsWith('/login') || event.url.pathname.startsWith('/signup')) {
		if (await authRateLimiter.isLimited(event)) {
			// SvelteKit form actions handle JSON differently, but simple Response is fine if standard page/api
			return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '60' } });
		}
	}

	const session = await event.locals.auth();

	if (!session || !session.user || !session.user.id) {
		event.locals.user = null;
		if (event.url.pathname.startsWith('/dashboard') || event.url.pathname.startsWith('/play') || event.url.pathname.startsWith('/onboarding') || event.url.pathname.startsWith('/admin')) {
			return new Response(null, {
				status: 303,
				headers: { location: '/login' }
			});
		}
		if (event.url.pathname.startsWith('/api/admin')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return resolve(event);
	}

	const dbUser = await prisma.user.findUnique({
		where: { id: session.user.id },
		include: { activeLanguage: true }
	});

	if (!dbUser) {
		event.locals.user = null;
		return resolve(event);
	}

	let activeLanguage = dbUser.activeLanguage;
	if (!activeLanguage) {
		activeLanguage = await prisma.language.findUnique({
			where: { code: 'de' }
		});
	}

	let cefrLevel = 'A1';
	let hasOnboarded = false;

	if (activeLanguage) {
		const progress = await prisma.userProgress.findUnique({
			where: {
				userId_languageId: {
					userId: dbUser.id,
					languageId: activeLanguage.id
				}
			}
		});
		if (progress) {
			cefrLevel = progress.cefrLevel;
			hasOnboarded = progress.hasOnboarded;
		}
	}

	event.locals.user = {
		id: dbUser.id,
		username: dbUser.username || '',
		cefrLevel,
		hasOnboarded,
		role: dbUser.role,
		theme: dbUser.theme || 'default',
		totalXp: (dbUser as { totalXp?: number }).totalXp || 0,
		currentStreak: (dbUser as { currentStreak?: number }).currentStreak || 0,
		activeLanguage: activeLanguage ? {
			id: activeLanguage.id,
			code: activeLanguage.code,
			name: activeLanguage.name,
			flag: activeLanguage.flag
		} : null
	};

	// Fire-and-forget lastActive update
	prisma.user.update({
		where: { id: session.user.id },
		data: { lastActive: new Date() }
	}).catch((err) => console.error('Failed to update lastActive', err));

	if (event.url.pathname.startsWith('/admin') && event.locals.user.role !== 'ADMIN') {
		return new Response(null, {
			status: 303,
			headers: { location: '/' }
		});
	}

	if (event.url.pathname.startsWith('/api/admin') && event.locals.user.role !== 'ADMIN') {
		return new Response(JSON.stringify({ error: 'Forbidden' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if ((event.url.pathname.startsWith('/dashboard') || event.url.pathname.startsWith('/play')) && event.locals.user && !event.locals.user.hasOnboarded) {
		return new Response(null, {
			status: 303,
			headers: { location: '/onboarding' }
		});
	}

	return resolve(event, {
		transformPageChunk: ({ html }) => {
			const theme = event.locals.user?.theme || 'default';
			return html.replace('data-theme=""', `data-theme="${theme}"`).replace('<html lang="en">', `<html lang="en" data-theme="${theme}">`);
		}
	});
};

export const handle = sequence(authHandle, authorization);
