import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';
import type { Handle } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { initLoadTimeStat } from '$lib/server/loadTimeStat';
import { apiRateLimiter, authRateLimiter } from '$lib/server/ratelimit';
import { GAMIFICATION_CONFIG } from '$lib/server/srsConfig';
import { runMaintenanceIfDue } from '$lib/server/maintenance';

// Hydrate rolling load-time average from DB on startup
initLoadTimeStat();

// In-memory cache for lastActive throttling
// Maps userId -> last update timestamp
const lastActiveUpdateCache = new Map<string, number>();

const authorization: Handle = async ({ event, resolve }) => {
  // Enforce Content-Type: application/json on mutating API requests to prevent CSRF
  // via form submissions or other non-JSON content types.
  const { method, pathname } = { method: event.request.method, pathname: event.url.pathname };
  if (
    pathname.startsWith('/api') &&
    (method === 'POST' || method === 'PUT' || method === 'PATCH') &&
    event.request.headers.get('content-type') !== null &&
    !event.request.headers.get('content-type')?.includes('application/json')
  ) {
    return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
      status: 415,
      headers: { 'Content-Type': 'application/json' }
    });
  }

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
    if (
      event.url.pathname.startsWith('/dashboard') ||
      event.url.pathname.startsWith('/play') ||
      event.url.pathname.startsWith('/onboarding') ||
      event.url.pathname.startsWith('/admin') ||
      event.url.pathname.startsWith('/classes') ||
      event.url.pathname.startsWith('/dictionary') ||
      event.url.pathname.startsWith('/profile') ||
      event.url.pathname.startsWith('/review') ||
      event.url.pathname.startsWith('/practice')
    ) {
      return new Response(null, {
        status: 303,
        headers: {
          location: `/login?redirectTo=${encodeURIComponent(event.url.pathname + event.url.search)}`
        }
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
    const { getCachedLanguageByCode } = await import('$lib/server/cache');
    activeLanguage = await getCachedLanguageByCode('de');
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
    useLocalLlm: (dbUser as { useLocalLlm?: boolean }).useLocalLlm,
    // llmBaseUrl and llmApiKey are intentionally excluded — they must never
    // be serialized into page data and sent to the client.
    activeLanguage: activeLanguage
      ? {
          id: activeLanguage.id,
          code: activeLanguage.code,
          name: activeLanguage.name,
          flag: activeLanguage.flag
        }
      : null
  };

  // Throttled fire-and-forget lastActive update
  const now = Date.now();
  const lastUpdate = lastActiveUpdateCache.get(session.user.id);

  if (!lastUpdate || now - lastUpdate > GAMIFICATION_CONFIG.LAST_ACTIVE_THROTTLE_MS) {
    lastActiveUpdateCache.set(session.user.id, now);
    prisma.user
      .update({
        where: { id: session.user.id },
        data: { lastActive: new Date() }
      })
      .catch((err) => console.error('Failed to update lastActive', err));
  }

  // Fire maintenance jobs (ELO decay, pruning, etc.) if their interval has elapsed.
  // Each job is non-blocking — returns immediately, runs in the background.
  runMaintenanceIfDue();

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

  if (
    (event.url.pathname.startsWith('/dashboard') || event.url.pathname.startsWith('/play')) &&
    event.locals.user &&
    !event.locals.user.hasOnboarded
  ) {
    return new Response(null, {
      status: 303,
      headers: { location: '/onboarding' }
    });
  }

  return resolve(event, {
    transformPageChunk: ({ html }) => {
      const theme = event.locals.user?.theme || 'default';
      return html
        .replace('data-theme=""', `data-theme="${theme}"`)
        .replace('<html lang="en">', `<html lang="en" data-theme="${theme}">`);
    }
  });
};

export const handle = sequence(authHandle, authorization);
