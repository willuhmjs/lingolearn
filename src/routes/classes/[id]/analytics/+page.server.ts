import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requireClassRole } from '$lib/server/classAuth';
import { CEFR_CONFIG } from '$lib/server/srsConfig';

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

  // Get class details and all students with their basic user info in one query
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      primaryLanguage: true,
      members: {
        where: { role: 'STUDENT' },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              totalXp: true,
              currentStreak: true,
              progress: {
                select: { userId: true, cefrLevel: true, languageId: true }
              }
            }
          }
        }
      }
    }
  });

  if (!classData) {
    throw error(404, 'Class not found');
  }

  const studentIds = classData.members.map((m) => m.userId);

  // Get all vocabulary progress and grammar progress for these students in parallel
  const [progressRecords, grammarProgressRecords] = await Promise.all([
    prisma.userVocabularyProgress.findMany({
      where: { userId: { in: studentIds } },
      include: {
        vocabulary: { include: { meanings: true } }
      }
    }),
    prisma.userGrammarRuleProgress.findMany({
      where: { userId: { in: studentIds } },
      select: {
        userId: true,
        grammarRuleId: true,
        difficulty: true,
        lapses: true,
        repetitions: true,
        lastErrorType: true,
        grammarRule: { select: { title: true, level: true } }
      }
    })
  ]);

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

  const vocabByStudent = new Map<string, typeof progressRecords>();

  for (const record of progressRecords) {
    // Grouping for per-student summary later
    if (!vocabByStudent.has(record.userId)) vocabByStudent.set(record.userId, []);
    vocabByStudent.get(record.userId)!.push(record);

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
    .sort((a, b) => {
      if (a.averageDifficulty !== b.averageDifficulty) {
        return b.averageDifficulty - a.averageDifficulty;
      }
      return b.strugglePercentage - a.strugglePercentage;
    })
    .slice(0, 50);

  // Aggregate grammar struggles
  type GrammarAgg = {
    grammarRuleId: string;
    title: string;
    level: string;
    totalDifficulty: number;
    count: number;
    strugglingCount: number;
  };
  const grammarAggMap = new Map<string, GrammarAgg>();
  for (const rec of grammarProgressRecords) {
    if (!grammarAggMap.has(rec.grammarRuleId)) {
      grammarAggMap.set(rec.grammarRuleId, {
        grammarRuleId: rec.grammarRuleId,
        title: (rec as any).grammarRule.title,
        level: (rec as any).grammarRule.level,
        totalDifficulty: 0,
        count: 0,
        strugglingCount: 0
      });
    }
    const agg = grammarAggMap.get(rec.grammarRuleId)!;
    agg.totalDifficulty += rec.difficulty;
    agg.count++;
    if (rec.difficulty > 6) agg.strugglingCount++;
  }

  const strugglingGrammar = Array.from(grammarAggMap.values())
    .map((agg) => ({
      grammarRuleId: agg.grammarRuleId,
      title: agg.title,
      level: agg.level,
      averageDifficulty: agg.totalDifficulty / agg.count,
      strugglePercentage: (agg.strugglingCount / agg.count) * 100,
      totalStudents: agg.count
    }))
    .filter((r) => r.totalStudents > 0)
    .sort((a, b) => b.averageDifficulty - a.averageDifficulty)
    .slice(0, 30);

  // --- Per-student summary using data already fetched ---
  const now = new Date();
  const studentSummaries = classData.members.map((m) => {
    const user = m.user;
    const uid = m.userId;
    // Find progress for the class's language
    const prog =
      user.progress.find(
        (p) =>
          classData.primaryLanguage === 'international' ||
          p.languageId === classData.primaryLanguage
      ) || user.progress[0];

    const vocabRecs = (vocabByStudent.get(uid) ?? []).filter((r) => r.repetitions > 0);

    let avgRetentionPct: number | null = null;
    let totalLapses = 0;
    let wordsReviewed = 0;
    if (vocabRecs.length > 0) {
      let retSum = 0;
      for (const rec of vocabRecs) {
        totalLapses += rec.lapses;
        wordsReviewed++;
        if (rec.stability > 0 && rec.lastReviewDate) {
          const elapsed = (now.getTime() - rec.lastReviewDate.getTime()) / (1000 * 60 * 60 * 24);
          retSum += Math.max(0, Math.min(1, Math.pow(1 + elapsed / (9 * rec.stability), -1)));
        } else {
          retSum += 1;
        }
      }
      avgRetentionPct = Math.round((retSum / vocabRecs.length) * 100);
    }

    return {
      userId: uid,
      name: user?.name || user?.username || uid,
      cefrLevel: prog?.cefrLevel ?? 'A1',
      totalXp: user?.totalXp ?? 0,
      currentStreak: user?.currentStreak ?? 0,
      wordsReviewed,
      avgRetentionPct,
      totalLapses
    };
  });

  // Error type breakdown across all students
  const errorTypeCounts: Record<string, number> = {};
  for (const rec of progressRecords) {
    if (rec.lastErrorType) {
      const et = rec.lastErrorType as string;
      errorTypeCounts[et] = (errorTypeCounts[et] ?? 0) + 1;
    }
  }
  for (const rec of grammarProgressRecords) {
    if (rec.lastErrorType) {
      errorTypeCounts[rec.lastErrorType] = (errorTypeCounts[rec.lastErrorType] ?? 0) + 1;
    }
  }

  // CEFR distribution
  const cefrDistribution: Record<string, number> = {};
  for (const s of studentSummaries) {
    cefrDistribution[s.cefrLevel] = (cefrDistribution[s.cefrLevel] ?? 0) + 1;
  }
  const cefrLevels = CEFR_CONFIG.LEVELS as readonly string[];
  const cefrDistributionOrdered = cefrLevels.map((level) => ({
    level,
    count: cefrDistribution[level] ?? 0
  }));

  return {
    strugglingWords,
    strugglingGrammar,
    classData,
    studentSummaries,
    errorTypeCounts,
    cefrDistributionOrdered
  };
};
