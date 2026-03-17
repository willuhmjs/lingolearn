import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { prisma } from '$lib/server/prisma';

export const actions = {
  default: async (event) => {
    const sessionToken =
      event.cookies.get('authjs.session-token') ||
      event.cookies.get('__Secure-authjs.session-token');

    if (sessionToken) {
      await prisma.session.deleteMany({
        where: { sessionToken }
      });
    }

    event.cookies.delete('authjs.session-token', { path: '/' });
    event.cookies.delete('__Secure-authjs.session-token', { path: '/' });

    throw redirect(302, '/login');
  }
} satisfies Actions;
