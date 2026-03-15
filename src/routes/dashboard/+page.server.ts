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

	const [dueVocabReviewCount, dueGrammarReviewCount, dueSoonAssignments, activeLiveSessions] = await Promise.all([
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

	return {
		vocabularies,
		grammarRules,
		allGrammarRules,
		dueReviewCount,
		cefrProgress,
		retentionStats,
		dueSoonAssignments,
		activeLiveSessions
	};
};
