import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';
import type { Handle } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

const authorization: Handle = async ({ event, resolve }) => {
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

	event.locals.user = {
		id: session.user.id,
		// @ts-expect-error - Custom property
		username: session.user.username,
		// @ts-expect-error - Custom property
		cefrLevel: session.user.cefrLevel,
		// @ts-expect-error - Custom property
		hasOnboarded: session.user.hasOnboarded,
		// @ts-expect-error - Custom property
		role: session.user.role
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

	return resolve(event);
};

export const handle = sequence(authHandle, authorization);
