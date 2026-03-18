import { prisma } from './prisma';
import { SrsState } from '@prisma/client';
import { CEFR_CONFIG } from './srsConfig';
import { deriveSrsStateFromFsrs } from './fsrs';

export interface LevelUpdate {
  oldLevel: string;
  newLevel: string;
}

export interface CefrProgressDetail {
  currentLevel: string;
  nextLevel: string | null;
  percentComplete: number;
  freqCoverageCount: number; // words KNOWN/MASTERED from the top-N frequency set
  freqCoverageTarget: number; // N — the required count
  grammarMastery: number;
  grammarExposure: number;
  averageElo: number;
}

export class CefrService {
  /**
   * Apply ELO decay to items that haven't been reviewed recently.
   * Gradually moves ELO back toward the baseline for the item's CEFR level.
   *
   * Also re-derives srsState from FSRS stability after decay so that
   * UserVocabulary.srsState stays in sync with UserVocabularyProgress —
   * preventing a word from staying MASTERED in the lesson selector while
   * its FSRS record shows it should be KNOWN or LEARNING.
   */
  static async applyEloDecay(userId: string, languageId: string): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CEFR_CONFIG.DECAY.THRESHOLD_DAYS);

    // Fetch stale vocab and grammar, including the foreign-key IDs needed to
    // join to the FSRS progress tables.
    const [staleVocab, staleGrammar] = await Promise.all([
      prisma.userVocabulary.findMany({
        where: {
          userId,
          vocabulary: { languageId },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
          nextReviewDate: { lt: cutoff }
        },
        select: {
          id: true,
          eloRating: true,
          vocabularyId: true,
          vocabulary: { select: { cefrLevel: true } }
        }
      }),
      prisma.userGrammarRule.findMany({
        where: {
          userId,
          grammarRule: { languageId },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
          nextReviewDate: { lt: cutoff }
        },
        select: {
          id: true,
          eloRating: true,
          grammarRuleId: true,
          grammarRule: { select: { level: true } }
        }
      })
    ]);

    // Batch-fetch FSRS progress for all stale items so we can re-derive srsState.
    const staleVocabIds = staleVocab.map((v) => v.vocabularyId);
    const staleGrammarIds = staleGrammar.map((g) => g.grammarRuleId);

    const [vocabProgress, grammarProgress] = await Promise.all([
      staleVocabIds.length > 0
        ? prisma.userVocabularyProgress.findMany({
            where: { userId, vocabularyId: { in: staleVocabIds } },
            select: { vocabularyId: true, stability: true, repetitions: true, lapses: true }
          })
        : Promise.resolve(
            [] as { vocabularyId: string; stability: number; repetitions: number; lapses: number }[]
          ),
      staleGrammarIds.length > 0
        ? prisma.userGrammarRuleProgress.findMany({
            where: { userId, grammarRuleId: { in: staleGrammarIds } },
            select: { grammarRuleId: true, stability: true, repetitions: true, lapses: true }
          })
        : Promise.resolve(
            [] as {
              grammarRuleId: string;
              stability: number;
              repetitions: number;
              lapses: number;
            }[]
          )
    ]);

    const vocabProgressMap = new Map(vocabProgress.map((p) => [p.vocabularyId, p]));
    const grammarProgressMap = new Map(grammarProgress.map((p) => [p.grammarRuleId, p]));

    // Build batched update operations — one write per decayed item.
    // Each update includes both the decayed eloRating and the re-derived srsState.
    const vocabUpdates = staleVocab
      .map((item) => {
        const baseline =
          CEFR_CONFIG.BASE_ELO[item.vocabulary.cefrLevel as keyof typeof CEFR_CONFIG.BASE_ELO] ??
          CEFR_CONFIG.BASE_ELO.A1;
        if (item.eloRating <= baseline) return null;
        const decayedElo = item.eloRating - (item.eloRating - baseline) * CEFR_CONFIG.DECAY.RATE;
        // Re-derive srsState from FSRS stability so both tables agree.
        const progress = vocabProgressMap.get(item.vocabularyId);
        const newState = progress
          ? deriveSrsStateFromFsrs(progress.repetitions, progress.stability, progress.lapses)
          : undefined;
        return prisma.userVocabulary.update({
          where: { id: item.id },
          data: { eloRating: decayedElo, ...(newState ? { srsState: newState } : {}) }
        });
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const grammarUpdates = staleGrammar
      .map((item) => {
        const baseline =
          CEFR_CONFIG.BASE_ELO[item.grammarRule.level as keyof typeof CEFR_CONFIG.BASE_ELO] ??
          CEFR_CONFIG.BASE_ELO.A1;
        if (item.eloRating <= baseline) return null;
        const decayedElo = item.eloRating - (item.eloRating - baseline) * CEFR_CONFIG.DECAY.RATE;
        const progress = grammarProgressMap.get(item.grammarRuleId);
        const newState = progress
          ? deriveSrsStateFromFsrs(progress.repetitions, progress.stability, progress.lapses)
          : undefined;
        return prisma.userGrammarRule.update({
          where: { id: item.id },
          data: { eloRating: decayedElo, ...(newState ? { srsState: newState } : {}) }
        });
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Execute all updates in a single transaction
    if (vocabUpdates.length + grammarUpdates.length > 0) {
      await prisma.$transaction([...vocabUpdates, ...grammarUpdates]);
    }
  }

  static async evaluateLevelUp(userId: string, languageId: string): Promise<LevelUpdate | null> {
    const userProgress = await prisma.userProgress.findUnique({
      where: {
        userId_languageId: { userId, languageId }
      }
    });

    if (!userProgress) return null;

    const currentLevel = userProgress.cefrLevel;
    const currentLevelIndex = CEFR_CONFIG.LEVELS.indexOf(
      currentLevel as (typeof CEFR_CONFIG.LEVELS)[number]
    );

    if (currentLevelIndex === -1 || currentLevelIndex === CEFR_CONFIG.LEVELS.length - 1) {
      return null;
    }

    const nextLevel = CEFR_CONFIG.LEVELS[currentLevelIndex + 1];

    // Apply ELO decay before evaluating
    await this.applyEloDecay(userId, languageId);

    // --- Vocab gate: frequency-coverage ---
    // Require mastery of the top-N most frequent words at this level (by corpus rank).
    // The lesson generator already surfaces words in frequency order, so users encounter
    // these before AI-generated enrichment words. DB growth doesn't affect this gate.
    const freqGateTarget =
      CEFR_CONFIG.VOCAB_FREQ_GATE[currentLevel as keyof typeof CEFR_CONFIG.VOCAB_FREQ_GATE] ?? 150;

    const topFreqWords = await prisma.vocabulary.findMany({
      where: { languageId, cefrLevel: currentLevel, frequency: { not: null } },
      orderBy: { frequency: 'asc' },
      take: freqGateTarget,
      select: { id: true }
    });

    const freqGateRequired = topFreqWords.length;

    // Fetch mastered items and their production status in parallel to avoid N+1
    const [freqGateItems, grammarGateItems] = await Promise.all([
      prisma.userVocabulary.findMany({
        where: {
          userId,
          vocabularyId: { in: topFreqWords.map((w) => w.id) },
          srsState: SrsState.MASTERED
        },
        select: {
          vocabularyId: true,
          vocabulary: {
            select: {
              progress: {
                where: { userId },
                select: { hasProduced: true }
              }
            }
          }
        }
      }),
      prisma.userGrammarRule.findMany({
        where: {
          userId,
          grammarRule: { languageId, level: currentLevel },
          srsState: SrsState.MASTERED
        },
        select: {
          grammarRuleId: true,
          grammarRule: {
            select: {
              progress: {
                where: { userId },
                select: { hasProduced: true }
              }
            }
          }
        }
      })
    ]);

    const masteredFromTopFreq = freqGateItems.length;
    const producedFromTopFreq = freqGateItems.filter(
      (i) => i.vocabulary.progress[0]?.hasProduced
    ).length;

    // Must master all top-frequency words that exist (up to the target).
    const isFreqVocabMet = freqGateRequired > 0 && masteredFromTopFreq >= freqGateRequired;

    // --- Total Vocab gate ---
    // Ensures a broad base across all levels (cumulative).
    const totalVocabTarget =
      CEFR_CONFIG.TOTAL_VOCAB_GATE[currentLevel as keyof typeof CEFR_CONFIG.TOTAL_VOCAB_GATE] ?? 0;
    const totalMasteredVocab = await prisma.userVocabulary.count({
      where: {
        userId,
        vocabulary: { languageId },
        srsState: SrsState.MASTERED
      }
    });
    const isTotalVocabMet = totalMasteredVocab >= totalVocabTarget;

    // --- Grammar gate: minimum interaction + 90% mastery ---
    // Requires the user to have interacted with a minimum number of grammar rules
    // so grammar cannot be skipped by playing only vocabulary modes.
    const [totalGrammarAtLevel, interactedGrammarCount] = await Promise.all([
      prisma.grammarRule.count({ where: { languageId, level: currentLevel } }),
      prisma.userGrammarRule.count({
        where: { userId, grammarRule: { languageId, level: currentLevel } }
      })
    ]);

    const masteredGrammarCount = grammarGateItems.length;
    const producedGrammarCount = grammarGateItems.filter(
      (i) => i.grammarRule.progress[0]?.hasProduced
    ).length;

    const minGrammarInteraction = Math.min(
      totalGrammarAtLevel,
      CEFR_CONFIG.GRAMMAR_MIN_INTERACTION
    );
    const grammarMastery =
      interactedGrammarCount > 0 ? masteredGrammarCount / interactedGrammarCount : 0;
    const isGrammarMet =
      interactedGrammarCount >= minGrammarInteraction &&
      grammarMastery >= CEFR_CONFIG.GRAMMAR_MASTERY_THRESHOLD;

    // --- Production gate ---
    // Require 30% of mastered gate items (top-freq vocab + current-level grammar) to be produced.
    const totalGateMastered = masteredFromTopFreq + masteredGrammarCount;
    const totalGateProduced = producedFromTopFreq + producedGrammarCount;
    const isProductionMet =
      totalGateMastered > 0
        ? totalGateProduced / totalGateMastered >= CEFR_CONFIG.PRODUCTION_GATE_THRESHOLD
        : true;

    // --- ELO Target gate ---
    // Ensures the user's proficiency (average ELO) is sufficient for the next level.
    const eloTarget =
      CEFR_CONFIG.ELO_TARGETS[currentLevel as keyof typeof CEFR_CONFIG.ELO_TARGETS] ?? 0;
    const [vocabElos, grammarElos] = await Promise.all([
      prisma.userVocabulary.findMany({
        where: {
          userId,
          vocabularyId: { in: topFreqWords.map((w) => w.id) },
          srsState: SrsState.MASTERED
        },
        select: { eloRating: true }
      }),
      prisma.userGrammarRule.findMany({
        where: {
          userId,
          grammarRule: { languageId, level: currentLevel },
          srsState: SrsState.MASTERED
        },
        select: { eloRating: true }
      })
    ]);
    const allElos = [...vocabElos.map((v) => v.eloRating), ...grammarElos.map((g) => g.eloRating)];
    const averageElo = allElos.length > 0 ? allElos.reduce((a, b) => a + b, 0) / allElos.length : 0;
    const isEloMet = averageElo >= eloTarget;

    if (isFreqVocabMet && isTotalVocabMet && isGrammarMet && isEloMet && isProductionMet) {
      const vocabMastery = freqGateRequired > 0 ? masteredFromTopFreq / freqGateRequired : 0;
      await prisma.$transaction([
        prisma.userProgress.update({
          where: { id: userProgress.id },
          data: { cefrLevel: nextLevel }
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma as unknown as Record<string, any>).levelUpEvent.create({
          data: {
            userId,
            languageId,
            oldLevel: currentLevel,
            newLevel: nextLevel,
            vocabMastery,
            grammarMastery,
            averageElo
          }
        })
      ]);

      return { oldLevel: currentLevel, newLevel: nextLevel };
    }

    return null;
  }

  /**
   * Apply grammar mastery based on a CEFR level placement.
   *
   * When a user is placed at `newLevel`:
   *   - All grammar rules for levels BEFORE `newLevel` are upserted to MASTERED
   *     (eloRating is preserved if the record already exists, otherwise BASE_ELO is used).
   *
   * When downgrading from `oldLevel` to `newLevel` (oldLevel > newLevel):
   *   - Grammar rules for levels between `newLevel` and `oldLevel` (exclusive) are reset
   *     to UNSEEN. These were previously auto-mastered and are no longer implied mastered.
   *     eloRating is never changed.
   */
  static async applyGrammarMasteryForLevel(
    userId: string,
    languageId: string,
    newLevel: string,
    oldLevel?: string
  ): Promise<void> {
    const newLevelIndex = CEFR_CONFIG.LEVELS.indexOf(
      newLevel as (typeof CEFR_CONFIG.LEVELS)[number]
    );
    if (newLevelIndex === -1) return;

    const oldLevelIndex = oldLevel
      ? CEFR_CONFIG.LEVELS.indexOf(oldLevel as (typeof CEFR_CONFIG.LEVELS)[number])
      : -1;

    const isDowngrade = oldLevelIndex !== -1 && newLevelIndex < oldLevelIndex;

    // Levels whose grammar should be auto-mastered (all levels strictly before newLevel)
    const levelsToMaster = CEFR_CONFIG.LEVELS.slice(0, newLevelIndex) as string[];

    // Levels whose auto-mastery should be reverted (between newLevel and oldLevel, exclusive of oldLevel)
    const levelsToRevert: string[] = isDowngrade
      ? (CEFR_CONFIG.LEVELS.slice(newLevelIndex, oldLevelIndex) as string[])
      : [];

    // Fetch all grammar rules for levels to master and levels to revert in parallel.
    const [rulesToMaster, rulesToRevert] = await Promise.all([
      levelsToMaster.length > 0
        ? prisma.grammarRule.findMany({ where: { languageId, level: { in: levelsToMaster } } })
        : Promise.resolve([]),
      levelsToRevert.length > 0
        ? prisma.grammarRule.findMany({
            where: { languageId, level: { in: levelsToRevert } },
            select: { id: true }
          })
        : Promise.resolve([])
    ]);

    // Build all upsert operations for auto-mastering previous levels.
    const masterOps = rulesToMaster.map((rule) => {
      const baseElo =
        CEFR_CONFIG.BASE_ELO[rule.level as keyof typeof CEFR_CONFIG.BASE_ELO] ??
        CEFR_CONFIG.BASE_ELO.A1;
      return prisma.userGrammarRule.upsert({
        where: { userId_grammarRuleId: { userId, grammarRuleId: rule.id } },
        update: { srsState: SrsState.MASTERED },
        create: { userId, grammarRuleId: rule.id, srsState: SrsState.MASTERED, eloRating: baseElo }
      });
    });

    // Batch revert: updateMany handles all IDs in one query.
    const revertIds = rulesToRevert.map((r) => r.id);

    // Execute mastering upserts in a single transaction, then revert in one updateMany.
    if (masterOps.length > 0) {
      await prisma.$transaction(masterOps);
    }
    if (revertIds.length > 0) {
      await prisma.userGrammarRule.updateMany({
        where: { userId, grammarRuleId: { in: revertIds } },
        data: { srsState: SrsState.UNSEEN }
      });
    }

    // Seed FSRS progress records for auto-mastered rules that don't yet have one.
    // We assign a reduced initial stability (7 days) rather than leaving the record
    // absent entirely. This schedules a light "check-in" review within a week so the
    // lesson generator can surface assumed-but-potentially-weak grammar for confirmation,
    // catching gaps that pure auto-mastery would otherwise silently miss.
    if (rulesToMaster.length > 0) {
      const AUTO_MASTERY_STABILITY = 7; // days — triggers review within ~1 week
      const now = new Date();
      const checkInDate = new Date(now.getTime() + AUTO_MASTERY_STABILITY * 24 * 60 * 60 * 1000);

      // Only create progress records for rules that don't already have one
      // (existing records from prior real study sessions must not be overwritten).
      const existingProgress = await prisma.userGrammarRuleProgress.findMany({
        where: { userId, grammarRuleId: { in: rulesToMaster.map((r) => r.id) } },
        select: { grammarRuleId: true }
      });
      const alreadyHasProgress = new Set(existingProgress.map((p) => p.grammarRuleId));

      const progressOps = rulesToMaster
        .filter((rule) => !alreadyHasProgress.has(rule.id))
        .map((rule) =>
          prisma.userGrammarRuleProgress.create({
            data: {
              userId,
              grammarRuleId: rule.id,
              stability: AUTO_MASTERY_STABILITY,
              difficulty: 5.0,
              retrievability: 1.0,
              repetitions: 1, // counts as one "review" so FSRS treats it as a known card
              lapses: 0,
              lastReviewDate: now,
              nextReviewDate: checkInDate
            }
          })
        );

      if (progressOps.length > 0) {
        await prisma.$transaction(progressOps);
        console.log(
          `[Grammar Mastery] Seeded FSRS check-in records for ${progressOps.length} auto-mastered rule(s) (stability=${AUTO_MASTERY_STABILITY}d)`
        );
      }
    }

    console.log(
      `[Grammar Mastery] User ${userId}: mastered ${levelsToMaster.length} prior level(s), reverted ${levelsToRevert.length} level(s) → placed at ${newLevel}`
    );
  }

  static async getCefrProgress(userId: string, languageId: string): Promise<CefrProgressDetail> {
    const userProgress = await prisma.userProgress.findUnique({
      where: {
        userId_languageId: { userId, languageId }
      }
    });

    if (!userProgress) {
      return {
        currentLevel: 'A1',
        nextLevel: 'A2',
        percentComplete: 0,
        freqCoverageCount: 0,
        freqCoverageTarget:
          CEFR_CONFIG.VOCAB_FREQ_GATE['A1' as keyof typeof CEFR_CONFIG.VOCAB_FREQ_GATE],
        grammarMastery: 0,
        grammarExposure: 0,
        averageElo: CEFR_CONFIG.BASE_ELO.A1
      };
    }

    const currentLevel = userProgress.cefrLevel;
    const currentLevelIndex = CEFR_CONFIG.LEVELS.indexOf(
      currentLevel as (typeof CEFR_CONFIG.LEVELS)[number]
    );
    const nextLevel =
      currentLevelIndex < CEFR_CONFIG.LEVELS.length - 1
        ? CEFR_CONFIG.LEVELS[currentLevelIndex + 1]
        : null;

    if (!nextLevel) {
      return {
        currentLevel,
        nextLevel: null,
        percentComplete: 100,
        freqCoverageCount: 1,
        freqCoverageTarget: 1,
        grammarMastery: 1,
        grammarExposure: 1,
        averageElo: 2000
      };
    }

    const freqGateTarget =
      CEFR_CONFIG.VOCAB_FREQ_GATE[currentLevel as keyof typeof CEFR_CONFIG.VOCAB_FREQ_GATE] ?? 150;

    // Fetch freq-gate words, grammar counts, and items in parallel.
    const [
      topFreqWords,
      totalGrammar,
      interactedGrammar,
      totalMasteredVocab,
      freqGateItems,
      grammarGateItems
    ] = await Promise.all([
      prisma.vocabulary.findMany({
        where: { languageId, cefrLevel: currentLevel, frequency: { not: null } },
        orderBy: { frequency: 'asc' },
        take: freqGateTarget,
        select: { id: true }
      }),
      prisma.grammarRule.count({ where: { languageId, level: currentLevel } }),
      prisma.userGrammarRule.count({
        where: { userId, grammarRule: { languageId, level: currentLevel } }
      }),
      prisma.userVocabulary.count({
        where: {
          userId,
          vocabulary: { languageId },
          srsState: SrsState.MASTERED
        }
      }),
      // We need these to check production status for the frequency gate words.
      prisma.userVocabulary.findMany({
        where: {
          userId,
          vocabulary: { languageId, cefrLevel: currentLevel, frequency: { not: null } },
          srsState: SrsState.MASTERED
        },
        orderBy: { vocabulary: { frequency: 'asc' } },
        take: freqGateTarget,
        select: {
          vocabularyId: true,
          vocabulary: {
            select: {
              progress: {
                where: { userId },
                select: { hasProduced: true }
              }
            }
          }
        }
      }),
      // We need these to check production status for current-level grammar.
      prisma.userGrammarRule.findMany({
        where: {
          userId,
          grammarRule: { languageId, level: currentLevel },
          srsState: SrsState.MASTERED
        },
        select: {
          grammarRuleId: true,
          grammarRule: {
            select: {
              progress: {
                where: { userId },
                select: { hasProduced: true }
              }
            }
          }
        }
      })
    ]);

    const freqCoverageTarget = topFreqWords.length;
    const masteredFromTopFreq = freqGateItems.length;
    const producedFromTopFreq = freqGateItems.filter(
      (i) => i.vocabulary?.progress?.[0]?.hasProduced
    ).length;

    const masteredGrammarCount = grammarGateItems.length;
    const producedGrammarCount = grammarGateItems.filter(
      (i) => i.grammarRule?.progress?.[0]?.hasProduced
    ).length;

    // Fetch ELO data for the items that contribute to the gate.
    const [vocabElos, grammarElos] = await Promise.all([
      prisma.userVocabulary.findMany({
        where: {
          userId,
          vocabularyId: { in: topFreqWords.map((w) => w.id) },
          srsState: SrsState.MASTERED
        },
        select: { eloRating: true }
      }),
      prisma.userGrammarRule.findMany({
        where: {
          userId,
          grammarRule: { languageId, level: currentLevel },
          srsState: SrsState.MASTERED
        },
        select: { eloRating: true }
      })
    ]);

    const grammarMastery = interactedGrammar > 0 ? masteredGrammarCount / interactedGrammar : 0;
    const grammarExposure = totalGrammar > 0 ? interactedGrammar / totalGrammar : 0;

    const allElos = [...vocabElos.map((v) => v.eloRating), ...grammarElos.map((g) => g.eloRating)];
    const averageElo = allElos.length > 0 ? allElos.reduce((a, b) => a + b, 0) / allElos.length : 0;

    // Production progress: percentage of mastered gate items that have been produced.
    const totalGateMastered = masteredFromTopFreq + masteredGrammarCount;
    const totalGateProduced = producedFromTopFreq + producedGrammarCount;
    const productionProgress =
      totalGateMastered > 0
        ? Math.min(
            1,
            totalGateProduced / (totalGateMastered * CEFR_CONFIG.PRODUCTION_GATE_THRESHOLD)
          )
        : 1;

    // Progress toward level-up: freq (30%) + total vocab (20%) + grammar (25%) + production (15%) + ELO (10%).
    const freqProgress = freqCoverageTarget > 0 ? masteredFromTopFreq / freqCoverageTarget : 0;
    const totalVocabTarget =
      CEFR_CONFIG.TOTAL_VOCAB_GATE[currentLevel as keyof typeof CEFR_CONFIG.TOTAL_VOCAB_GATE] ?? 0;
    const totalVocabProgress =
      totalVocabTarget > 0 ? Math.min(1, totalMasteredVocab / totalVocabTarget) : 1;

    const minGrammarInteraction = Math.min(totalGrammar, CEFR_CONFIG.GRAMMAR_MIN_INTERACTION);
    const grammarInteractionProgress =
      minGrammarInteraction > 0 ? Math.min(1, interactedGrammar / minGrammarInteraction) : 1;
    const grammarMasteryProgress =
      interactedGrammar > 0
        ? Math.min(1, grammarMastery / CEFR_CONFIG.GRAMMAR_MASTERY_THRESHOLD)
        : 0;
    const grammarProgress = Math.min(grammarInteractionProgress, grammarMasteryProgress);

    const eloTarget =
      CEFR_CONFIG.ELO_TARGETS[currentLevel as keyof typeof CEFR_CONFIG.ELO_TARGETS] ?? 0;
    const eloProgress = eloTarget > 0 ? Math.min(1, averageElo / eloTarget) : 1;

    const weightedPercent =
      freqProgress * 0.3 +
      totalVocabProgress * 0.2 +
      grammarProgress * 0.25 +
      productionProgress * 0.15 +
      eloProgress * 0.1;

    const allMet =
      freqProgress >= 1 &&
      totalVocabProgress >= 1 &&
      grammarProgress >= 1 &&
      productionProgress >= 1 &&
      eloProgress >= 1;
    const percentComplete = allMet ? 100 : Math.min(99, Math.round(weightedPercent * 100));

    return {
      currentLevel,
      nextLevel,
      percentComplete,
      freqCoverageCount: masteredFromTopFreq,
      freqCoverageTarget,
      grammarMastery: Math.round(grammarMastery * 100) / 100,
      grammarExposure: Math.round(grammarExposure * 100) / 100,
      averageElo: Math.round(averageElo)
    };
  }

  /**
   * Map a frequency rank to a CEFR level based on the configured thresholds.
   * 1-1000 = A1
   * 1001-2500 = A2
   * etc.
   */
  static mapRankToCefr(rank: number | null): string {
    if (rank === null) return 'C2'; // Words not in frequency list are treated as extremely rare/advanced
    if (rank <= CEFR_CONFIG.RANK_THRESHOLDS.A1) return 'A1';
    if (rank <= CEFR_CONFIG.RANK_THRESHOLDS.A2) return 'A2';
    if (rank <= CEFR_CONFIG.RANK_THRESHOLDS.B1) return 'B1';
    if (rank <= CEFR_CONFIG.RANK_THRESHOLDS.B2) return 'B2';
    if (rank <= CEFR_CONFIG.RANK_THRESHOLDS.C1) return 'C1';
    return 'C2';
  }
}
