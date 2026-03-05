// @ts-nocheck
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

function adminOnly(locals: App.Locals) {
	return !locals.user || locals.user.role !== 'ADMIN';
}

/** GET /api/admin/language-data?languageId=xxx
 *  Export all vocabulary + grammar rules for a language as a seed-compatible JSON snapshot. */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (adminOnly(locals)) return json({ error: 'Unauthorized' }, { status: 403 });

	const languageId = url.searchParams.get('languageId');
	if (!languageId) return json({ error: 'languageId is required' }, { status: 400 });

	const [language, vocabulary, grammarRules] = await Promise.all([
		prisma.language.findUnique({ where: { id: languageId } }),
		prisma.vocabulary.findMany({
			where: { languageId },
			orderBy: [{ partOfSpeech: 'asc' }, { lemma: 'asc' }],
			select: { lemma: true, meaning: true, partOfSpeech: true, gender: true, plural: true, isBeginner: true }
		}),
		prisma.grammarRule.findMany({
			where: { languageId },
			orderBy: { level: 'asc' },
			include: { dependencies: { select: { title: true } } }
		})
	]);

	if (!language) return json({ error: 'Language not found' }, { status: 404 });

	const exportData = {
		language: { code: language.code, name: language.name, flag: language.flag },
		exportedAt: new Date().toISOString(),
		vocabulary: vocabulary.map(v => ({
			lemma: v.lemma,
			meaning: v.meaning,
			partOfSpeech: v.partOfSpeech,
			gender: v.gender,
			plural: v.plural,
			isBeginner: v.isBeginner
		})),
		grammarRules: grammarRules.map(g => ({
			title: g.title,
			description: g.description,
			level: g.level,
			dependencies: g.dependencies.map(d => d.title)
		}))
	};

	return new Response(JSON.stringify(exportData, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="${language.code}-language-data-${new Date().toISOString().slice(0, 10)}.json"`
		}
	});
};

/** POST /api/admin/language-data
 *  Import (upsert) vocabulary and/or grammar rules from a JSON snapshot.
 *  Body: { languageId: string, vocabulary?: VocabEntry[], grammarRules?: GrammarRuleEntry[] }
 *  Vocabulary is matched by lemma — updates meaning/pos/gender/plural if changed.
 *  Grammar rules are matched by title — updates description/level if changed. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (adminOnly(locals)) return json({ error: 'Unauthorized' }, { status: 403 });

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { languageId, vocabulary, grammarRules } = body;
	if (!languageId) return json({ error: 'languageId is required' }, { status: 400 });

	const language = await prisma.language.findUnique({ where: { id: languageId } });
	if (!language) return json({ error: 'Language not found' }, { status: 404 });

	let vocabCreated = 0, vocabUpdated = 0;
	let grammarCreated = 0, grammarUpdated = 0;

	// --- Vocabulary upsert ---
	if (Array.isArray(vocabulary)) {
		for (const v of vocabulary) {
			if (!v.lemma) continue;
			const existing = await prisma.vocabulary.findFirst({
				where: { lemma: v.lemma, languageId }
			});
			if (existing) {
				await prisma.vocabulary.update({
					where: { id: existing.id },
					data: {
						meaning: v.meaning ?? existing.meaning,
						partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech,
						gender: v.gender ?? existing.gender,
						plural: v.plural ?? existing.plural,
						isBeginner: v.isBeginner ?? existing.isBeginner
					}
				});
				vocabUpdated++;
			} else {
				await prisma.vocabulary.create({
					data: {
						lemma: v.lemma,
						meaning: v.meaning ?? null,
						partOfSpeech: v.partOfSpeech ?? null,
						gender: v.gender ?? null,
						plural: v.plural ?? null,
						isBeginner: v.isBeginner ?? false,
						languageId
					}
				});
				vocabCreated++;
			}
		}
	}

	// --- Grammar rules upsert (two-pass: create then connect deps) ---
	if (Array.isArray(grammarRules)) {
		// First pass: upsert rules without dependencies
		for (const g of grammarRules) {
			if (!g.title) continue;
			const existing = await prisma.grammarRule.findFirst({
				where: { title: g.title, languageId }
			});
			if (existing) {
				await prisma.grammarRule.update({
					where: { id: existing.id },
					data: {
						description: g.description ?? existing.description,
						level: g.level ?? existing.level
					}
				});
				grammarUpdated++;
			} else {
				await prisma.grammarRule.create({
					data: {
						title: g.title,
						description: g.description ?? null,
						level: g.level ?? 'A1',
						languageId
					}
				});
				grammarCreated++;
			}
		}

		// Second pass: reconnect dependencies
		for (const g of grammarRules) {
			if (!g.title || !Array.isArray(g.dependencies) || g.dependencies.length === 0) continue;
			const rule = await prisma.grammarRule.findFirst({ where: { title: g.title, languageId } });
			if (!rule) continue;
			const depRules = await prisma.grammarRule.findMany({
				where: { title: { in: g.dependencies }, languageId }
			});
			if (depRules.length > 0) {
				await prisma.grammarRule.update({
					where: { id: rule.id },
					data: { dependencies: { set: depRules.map(d => ({ id: d.id })) } }
				});
			}
		}
	}

	return json({
		success: true,
		vocab: { created: vocabCreated, updated: vocabUpdated },
		grammar: { created: grammarCreated, updated: grammarUpdated }
	});
};

/** DELETE /api/admin/language-data?languageId=xxx&scope=vocab|grammar|all
 *  Removes all vocabulary and/or grammar rules for the given language.
 *  WARNING: Also deletes all UserVocabulary and UserGrammarRule rows for the language. */
export const DELETE: RequestHandler = async ({ locals, url }) => {
	if (adminOnly(locals)) return json({ error: 'Unauthorized' }, { status: 403 });

	const languageId = url.searchParams.get('languageId');
	const scope = url.searchParams.get('scope') ?? 'all';
	if (!languageId) return json({ error: 'languageId is required' }, { status: 400 });

	let vocabDeleted = 0, grammarDeleted = 0;

	if (scope === 'vocab' || scope === 'all') {
		const { count } = await prisma.vocabulary.deleteMany({ where: { languageId } });
		vocabDeleted = count;
	}
	if (scope === 'grammar' || scope === 'all') {
		const { count } = await prisma.grammarRule.deleteMany({ where: { languageId } });
		grammarDeleted = count;
	}

	return json({ success: true, vocabDeleted, grammarDeleted });
};
