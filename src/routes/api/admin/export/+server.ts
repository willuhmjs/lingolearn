import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

function adminOnly(locals: App.Locals) {
	return !locals.user || locals.user.role !== 'ADMIN';
}

/** GET /api/admin/export
 *  Full platform export: all language data + users + progress + classes.
 *  Passwords and OAuth tokens are excluded.
 *  Language codes are used for progress entries so the file is portable across environments. */
export const GET: RequestHandler = async ({ locals }) => {
	if (adminOnly(locals)) return json({ error: 'Unauthorized' }, { status: 403 });

	const date = new Date().toISOString();

	const [languages, users, classes] = await Promise.all([
		prisma.language.findMany({ orderBy: { name: 'asc' } }),

		prisma.user.findMany({
			orderBy: { createdAt: 'asc' },
			select: {
				username: true,
				email: true,
				role: true,
				createdAt: true,
				progress: {
					select: {
						language: { select: { code: true } },
						cefrLevel: true,
						hasOnboarded: true,
						updatedAt: true
					}
				},
				vocabularyProgress: {
					select: {
						vocabulary: { select: { lemma: true, language: { select: { code: true } } } },
						nextReviewDate: true,
						difficulty: true,
						stability: true,
						retrievability: true,
						repetitions: true,
						lapses: true,
						lastReviewDate: true,
						reviewCount: true
					}
				},
				grammarRuleProgress: {
					select: {
						grammarRule: { select: { title: true, language: { select: { code: true } } } },
						nextReviewDate: true,
						difficulty: true,
						stability: true,
						retrievability: true,
						repetitions: true,
						lapses: true,
						lastReviewDate: true,
						reviewCount: true
					}
				}
			}
		}),

		prisma.class.findMany({
			orderBy: { createdAt: 'asc' },
			include: {
				members: {
					select: {
						user: { select: { email: true } },
						role: true,
						createdAt: true
					}
				},
				assignments: {
					select: {
						title: true,
						description: true,
						dueDate: true,
						gamemode: true,
						language: true,
						targetScore: true,
						passThreshold: true,
						targetCefrLevel: true,
						targetVocab: true,
						disableHoverTranslation: true,
						createdAt: true
					}
				}
			}
		})
	]);

	const languagesData = await Promise.all(
		languages.map(async (language) => {
			const [vocabulary, grammarRules] = await Promise.all([
				prisma.vocabulary.findMany({
					where: { languageId: language.id },
					orderBy: [{ partOfSpeech: 'asc' }, { lemma: 'asc' }],
					select: {
						lemma: true,
						meanings: true,
						partOfSpeech: true,
						gender: true,
						plural: true,
						isBeginner: true
					}
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

	const exportData = {
		exportedAt: date,
		languages: languagesData,
		users: users.map((u) => ({
			username: u.username,
			email: u.email,
			role: u.role,
			createdAt: u.createdAt,
			progress: u.progress.map((p) => ({
				languageCode: p.language.code,
				cefrLevel: p.cefrLevel,
				hasOnboarded: p.hasOnboarded,
				updatedAt: p.updatedAt
			})),
			vocabularyProgress: u.vocabularyProgress
				.filter((vp) => vp.vocabulary.language)
				.map((vp) => ({
					lemma: vp.vocabulary.lemma,
					languageCode: vp.vocabulary.language!.code,
					nextReviewDate: vp.nextReviewDate,
					difficulty: vp.difficulty,
					stability: vp.stability,
					retrievability: vp.retrievability,
					repetitions: vp.repetitions,
					lapses: vp.lapses,
					lastReviewDate: vp.lastReviewDate,
					reviewCount: vp.reviewCount
				})),
			grammarRuleProgress: u.grammarRuleProgress
				.filter((gp) => gp.grammarRule.language)
				.map((gp) => ({
					title: gp.grammarRule.title,
					languageCode: gp.grammarRule.language!.code,
					nextReviewDate: gp.nextReviewDate,
					difficulty: gp.difficulty,
					stability: gp.stability,
					retrievability: gp.retrievability,
					repetitions: gp.repetitions,
					lapses: gp.lapses,
					lastReviewDate: gp.lastReviewDate,
					reviewCount: gp.reviewCount
				}))
		})),
		classes: classes.map((c) => ({
			name: c.name,
			description: c.description,
			primaryLanguage: c.primaryLanguage,
			createdAt: c.createdAt,
			members: c.members.map((m) => ({
				email: m.user.email,
				role: m.role,
				createdAt: m.createdAt
			})),
			assignments: c.assignments.map((a) => ({
				title: a.title,
				description: a.description,
				dueDate: a.dueDate,
				gamemode: a.gamemode,
				language: a.language,
				targetScore: a.targetScore,
				passThreshold: a.passThreshold,
				targetCefrLevel: a.targetCefrLevel,
				targetVocab: a.targetVocab,
				disableHoverTranslation: a.disableHoverTranslation,
				createdAt: a.createdAt
			}))
		}))
	};

	return new Response(JSON.stringify(exportData, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="full-export-${date.slice(0, 10)}.json"`
		}
	});
};

/** POST /api/admin/export
 *  Import a full-export JSON snapshot (upsert).
 *  - Language vocab + grammar: upserted by lemma / title per language code.
 *  - Users: existing accounts updated by email (no passwords created). New emails are skipped.
 *  - User FSRS progress: upserted by lemma+languageCode / title+languageCode.
 *  - Classes: upserted by name. Members upserted by email. Assignments upserted by title. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (adminOnly(locals)) return json({ error: 'Unauthorized' }, { status: 403 });

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { languages, users, classes } = body;
	const stats = {
		languages: {
			processed: 0,
			vocabCreated: 0,
			vocabUpdated: 0,
			grammarCreated: 0,
			grammarUpdated: 0
		},
		users: { updated: 0, skipped: 0, progressUpserted: 0 },
		classes: { created: 0, updated: 0 }
	};

	// ── Language data ──────────────────────────────────────────────────────────
	if (Array.isArray(languages)) {
		for (const entry of languages) {
			const code = entry?.language?.code;
			if (!code) continue;
			const language = await prisma.language.findFirst({ where: { code } });
			if (!language) continue;
			stats.languages.processed++;

			if (Array.isArray(entry.vocabulary)) {
				for (const v of entry.vocabulary) {
					if (!v.lemma) continue;
					const existing = await prisma.vocabulary.findFirst({
						where: { lemma: v.lemma, languageId: language.id },
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
						stats.languages.vocabUpdated++;
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
								languageId: language.id
							}
						});
						stats.languages.vocabCreated++;
					}
				}
			}

			if (Array.isArray(entry.grammarRules)) {
				// First pass: upsert rules without dependencies
				for (const g of entry.grammarRules) {
					if (!g.title) continue;
					const existing = await prisma.grammarRule.findFirst({
						where: { title: g.title, languageId: language.id }
					});
					if (existing) {
						await prisma.grammarRule.update({
							where: { id: existing.id },
							data: {
								description: g.description ?? existing.description,
								level: g.level ?? existing.level
							}
						});
						stats.languages.grammarUpdated++;
					} else {
						await prisma.grammarRule.create({
							data: {
								title: g.title,
								description: g.description ?? null,
								level: g.level ?? 'A1',
								languageId: language.id
							}
						});
						stats.languages.grammarCreated++;
					}
				}
				// Second pass: reconnect dependencies
				for (const g of entry.grammarRules) {
					if (!g.title || !Array.isArray(g.dependencies) || g.dependencies.length === 0) continue;
					const rule = await prisma.grammarRule.findFirst({
						where: { title: g.title, languageId: language.id }
					});
					if (!rule) continue;
					const depRules = await prisma.grammarRule.findMany({
						where: { title: { in: g.dependencies }, languageId: language.id }
					});
					if (depRules.length > 0) {
						await prisma.grammarRule.update({
							where: { id: rule.id },
							data: { dependencies: { set: depRules.map((d) => ({ id: d.id })) } }
						});
					}
				}
			}
		}
	}

	// ── Users ──────────────────────────────────────────────────────────────────
	// Build a language-code → id map for progress lookups
	const allLanguages = await prisma.language.findMany({ select: { id: true, code: true } });
	const langCodeToId = new Map(allLanguages.map((l) => [l.code, l.id]));

	if (Array.isArray(users)) {
		for (const u of users) {
			if (!u.email) continue;
			const existing = await prisma.user.findUnique({ where: { email: u.email } });
			if (!existing) {
				stats.users.skipped++;
				continue;
			}

			// Update safe profile fields only
			await prisma.user.update({
				where: { id: existing.id },
				data: {
					...(u.username && u.username !== existing.username ? { username: u.username } : {})
				}
			});
			stats.users.updated++;

			// Upsert UserProgress per language
			if (Array.isArray(u.progress)) {
				for (const p of u.progress) {
					const languageId = langCodeToId.get(p.languageCode);
					if (!languageId) continue;
					await prisma.userProgress.upsert({
						where: { userId_languageId: { userId: existing.id, languageId } },
						create: {
							userId: existing.id,
							languageId,
							cefrLevel: p.cefrLevel ?? 'A1',
							hasOnboarded: p.hasOnboarded ?? false
						},
						update: { cefrLevel: p.cefrLevel ?? 'A1', hasOnboarded: p.hasOnboarded ?? false }
					});
				}
			}

			// Upsert UserVocabularyProgress
			if (Array.isArray(u.vocabularyProgress)) {
				for (const vp of u.vocabularyProgress) {
					const languageId = langCodeToId.get(vp.languageCode);
					if (!languageId || !vp.lemma) continue;
					const vocab = await prisma.vocabulary.findFirst({
						where: { lemma: vp.lemma, languageId }
					});
					if (!vocab) continue;
					await prisma.userVocabularyProgress.upsert({
						where: { userId_vocabularyId: { userId: existing.id, vocabularyId: vocab.id } },
						create: {
							userId: existing.id,
							vocabularyId: vocab.id,
							nextReviewDate: new Date(vp.nextReviewDate),
							difficulty: vp.difficulty ?? 5.0,
							stability: vp.stability ?? 0.0,
							retrievability: vp.retrievability ?? 1.0,
							repetitions: vp.repetitions ?? 0,
							lapses: vp.lapses ?? 0,
							lastReviewDate: vp.lastReviewDate ? new Date(vp.lastReviewDate) : null,
							reviewCount: vp.reviewCount ?? 0
						},
						update: {
							nextReviewDate: new Date(vp.nextReviewDate),
							difficulty: vp.difficulty ?? 5.0,
							stability: vp.stability ?? 0.0,
							retrievability: vp.retrievability ?? 1.0,
							repetitions: vp.repetitions ?? 0,
							lapses: vp.lapses ?? 0,
							lastReviewDate: vp.lastReviewDate ? new Date(vp.lastReviewDate) : null,
							reviewCount: vp.reviewCount ?? 0
						}
					});
					stats.users.progressUpserted++;
				}
			}

			// Upsert UserGrammarRuleProgress
			if (Array.isArray(u.grammarRuleProgress)) {
				for (const gp of u.grammarRuleProgress) {
					const languageId = langCodeToId.get(gp.languageCode);
					if (!languageId || !gp.title) continue;
					const rule = await prisma.grammarRule.findFirst({
						where: { title: gp.title, languageId }
					});
					if (!rule) continue;
					await prisma.userGrammarRuleProgress.upsert({
						where: { userId_grammarRuleId: { userId: existing.id, grammarRuleId: rule.id } },
						create: {
							userId: existing.id,
							grammarRuleId: rule.id,
							nextReviewDate: new Date(gp.nextReviewDate),
							difficulty: gp.difficulty ?? 5.0,
							stability: gp.stability ?? 0.0,
							retrievability: gp.retrievability ?? 1.0,
							repetitions: gp.repetitions ?? 0,
							lapses: gp.lapses ?? 0,
							lastReviewDate: gp.lastReviewDate ? new Date(gp.lastReviewDate) : null,
							reviewCount: gp.reviewCount ?? 0
						},
						update: {
							nextReviewDate: new Date(gp.nextReviewDate),
							difficulty: gp.difficulty ?? 5.0,
							stability: gp.stability ?? 0.0,
							retrievability: gp.retrievability ?? 1.0,
							repetitions: gp.repetitions ?? 0,
							lapses: gp.lapses ?? 0,
							lastReviewDate: gp.lastReviewDate ? new Date(gp.lastReviewDate) : null,
							reviewCount: gp.reviewCount ?? 0
						}
					});
					stats.users.progressUpserted++;
				}
			}
		}
	}

	// ── Classes ────────────────────────────────────────────────────────────────
	if (Array.isArray(classes)) {
		for (const c of classes) {
			if (!c.name) continue;
			let cls = await prisma.class.findFirst({ where: { name: c.name } });
			if (!cls) {
				const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
				cls = await prisma.class.create({
					data: {
						name: c.name,
						description: c.description ?? null,
						primaryLanguage: c.primaryLanguage ?? 'international',
						inviteCode
					}
				});
				stats.classes.created++;
			} else {
				await prisma.class.update({
					where: { id: cls.id },
					data: {
						description: c.description ?? cls.description,
						primaryLanguage: c.primaryLanguage ?? cls.primaryLanguage
					}
				});
				stats.classes.updated++;
			}

			if (Array.isArray(c.members)) {
				for (const m of c.members) {
					if (!m.email) continue;
					const user = await prisma.user.findUnique({ where: { email: m.email } });
					if (!user) continue;
					await prisma.classMember.upsert({
						where: { classId_userId: { classId: cls.id, userId: user.id } },
						create: { classId: cls.id, userId: user.id, role: m.role ?? 'STUDENT' },
						update: { role: m.role ?? 'STUDENT' }
					});
				}
			}

			if (Array.isArray(c.assignments)) {
				for (const a of c.assignments) {
					if (!a.title) continue;
					const existing = await prisma.assignment.findFirst({
						where: { classId: cls.id, title: a.title }
					});
					if (!existing) {
						await prisma.assignment.create({
							data: {
								classId: cls.id,
								title: a.title,
								description: a.description ?? null,
								dueDate: a.dueDate ? new Date(a.dueDate) : null,
								gamemode: a.gamemode ?? 'flashcard',
								language: a.language ?? c.primaryLanguage ?? 'de',
								targetScore: a.targetScore ?? 0,
								passThreshold: a.passThreshold ?? 50,
								targetCefrLevel: a.targetCefrLevel ?? null,
								targetVocab: a.targetVocab ?? [],
								disableHoverTranslation: a.disableHoverTranslation ?? false
							}
						});
					}
				}
			}
		}
	}

	return json({ success: true, stats });
};
