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

	// Aggregate data
	const aggregationMap = new Map<
		string,
		{
			vocabularyId: string;
			lemma: string;
			meaning: string | null;
			totalEaseFactor: number;
			count: number;
			strugglingCount: number; // easeFactor < 2.5 is considered struggling
		}
	>();

	for (const record of progressRecords) {
		const vocabId = record.vocabularyId;
		if (!aggregationMap.has(vocabId)) {
			aggregationMap.set(vocabId, {
				vocabularyId: vocabId,
				lemma: (record as any).vocabulary.lemma,
				meaning: (record as any).vocabulary.meanings?.[0]?.value || null,
				totalEaseFactor: 0,
				count: 0,
				strugglingCount: 0
			});
		}

		const data = aggregationMap.get(vocabId)!;
		data.totalEaseFactor += record.easeFactor;
		data.count++;
		if (record.easeFactor < 2.5) {
			data.strugglingCount++;
		}
	}

	const strugglingWords = Array.from(aggregationMap.values())
		.map((data) => ({
			vocabularyId: data.vocabularyId,
			lemma: data.lemma,
			meaning: data.meaning,
			averageEaseFactor: data.totalEaseFactor / data.count,
			strugglePercentage: (data.strugglingCount / data.count) * 100,
			totalStudentsLearned: data.count
		}))
		// Filter out words where not enough students have seen it (optional, maybe >= 1 student is fine)
		.filter((data) => data.totalStudentsLearned > 0)
		// Sort by lowest ease factor and highest struggle percentage
		.sort((a, b) => {
			if (a.averageEaseFactor !== b.averageEaseFactor) {
				return a.averageEaseFactor - b.averageEaseFactor; // lower ease factor first
			}
			return b.strugglePercentage - a.strugglePercentage; // higher struggle percentage first
		})
		.slice(0, 50); // top 50 struggling words

	return {
		strugglingWords,
		classData
	};
};
