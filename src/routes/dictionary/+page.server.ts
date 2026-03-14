import { redirect } from '@sveltejs/kit';
import type { ServerLoadEvent } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const load = async ({ locals }: ServerLoadEvent) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	let grammarRules: any[] = [];
	if (locals.user.activeLanguage?.id) {
		grammarRules = await prisma.grammarRule.findMany({
			where: { languageId: locals.user.activeLanguage.id },
			orderBy: [{ level: 'asc' }, { title: 'asc' }],
			include: {
				dependencies: { select: { id: true, title: true, level: true } }
			}
		});
	}

	return {
		user: locals.user,
		grammarRules
	};
};
