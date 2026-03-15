import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { redirect } from '@sveltejs/kit';
import { CefrService } from '$lib/server/cefrService';
import { loadRetentionStats } from '$lib/server/retentionStats';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const user = locals.user;

	if (user.activeLanguage?.id) {
		const progress = await prisma.userProgress.findUnique({
			where: {
				userId_languageId: {
					userId: user.id,
					languageId: user.activeLanguage.id
				}
			}
		});

		if (!progress?.hasOnboarded) {
			throw redirect(302, '/onboarding');
		}
	} else {
		throw redirect(302, '/onboarding');
	}

	const vocabularies = await prisma.userVocabulary.findMany({
		where: {
			userId: user.id,
			vocabulary: { languageId: user.activeLanguage?.id }
		},
		include: { vocabulary: true },
		orderBy: { eloRating: 'desc' }
	});

	const grammarRules = await prisma.userGrammarRule.findMany({
		where: {
			userId: user.id,
			grammarRule: { languageId: user.activeLanguage?.id }
		},
		include: { grammarRule: true },
		orderBy: { eloRating: 'desc' }
	});

	const allGrammarRules = await prisma.grammarRule.findMany({
		where: { languageId: user.activeLanguage?.id },
		include: { dependencies: true },
		orderBy: { level: 'asc' }
	});

	const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

	const [dueVocabReviewCount, dueGrammarReviewCount, dueSoonAssignments, activeLiveSessions] =
		await Promise.all([
			prisma.userVocabularyProgress.count({
				where: {
					userId: user.id,
					nextReviewDate: { lte: new Date() }
				}
			}),
			prisma.userGrammarRuleProgress.count({
				where: {
					userId: user.id,
					nextReviewDate: { lte: new Date() }
				}
			}),
			// Assignments due within 48 hours (or already overdue) that the user hasn't passed yet
			prisma.assignment.findMany({
				where: {
					dueDate: { lte: in48h },
					class: {
						members: {
							some: { userId: user.id, role: 'STUDENT' }
						}
					},
					NOT: {
						scores: { some: { userId: user.id, passed: true } }
					}
				},
				select: {
					id: true,
					title: true,
					dueDate: true,
					classId: true,
					class: { select: { name: true } }
				},
				orderBy: { dueDate: 'asc' },
				take: 5
			}),
			// Active live sessions in classes the user belongs to as a student
			prisma.liveSession.findMany({
				where: {
					status: { in: ['waiting', 'active'] },
					class: {
						members: {
							some: { userId: user.id, role: 'STUDENT' }
						}
					}
				},
				select: {
					id: true,
					classId: true,
					status: true,
					class: { select: { name: true } }
				}
			})
		]);

	const dueReviewCount = dueVocabReviewCount + dueGrammarReviewCount;

	const [cefrProgress, retentionStats] = await Promise.all([
		user.activeLanguage?.id
			? CefrService.getCefrProgress(user.id, user.activeLanguage.id)
			: Promise.resolve(null),
		loadRetentionStats(user.id)
	]);

	// --- Enhanced analytics ---

	// Fetch all vocab progress records for in-depth analysis
	const vocabProgressRecords = await prisma.userVocabularyProgress.findMany({
		where: { userId: user.id },
		select: {
			vocabularyId: true,
			stability: true,
			retrievability: true,
			lastReviewDate: true,
			repetitions: true,
			lapses: true,
			lastErrorType: true,
			overrideCount: true
		}
	});

	const now = new Date();

	// Re-compute current retrievability (stored value is stale since last review)
	// R(t) = (1 + t / (9 * S))^-1
	type UrgentItem = { vocabularyId: string; retrievabilityPct: number; lapses: number };
	const urgentVocab: UrgentItem[] = [];
	const errorTypeCounts: Record<string, number> = {};
	let totalOverrides = 0;

	for (const rec of vocabProgressRecords) {
		if (rec.repetitions === 0) continue;
		let currentRet = 1;
		if (rec.stability > 0 && rec.lastReviewDate) {
			const elapsedDays = (now.getTime() - rec.lastReviewDate.getTime()) / (1000 * 60 * 60 * 24);
			currentRet = Math.max(0, Math.min(1, Math.pow(1 + elapsedDays / (9 * rec.stability), -1)));
		}
		if (currentRet < 0.7) {
			urgentVocab.push({
				vocabularyId: rec.vocabularyId,
				retrievabilityPct: Math.round(currentRet * 100),
				lapses: rec.lapses
			});
		}
		if (rec.lastErrorType) {
			errorTypeCounts[rec.lastErrorType] = (errorTypeCounts[rec.lastErrorType] ?? 0) + 1;
		}
		totalOverrides += rec.overrideCount;
	}
	urgentVocab.sort((a, b) => a.retrievabilityPct - b.retrievabilityPct);

	// Resolve lemmas for top urgent items
	const topUrgentIds = urgentVocab.slice(0, 10).map((u) => u.vocabularyId);
	const urgentVocabDetails =
		topUrgentIds.length > 0
			? await prisma.vocabulary.findMany({
					where: { id: { in: topUrgentIds } },
					select: { id: true, lemma: true, meanings: { select: { value: true }, take: 1 } }
				})
			: [];
	const urgentVocabMap = new Map(urgentVocabDetails.map((v) => [v.id, v]));

	const urgentItems = urgentVocab.slice(0, 10).map((u) => ({
		...u,
		lemma: urgentVocabMap.get(u.vocabularyId)?.lemma ?? u.vocabularyId,
		meaning: urgentVocabMap.get(u.vocabularyId)?.meanings[0]?.value ?? null
	}));

	// Grammar coverage: how many total grammar rules exist vs. how many the user has interacted with
	const totalGrammarRuleCount = allGrammarRules.length;
	const interactedGrammarCount = grammarRules.length;
	const masteredGrammarCount = grammarRules.filter(
		(r) => r.srsState === 'MASTERED' || r.srsState === 'KNOWN'
	).length;
	const lockedGrammarCount = allGrammarRules.filter((rule) => {
		const userRule = grammarRules.find((r) => r.grammarRuleId === rule.id);
		if (userRule) return false; // interacted, not locked
		return rule.dependencies.some(
			(dep) =>
				!grammarRules.find(
					(r) => r.grammarRuleId === dep.id && (r.srsState === 'MASTERED' || r.srsState === 'KNOWN')
				)
		);
	}).length;

	const grammarCoverage = {
		total: totalGrammarRuleCount,
		interacted: interactedGrammarCount,
		mastered: masteredGrammarCount,
		locked: lockedGrammarCount,
		available: totalGrammarRuleCount - interactedGrammarCount - lockedGrammarCount
	};

	return {
		vocabularies,
		grammarRules,
		allGrammarRules,
		dueReviewCount,
		cefrProgress,
		retentionStats,
		dueSoonAssignments,
		activeLiveSessions,
		urgentItems,
		errorTypeCounts,
		totalOverrides,
		grammarCoverage
	};
};
