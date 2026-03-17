import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

function adminOnly(locals: App.Locals) {
	return !locals.user || locals.user.role !== 'ADMIN';
}

/** GET /api/admin/language-data?languageId=xxx
 *  Export vocabulary + grammar rules as a seed-compatible JSON snapshot.
 *  Omit languageId (or pass "all") to export every language in one file. */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (adminOnly(locals)) return json({ error: 'Unauthorized' }, { status: 403 });

	const languageId = url.searchParams.get('languageId');
	const exportAll = !languageId || languageId === 'all';

	const vocabSelect = {
		lemma: true,
		meanings: { select: { value: true, partOfSpeech: true } },
		partOfSpeech: true,
		gender: true,
		plural: true,
		isBeginner: true
	} as const;

	if (exportAll) {
		const languages = await prisma.language.findMany({ orderBy: { name: 'asc' } });
		const date = new Date().toISOString();

		const languagesData = await Promise.all(
			languages.map(async (language) => {
				const [vocabulary, grammarRules] = await Promise.all([
					prisma.vocabulary.findMany({
						where: { languageId: language.id },
						orderBy: [{ partOfSpeech: 'asc' }, { lemma: 'asc' }],
						select: vocabSelect
					}),
					prisma.grammarRule.findMany({
						where: { languageId: language.id },
						orderBy: { level: 'asc' },
						include: { dependencies: { select: { title: true } } }
					})
				]);
				return {
					language: { code: language.code, name: language.name, flag: language.flag },
					vocabulary: vocabulary.map((v) => ({
						lemma: v.lemma,
						meanings: v.meanings,
						partOfSpeech: v.partOfSpeech,
						gender: v.gender,
						plural: v.plural,
						isBeginner: v.isBeginner
					})),
					grammarRules: grammarRules.map((g) => ({
						title: g.title,
						description: g.description,
						level: g.level,
						dependencies: g.dependencies.map((d) => d.title)
					}))
				};
			})
		);

		const exportData = { exportedAt: date, languages: languagesData };
		return new Response(JSON.stringify(exportData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="all-language-data-${date.slice(0, 10)}.json"`
			}
		});
	}

	const [language, vocabulary, grammarRules] = await Promise.all([
		prisma.language.findUnique({ where: { id: languageId } }),
		prisma.vocabulary.findMany({
			where: { languageId },
			orderBy: [{ partOfSpeech: 'asc' }, { lemma: 'asc' }],
			select: vocabSelect
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
		vocabulary: vocabulary.map((v) => ({
			lemma: v.lemma,
			meanings: v.meanings,
			partOfSpeech: v.partOfSpeech,
			gender: v.gender,
			plural: v.plural,
			isBeginner: v.isBeginner
		})),
		grammarRules: grammarRules.map((g) => ({
			title: g.title,
			description: g.description,
			level: g.level,
			dependencies: g.dependencies.map((d) => d.title)
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
 *
 *  Single-language: { languageId: string, vocabulary?: VocabEntry[], grammarRules?: GrammarRuleEntry[] }
 *  All-languages:   { languages: [{ language: { code }, vocabulary?, grammarRules? }] }
 *
 *  Vocabulary is matched by lemma — updates pos/gender/plural if changed.
 *  Grammar rules are matched by title — updates description/level if changed. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (adminOnly(locals)) return json({ error: 'Unauthorized' }, { status: 403 });

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	// ── Multi-language format ──────────────────────────────────────────────────
	if (Array.isArray(body.languages)) {
		let totalVocabCreated = 0,
			totalVocabUpdated = 0;
		let totalGrammarCreated = 0,
			totalGrammarUpdated = 0;
		let languagesProcessed = 0;

		for (const entry of body.languages) {
			const code = entry?.language?.code;
			if (!code) continue;
			const language = await prisma.language.findFirst({ where: { code } });
			if (!language) continue;
			languagesProcessed++;

			const { vc, vu, gc, gu } = await upsertLanguageData(
				language.id,
				entry.vocabulary,
				entry.grammarRules
			);
			totalVocabCreated += vc;
			totalVocabUpdated += vu;
			totalGrammarCreated += gc;
			totalGrammarUpdated += gu;
		}

		return json({
			success: true,
			languagesProcessed,
			vocab: { created: totalVocabCreated, updated: totalVocabUpdated },
			grammar: { created: totalGrammarCreated, updated: totalGrammarUpdated }
		});
	}

	// ── Single-language format ────────────────────────────────────────────────
	const { languageId, vocabulary, grammarRules } = body;
	if (!languageId) return json({ error: 'languageId is required' }, { status: 400 });

	const language = await prisma.language.findUnique({ where: { id: languageId } });
	if (!language) return json({ error: 'Language not found' }, { status: 404 });

	const { vc, vu, gc, gu } = await upsertLanguageData(languageId, vocabulary, grammarRules);

	return json({
		success: true,
		vocab: { created: vc, updated: vu },
		grammar: { created: gc, updated: gu }
	});
};

async function upsertLanguageData(
	languageId: string,
	vocabulary: any[] | undefined,
	grammarRules: any[] | undefined
): Promise<{ vc: number; vu: number; gc: number; gu: number }> {
	let vc = 0,
		vu = 0,
		gc = 0,
		gu = 0;

	if (Array.isArray(vocabulary)) {
		for (const v of vocabulary) {
			if (!v.lemma) continue;
			const existing = await prisma.vocabulary.findFirst({
				where: { lemma: v.lemma, languageId },
				include: { meanings: true }
			});
			if (existing) {
				const hasMeaning = existing.meanings && existing.meanings.length > 0;
				if (v.meaning && !hasMeaning) {
					await prisma.vocabulary.update({
						where: { id: existing.id },
						data: {
							meanings: {
								create: [
									{ value: v.meaning, partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech }
								]
							},
							partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech,
							gender: v.gender ?? existing.gender,
							plural: v.plural ?? existing.plural,
							isBeginner: v.isBeginner ?? existing.isBeginner
						}
					});
				} else {
					await prisma.vocabulary.update({
						where: { id: existing.id },
						data: {
							partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech,
							gender: v.gender ?? existing.gender,
							plural: v.plural ?? existing.plural,
							isBeginner: v.isBeginner ?? existing.isBeginner
						}
					});
				}
				vu++;
			} else {
				await prisma.vocabulary.create({
					data: {
						lemma: v.lemma,
						meanings: v.meaning
							? { create: [{ value: v.meaning, partOfSpeech: v.partOfSpeech ?? null }] }
							: undefined,
						partOfSpeech: v.partOfSpeech ?? null,
						gender: v.gender ?? null,
						plural: v.plural ?? null,
						isBeginner: v.isBeginner ?? false,
						languageId
					}
				});
				vc++;
			}
		}
	}

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
				gu++;
			} else {
				await prisma.grammarRule.create({
					data: {
						title: g.title,
						description: g.description ?? null,
						level: g.level ?? 'A1',
						languageId
					}
				});
				gc++;
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
					data: { dependencies: { set: depRules.map((d) => ({ id: d.id })) } }
				});
			}
		}
	}

	return { vc, vu, gc, gu };
}

/** DELETE /api/admin/language-data?languageId=xxx&scope=vocab|grammar|all
 *  Removes all vocabulary and/or grammar rules for the given language.
 *  WARNING: Also deletes all UserVocabulary and UserGrammarRule rows for the language. */
export const DELETE: RequestHandler = async ({ locals, url }) => {
	if (adminOnly(locals)) return json({ error: 'Unauthorized' }, { status: 403 });

	const languageId = url.searchParams.get('languageId');
	const scope = url.searchParams.get('scope') ?? 'all';
	if (!languageId) return json({ error: 'languageId is required' }, { status: 400 });

	let vocabDeleted = 0,
		grammarDeleted = 0;

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
