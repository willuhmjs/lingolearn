import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requireClassRole } from '$lib/server/classAuth';

export const load: PageServerLoad = async ({ locals, params }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/login');
	}

	const classId = params.id;

	// Verify user is a teacher in this class
	if (!locals.user || locals.user.role !== 'ADMIN') {
		await requireClassRole(classId, session.user.id, 'TEACHER');
	}

	// Get class details
	const classData = await prisma.class.findUnique({
		where: { id: classId },
		select: { id: true, name: true, primaryLanguage: true }
	});

	if (!classData) {
		throw error(404, 'Class not found');
	}

	// Get all students in the class
	const students = await prisma.classMember.findMany({
		where: {
			classId,
			role: 'STUDENT'
		},
		select: {
			userId: true
		}
	});

	const studentIds = students.map((s) => s.userId);

	// Get all vocabulary progress for these students
	const progressRecords = await prisma.userVocabularyProgress.findMany({
		where: {
			userId: {
				in: studentIds
			}
		},
		include: {
			// @ts-ignore
			vocabulary: { include: { meanings: true } }
		}
	});

	// Aggregate data — in FSRS, difficulty is [1,10] where higher = harder
	const aggregationMap = new Map<
		string,
		{
			vocabularyId: string;
			lemma: string;
			meaning: string | null;
			totalDifficulty: number;
			count: number;
			strugglingCount: number; // difficulty > 6 is considered struggling
		}
	>();

	for (const record of progressRecords) {
		const vocabId = record.vocabularyId;
		if (!aggregationMap.has(vocabId)) {
			aggregationMap.set(vocabId, {
				vocabularyId: vocabId,
				lemma: (record as any).vocabulary.lemma,
				meaning: (record as any).vocabulary.meanings?.[0]?.value || null,
				totalDifficulty: 0,
				count: 0,
				strugglingCount: 0
			});
		}

		const data = aggregationMap.get(vocabId)!;
		data.totalDifficulty += record.difficulty;
		data.count++;
		if (record.difficulty > 6) {
			data.strugglingCount++;
		}
	}

	const strugglingWords = Array.from(aggregationMap.values())
		.map((data) => ({
			vocabularyId: data.vocabularyId,
			lemma: data.lemma,
			meaning: data.meaning,
			averageDifficulty: data.totalDifficulty / data.count,
			strugglePercentage: (data.strugglingCount / data.count) * 100,
			totalStudentsLearned: data.count
		}))
		.filter((data) => data.totalStudentsLearned > 0)
		// Sort by highest difficulty (hardest first) then struggle percentage
		.sort((a, b) => {
			if (a.averageDifficulty !== b.averageDifficulty) {
				return b.averageDifficulty - a.averageDifficulty;
			}
			return b.strugglePercentage - a.strugglePercentage;
		})
		.slice(0, 50);

	return {
		strugglingWords,
		classData
	};
};
