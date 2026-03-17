import { redirect } from '@sveltejs/kit';
import { getCachedLanguages } from '$lib/server/cache';

export const load = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const languages = await getCachedLanguages();

  return {
    languages
  };
};
