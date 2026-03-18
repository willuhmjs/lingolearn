import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { redirect } from '@sveltejs/kit';
import { CefrService } from '$lib/server/cefrService';
import { loadRetentionStats } from '$lib/server/retentionStats';
import { computeAdaptiveNewWordCap } from '$lib/server/srsConfig';
import { parseBanditState } from '$lib/server/srsConfig';
import { pfaPredictCorrect } from '$lib/server/pfa';
import { loadErrorCoMatrix, getRelatedErrorTypes } from '$lib/server/errorCoMatrix';
import type { ErrorType } from '$lib/server/grader';
import {
  getCachedDashboardAnalytics,
  setCachedDashboardAnalytics,
  type DashboardAnalytics
} from '$lib/server/dashboardCache';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const user = locals.user;

  // Fetch user fields needed for new algorithm panels
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      sessionSuccessEma: true,
      interleaveBanditState: true,
      fsrsWeights: true,
      fsrsRetention: true
    }
  });

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

  // --- Enhanced analytics (cached for 10 minutes) ---

  const languageId = user.activeLanguage?.id ?? '';
  const cached = getCachedDashboardAnalytics(user.id, languageId);

  let analytics: DashboardAnalytics;

  if (cached) {
    analytics = cached;
  } else {
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

    // Grammar coverage
    const totalGrammarRuleCount = allGrammarRules.length;
    const interactedGrammarCount = grammarRules.length;
    const masteredGrammarCount = grammarRules.filter(
      (r) => r.srsState === 'MASTERED' || r.srsState === 'KNOWN'
    ).length;
    const lockedGrammarCount = allGrammarRules.filter((rule) => {
      const userRule = grammarRules.find((r) => r.grammarRuleId === rule.id);
      if (userRule) return false;
      return rule.dependencies.some(
        (dep) =>
          !grammarRules.find(
            (r) =>
              r.grammarRuleId === dep.id && (r.srsState === 'MASTERED' || r.srsState === 'KNOWN')
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

    // --- Adaptive learning signals ---
    const sessionEma = userRecord?.sessionSuccessEma ?? 0.75;
    const adaptiveCap = computeAdaptiveNewWordCap(sessionEma);

    const banditState = parseBanditState(userRecord?.interleaveBanditState ?? null);
    const banditArmMeans = banditState.arms.map((arm, i) => ({
      interleaveCount: i,
      mean: Math.round((arm.alpha / (arm.alpha + arm.beta)) * 100),
      observations: arm.alpha + arm.beta - 2
    }));
    const bestBanditArm = banditArmMeans.reduce((best, arm) => (arm.mean > best.mean ? arm : best));

    const highVarianceVocab = await prisma.userVocabulary.findMany({
      where: { userId: user.id, vocabulary: { languageId: user.activeLanguage?.id } },
      orderBy: { eloVariance: 'desc' },
      take: 8,
      select: {
        eloRating: true,
        eloVariance: true,
        vocabulary: { select: { lemma: true, cefrLevel: true } }
      }
    });

    const grammarWithPfa = await prisma.userGrammarRule.findMany({
      where: { userId: user.id, grammarRule: { languageId: user.activeLanguage?.id } },
      select: {
        grammarRuleId: true,
        grammarRule: {
          select: { title: true, level: true, pfaGamma: true, pfaRho: true, pfaDelta: true }
        }
      }
    });
    const grammarProgressForDash = await prisma.userGrammarRuleProgress.findMany({
      where: {
        userId: user.id,
        grammarRuleId: { in: grammarWithPfa.map((g) => g.grammarRuleId) }
      },
      select: { grammarRuleId: true, repetitions: true, lapses: true }
    });
    const grammarProgressDashMap = new Map(grammarProgressForDash.map((p) => [p.grammarRuleId, p]));

    const pfaAtRisk = grammarWithPfa
      .map((g) => {
        const prog = grammarProgressDashMap.get(g.grammarRuleId);
        const successes = prog ? Math.max(0, prog.repetitions - prog.lapses) : 0;
        const failures = prog?.lapses ?? 0;
        const p = pfaPredictCorrect(
          g.grammarRule.pfaGamma,
          g.grammarRule.pfaRho,
          g.grammarRule.pfaDelta,
          successes,
          failures
        );
        return { title: g.grammarRule.title, level: g.grammarRule.level, pCorrect: p };
      })
      .filter((g) => g.pCorrect !== null && g.pCorrect < 0.6)
      .sort((a, b) => (a.pCorrect ?? 1) - (b.pCorrect ?? 1))
      .slice(0, 6);

    const coMatrix = await loadErrorCoMatrix();
    const activeErrorTypes = Object.keys(errorTypeCounts) as ErrorType[];
    const coOccurrencePairs: { from: string; to: string; strength: string }[] = [];
    for (const et of activeErrorTypes) {
      const related = getRelatedErrorTypes(coMatrix, et).slice(0, 2);
      for (const rel of related) {
        if (!coOccurrencePairs.find((p) => p.from === rel && p.to === et)) {
          const count = coMatrix[et]?.[rel] ?? 0;
          const strength = count > 20 ? 'strong' : count > 5 ? 'moderate' : 'weak';
          coOccurrencePairs.push({ from: et, to: rel, strength });
        }
      }
    }

    // Most Confused Words: vocab lapsed 2+ times, sorted by lapse count
    const confusedRecs = vocabProgressRecords
      .filter((r) => r.lapses >= 2)
      .sort((a, b) => b.lapses - a.lapses)
      .slice(0, 8);
    const confusedDetails =
      confusedRecs.length > 0
        ? await prisma.vocabulary.findMany({
            where: { id: { in: confusedRecs.map((r) => r.vocabularyId) } },
            select: { id: true, lemma: true, meanings: { select: { value: true }, take: 1 } }
          })
        : [];
    const confusedMap = new Map(confusedDetails.map((v) => [v.id, v]));
    const vocabSrsMap = new Map(vocabularies.map((v) => [v.vocabularyId, v.srsState]));
    const mostConfusedWords = confusedRecs.map((rec) => ({
      lemma: confusedMap.get(rec.vocabularyId)?.lemma ?? rec.vocabularyId,
      meaning: confusedMap.get(rec.vocabularyId)?.meanings[0]?.value ?? null,
      lapses: rec.lapses,
      srsState: vocabSrsMap.get(rec.vocabularyId) ?? 'LEARNING'
    }));

    // ELO Calibration: bucket vocab by ELO, compute actual pass rate from review logs
    const reviewLogs = await prisma.reviewLog.findMany({
      where: { userId: user.id, itemType: 'vocabulary' },
      select: { itemId: true, rating: true }
    });
    const reviewsByItem = new Map<string, { total: number; pass: number }>();
    for (const log of reviewLogs) {
      const entry = reviewsByItem.get(log.itemId) ?? { total: 0, pass: 0 };
      entry.total++;
      if (log.rating >= 3) entry.pass++;
      reviewsByItem.set(log.itemId, entry);
    }
    const vocabEloMap = new Map(vocabularies.map((v) => [v.vocabularyId, v.eloRating]));
    const eloBuckets = new Map<number, { total: number; pass: number; count: number }>();
    for (const [itemId, stats] of reviewsByItem) {
      if (stats.total < 3) continue;
      const elo = vocabEloMap.get(itemId);
      if (!elo) continue;
      const bucket = Math.floor(elo / 100) * 100;
      const existing = eloBuckets.get(bucket) ?? { total: 0, pass: 0, count: 0 };
      existing.total += stats.total;
      existing.pass += stats.pass;
      existing.count++;
      eloBuckets.set(bucket, existing);
    }
    const eloCalibration = Array.from(eloBuckets.entries())
      .map(([elo, stats]) => ({
        elo,
        actualPassPct: Math.round((stats.pass / stats.total) * 100),
        sampleSize: stats.count
      }))
      .sort((a, b) => a.elo - b.elo);

    // New Word Intake: words added per week for last 8 weeks
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const newWordIntake = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date(nowMs - (7 - i) * weekMs);
      const weekEnd = new Date(weekStart.getTime() + weekMs);
      const count = vocabularies.filter((v) => {
        const t = v.createdAt.getTime();
        return t >= weekStart.getTime() && t < weekEnd.getTime();
      }).length;
      return {
        label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      };
    });

    // Recently Mastered: last 10 words to hit MASTERED
    const recentlyMastered = vocabularies
      .filter((v) => v.srsState === 'MASTERED')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10)
      .map((v) => ({ lemma: v.vocabulary.lemma, partOfSpeech: v.vocabulary.partOfSpeech }));

    // Part-of-speech breakdown
    const posMap = new Map<string, number>();
    for (const v of vocabularies) {
      const pos = v.vocabulary.partOfSpeech ?? 'Other';
      posMap.set(pos, (posMap.get(pos) ?? 0) + 1);
    }
    const posBreakdown = Array.from(posMap.entries())
      .map(([pos, count]) => ({ pos, count }))
      .sort((a, b) => b.count - a.count);

    // CEFR level breakdown (vocab + grammar)
    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const knownStates = new Set(['KNOWN', 'MASTERED']);
    const cefrBreakdown = {
      vocab: cefrLevels.map((level) => ({
        level,
        total: vocabularies.filter((v) => v.vocabulary.cefrLevel === level).length,
        known: vocabularies.filter(
          (v) => v.vocabulary.cefrLevel === level && knownStates.has(v.srsState)
        ).length
      })),
      grammar: cefrLevels.map((level) => ({
        level,
        total: grammarRules.filter((g) => g.grammarRule.level === level).length,
        known: grammarRules.filter(
          (g) => g.grammarRule.level === level && knownStates.has(g.srsState)
        ).length
      }))
    };

    // Next Grammar Unlocks: not-yet-started rules with all prereqs mastered/known
    const masteredGrammarIds = new Set(
      grammarRules.filter((r) => knownStates.has(r.srsState)).map((r) => r.grammarRuleId)
    );
    const interactedIds = new Set(grammarRules.map((r) => r.grammarRuleId));
    const nextUnlocks = allGrammarRules
      .filter((rule) => {
        if (interactedIds.has(rule.id)) return false;
        if (rule.dependencies.length === 0) return true;
        return rule.dependencies.every((dep) => masteredGrammarIds.has(dep.id));
      })
      .slice(0, 6)
      .map((rule) => ({ id: rule.id, title: rule.title, level: rule.level }));

    // Word Frequency Coverage: % of top N most-common words known
    const freqCoverage = [1000, 5000, 10000].map((n) => ({
      threshold: n,
      known: vocabularies.filter(
        (v) =>
          v.vocabulary.frequency != null &&
          v.vocabulary.frequency <= n &&
          knownStates.has(v.srsState)
      ).length,
      total: vocabularies.filter(
        (v) => v.vocabulary.frequency != null && v.vocabulary.frequency <= n
      ).length
    }));

    analytics = {
      urgentItems,
      errorTypeCounts,
      totalOverrides,
      grammarCoverage,
      sessionEma: Math.round(sessionEma * 100),
      adaptiveCap,
      banditArmMeans,
      bestBanditArm,
      highVarianceVocab: highVarianceVocab.map((v) => ({
        lemma: v.vocabulary.lemma,
        level: v.vocabulary.cefrLevel,
        elo: Math.round(v.eloRating),
        sigma: Math.round(Math.sqrt(v.eloVariance))
      })),
      pfaAtRisk,
      coOccurrencePairs,
      hasPersonalizedWeights: (userRecord?.fsrsWeights?.length ?? 0) === 19,
      fsrsRetention: Math.round((userRecord?.fsrsRetention ?? 0.9) * 100),
      mostConfusedWords,
      eloCalibration,
      newWordIntake,
      recentlyMastered,
      posBreakdown,
      cefrBreakdown,
      nextUnlocks,
      freqCoverage
    };

    setCachedDashboardAnalytics(user.id, languageId, analytics);
  }

  const [friendships, challenges] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        OR: [{ initiatorId: user.id }, { receiverId: user.id }]
      },
      include: {
        initiator: {
          select: { id: true, username: true, name: true, image: true, lastActive: true }
        },
        receiver: {
          select: { id: true, username: true, name: true, image: true, lastActive: true }
        }
      }
    }),
    prisma.challenge.findMany({
      where: {
        OR: [{ challengerId: user.id }, { challengeeId: user.id }]
      },
      include: {
        challenger: { select: { username: true } },
        challengee: { select: { username: true } },
        game: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return {
    vocabularies,
    grammarRules,
    allGrammarRules,
    dueReviewCount,
    cefrProgress,
    retentionStats,
    dueSoonAssignments,
    activeLiveSessions,
    friendships,
    challenges,
    userId: user.id,
    ...analytics
  };
};
