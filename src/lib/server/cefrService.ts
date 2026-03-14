import { prisma } from './prisma';
import { SrsState } from '@prisma/client';
import { CEFR_CONFIG } from './srsConfig';

export interface LevelUpdate {
  oldLevel: string;
  newLevel: string;
}

export interface CefrProgressDetail {
  currentLevel: string;
  nextLevel: string | null;
  percentComplete: number;
  vocabMastery: number;
  grammarMastery: number;
  vocabExposure: number;
  grammarExposure: number;
  averageElo: number;
  targetElo: number | null;
}

export class CefrService {
  /**
   * Apply ELO decay to items that haven't been reviewed recently.
   * Gradually moves ELO back toward the baseline for the item's CEFR level.
   */
  static async applyEloDecay(userId: string, languageId: string): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CEFR_CONFIG.DECAY.THRESHOLD_DAYS);

    // Fetch stale vocab and grammar in parallel
    const [staleVocab, staleGrammar] = await Promise.all([
      prisma.userVocabulary.findMany({
        where: {
          userId,
          vocabulary: { languageId },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
          nextReviewDate: { lt: cutoff }
        },
        select: { id: true, eloRating: true, vocabulary: { select: { cefrLevel: true } } }
      }),
      prisma.userGrammarRule.findMany({
        where: {
          userId,
          grammarRule: { languageId },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
          nextReviewDate: { lt: cutoff }
        },
        select: { id: true, eloRating: true, grammarRule: { select: { level: true } } }
      })
    ]);

    // Build batched update transactions — one write per decayed item
    const vocabUpdates = staleVocab
      .map(item => {
        const baseline = CEFR_CONFIG.BASE_ELO[item.vocabulary.cefrLevel as keyof typeof CEFR_CONFIG.BASE_ELO] ?? CEFR_CONFIG.BASE_ELO.A1;
        if (item.eloRating <= baseline) return null;
        const decayedElo = item.eloRating - (item.eloRating - baseline) * CEFR_CONFIG.DECAY.RATE;
        return prisma.userVocabulary.update({ where: { id: item.id }, data: { eloRating: decayedElo } });
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const grammarUpdates = staleGrammar
      .map(item => {
        const baseline = CEFR_CONFIG.BASE_ELO[item.grammarRule.level as keyof typeof CEFR_CONFIG.BASE_ELO] ?? CEFR_CONFIG.BASE_ELO.A1;
        if (item.eloRating <= baseline) return null;
        const decayedElo = item.eloRating - (item.eloRating - baseline) * CEFR_CONFIG.DECAY.RATE;
        return prisma.userGrammarRule.update({ where: { id: item.id }, data: { eloRating: decayedElo } });
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
    const currentLevelIndex = CEFR_CONFIG.LEVELS.indexOf(currentLevel as typeof CEFR_CONFIG.LEVELS[number]);

    if (currentLevelIndex === -1 || currentLevelIndex === CEFR_CONFIG.LEVELS.length - 1) {
      return null;
    }

    const nextLevel = CEFR_CONFIG.LEVELS[currentLevelIndex + 1];
    const targetElo = CEFR_CONFIG.ELO_TARGETS[currentLevel as keyof typeof CEFR_CONFIG.ELO_TARGETS];

    // Apply ELO decay before evaluating
    await this.applyEloDecay(userId, languageId);

    // Vocab denominator: only words the user has actually encountered (user-relative).
    // This prevents auto-generated or unseen DB words from inflating the denominator.
    // Grammar denominator: only grammar rules the user has interacted with (not all DB rules).
    // This prevents unencountered grammar from permanently blocking level-up.
    const [encounteredVocabCount, interactedGrammarCount] = await Promise.all([
      prisma.userVocabulary.count({
        where: { userId, vocabulary: { languageId, cefrLevel: currentLevel } }
      }),
      prisma.userGrammarRule.count({
        where: { userId, grammarRule: { languageId, level: currentLevel } }
      })
    ]);

    // Must have encountered a minimum number of vocab words at this level
    if (encounteredVocabCount < CEFR_CONFIG.MIN_ENCOUNTERED_VOCAB) {
      return null;
    }

    // Count KNOWN + MASTERED items
    const [masteredVocabCount, masteredGrammarCount] = await Promise.all([
      prisma.userVocabulary.count({
        where: {
          userId,
          vocabulary: { languageId, cefrLevel: currentLevel },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
        }
      }),
      prisma.userGrammarRule.count({
        where: {
          userId,
          grammarRule: { languageId, level: currentLevel },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
        }
      })
    ]);

    // Vocab: 80% of encountered words must be KNOWN/MASTERED
    const vocabMastery = masteredVocabCount / encounteredVocabCount;
    // Grammar: 90% of interacted grammar rules must be KNOWN/MASTERED.
    // Using interacted count so unencountered rules don't permanently block level-up.
    const grammarMastery = interactedGrammarCount > 0 ? masteredGrammarCount / interactedGrammarCount : 1.0;

    // Average ELO for KNOWN/MASTERED items
    const [vocabElos, grammarElos] = await Promise.all([
      prisma.userVocabulary.findMany({
        where: {
          userId,
          vocabulary: { languageId, cefrLevel: currentLevel },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
        },
        select: { eloRating: true }
      }),
      prisma.userGrammarRule.findMany({
        where: {
          userId,
          grammarRule: { languageId, level: currentLevel },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
        },
        select: { eloRating: true }
      })
    ]);

    const allElos = [...vocabElos.map(v => v.eloRating), ...grammarElos.map(g => g.eloRating)];
    const averageElo = allElos.length > 0
      ? allElos.reduce((a, b) => a + b, 0) / allElos.length
      : 0;

    const isVocabMet = vocabMastery >= CEFR_CONFIG.VOCAB_MASTERY_THRESHOLD;
    const isGrammarMet = grammarMastery >= CEFR_CONFIG.GRAMMAR_MASTERY_THRESHOLD;
    const isEloMet = averageElo >= targetElo;

    if (isVocabMet && isGrammarMet && isEloMet) {
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
    const newLevelIndex = CEFR_CONFIG.LEVELS.indexOf(newLevel as typeof CEFR_CONFIG.LEVELS[number]);
    if (newLevelIndex === -1) return;

    const oldLevelIndex = oldLevel
      ? CEFR_CONFIG.LEVELS.indexOf(oldLevel as typeof CEFR_CONFIG.LEVELS[number])
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
        ? prisma.grammarRule.findMany({ where: { languageId, level: { in: levelsToRevert } }, select: { id: true } })
        : Promise.resolve([])
    ]);

    // Build all upsert operations for auto-mastering previous levels.
    const masterOps = rulesToMaster.map(rule => {
      const baseElo = CEFR_CONFIG.BASE_ELO[rule.level as keyof typeof CEFR_CONFIG.BASE_ELO] ?? CEFR_CONFIG.BASE_ELO.A1;
      return prisma.userGrammarRule.upsert({
        where: { userId_grammarRuleId: { userId, grammarRuleId: rule.id } },
        update: { srsState: SrsState.MASTERED },
        create: { userId, grammarRuleId: rule.id, srsState: SrsState.MASTERED, eloRating: baseElo }
      });
    });

    // Batch revert: updateMany handles all IDs in one query.
    const revertIds = rulesToRevert.map(r => r.id);

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
        vocabMastery: 0,
        grammarMastery: 0,
        vocabExposure: 0,
        grammarExposure: 0,
        averageElo: CEFR_CONFIG.BASE_ELO.A1,
        targetElo: CEFR_CONFIG.ELO_TARGETS.A1
      };
    }

    const currentLevel = userProgress.cefrLevel;
    const currentLevelIndex = CEFR_CONFIG.LEVELS.indexOf(currentLevel as typeof CEFR_CONFIG.LEVELS[number]);
    const nextLevel = currentLevelIndex < CEFR_CONFIG.LEVELS.length - 1 ? CEFR_CONFIG.LEVELS[currentLevelIndex + 1] : null;

    if (!nextLevel) {
      return {
        currentLevel,
        nextLevel: null,
        percentComplete: 100,
        vocabMastery: 1,
        grammarMastery: 1,
        vocabExposure: 1,
        grammarExposure: 1,
        averageElo: 2000,
        targetElo: null
      };
    }

    const targetElo = CEFR_CONFIG.ELO_TARGETS[currentLevel as keyof typeof CEFR_CONFIG.ELO_TARGETS];

    // Fetch all counts, mastery tallies, ELO averages, and grammar exposure in one round.
    const [
      encounteredVocab,
      totalGrammar,
      masteredVocab,
      masteredGrammar,
      interactedGrammar,
      vocabElos,
      grammarElos
    ] = await Promise.all([
      prisma.userVocabulary.count({
        where: { userId, vocabulary: { languageId, cefrLevel: currentLevel } }
      }),
      prisma.grammarRule.count({ where: { languageId, level: currentLevel } }),
      prisma.userVocabulary.count({
        where: {
          userId,
          vocabulary: { languageId, cefrLevel: currentLevel },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
        }
      }),
      prisma.userGrammarRule.count({
        where: {
          userId,
          grammarRule: { languageId, level: currentLevel },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
        }
      }),
      prisma.userGrammarRule.count({
        where: { userId, grammarRule: { languageId, level: currentLevel } }
      }),
      prisma.userVocabulary.findMany({
        where: {
          userId,
          vocabulary: { languageId, cefrLevel: currentLevel },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
        },
        select: { eloRating: true }
      }),
      prisma.userGrammarRule.findMany({
        where: {
          userId,
          grammarRule: { languageId, level: currentLevel },
          srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
        },
        select: { eloRating: true }
      })
    ]);

    // vocabMastery: % of encountered words that are KNOWN/MASTERED
    const vocabMastery = encounteredVocab > 0 ? masteredVocab / encounteredVocab : 0;
    // grammarMastery: % of interacted grammar rules that are KNOWN/MASTERED (90% required)
    const grammarMastery = interactedGrammar > 0 ? masteredGrammar / interactedGrammar : 1.0;
    // vocabExposure: progress toward the minimum encountered-word floor
    const vocabExposure = Math.min(1, encounteredVocab / CEFR_CONFIG.MIN_ENCOUNTERED_VOCAB);
    // grammarExposure: fraction of grammar rules the user has interacted with at all
    const grammarExposure = totalGrammar > 0 ? interactedGrammar / totalGrammar : 1.0;

    const allElos = [...vocabElos.map(v => v.eloRating), ...grammarElos.map(g => g.eloRating)];
    const averageElo = allElos.length > 0
      ? allElos.reduce((a, b) => a + b, 0) / allElos.length
      : 1000;

    // Progress toward level-up: weighted average of each requirement's completion.
    // Vocab (80% threshold): 40% weight. Grammar (100% threshold): 40% weight. ELO: 20% weight.
    const vocabProgress = Math.min(1, vocabMastery / CEFR_CONFIG.VOCAB_MASTERY_THRESHOLD);
    const grammarProgress = Math.min(1, grammarMastery / CEFR_CONFIG.GRAMMAR_MASTERY_THRESHOLD);
    const eloProgress = Math.min(1, averageElo / targetElo);

    const weightedPercent = (vocabProgress * 0.4) + (grammarProgress * 0.4) + (eloProgress * 0.2);

    return {
      currentLevel,
      nextLevel,
      percentComplete: Math.round(weightedPercent * 100),
      vocabMastery: Math.round(vocabMastery * 100) / 100,
      grammarMastery: Math.round(grammarMastery * 100) / 100,
      vocabExposure: Math.round(vocabExposure * 100) / 100,
      grammarExposure: Math.round(grammarExposure * 100) / 100,
      averageElo: Math.round(averageElo),
      targetElo
    };
  }
}
