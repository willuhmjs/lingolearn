import { prisma } from './prisma';
import type { SrsState } from '@prisma/client';

export type SrsType = 'vocabulary' | 'grammar';

/**
 * Common interface for progress tracking models (UserVocabularyProgress and UserGrammarRuleProgress)
 */
export interface SrsProgressable {
  difficulty: number;
  stability: number;
  retrievability: number;
  repetitions: number;
  lapses: number;
  lastReviewDate: Date | null;
  medianResponseMs: number | null;
  reviewCount: number;
  hasProduced: boolean;
  lastErrorType?: string | null;
  errorCounts?: string | null;
}

/**
 * Common interface for high-level SRS metrics (UserVocabulary and UserGrammarRule)
 */
export interface SrsMetrics {
  eloRating: number;
  eloVariance: number;
  srsState: SrsState;
  nextReviewDate: Date | null;
}

export interface SrsUpdateParams {
  userId: string;
  itemId: string;
  type: SrsType;
  fsrs: {
    difficulty: number;
    stability: number;
    retrievability: number;
    repetitions: number;
    lapses: number;
    lastReviewDate: Date;
    nextReviewDate: Date;
  };
  elo?: {
    rating: number;
    variance: number;
  };
  state?: SrsState;
  errorType?: string | null;
  errorCounts?: string | null;
  medianResponseMs?: number | null;
  hasProduced?: boolean;
  overrideIncrement?: number;
}

export const srsRepository = {
  async getProgress(
    userId: string,
    itemId: string,
    type: SrsType
  ): Promise<SrsProgressable | null> {
    if (type === 'vocabulary') {
      return prisma.userVocabularyProgress.findUnique({
        where: { userId_vocabularyId: { userId, vocabularyId: itemId } }
      });
    } else {
      return prisma.userGrammarRuleProgress.findUnique({
        where: { userId_grammarRuleId: { userId, grammarRuleId: itemId } }
      });
    }
  },

  async getMetrics(userId: string, itemId: string, type: SrsType): Promise<SrsMetrics | null> {
    if (type === 'vocabulary') {
      return prisma.userVocabulary.findUnique({
        where: { userId_vocabularyId: { userId, vocabularyId: itemId } }
      });
    } else {
      return prisma.userGrammarRule.findUnique({
        where: { userId_grammarRuleId: { userId, grammarRuleId: itemId } }
      });
    }
  },

  async update(params: SrsUpdateParams): Promise<void> {
    const {
      userId,
      itemId,
      type,
      fsrs,
      elo,
      state,
      errorType,
      errorCounts,
      medianResponseMs,
      hasProduced,
      overrideIncrement = 0
    } = params;

    const progressData = {
      ...fsrs,
      lastErrorType: errorType,
      errorCounts,
      hasProduced: !!hasProduced,
      ...(medianResponseMs !== undefined && medianResponseMs !== null ? { medianResponseMs } : {})
    };

    const promises: Promise<any>[] = [];

    if (type === 'vocabulary') {
      promises.push(
        prisma.userVocabularyProgress.upsert({
          where: { userId_vocabularyId: { userId, vocabularyId: itemId } },
          create: {
            userId,
            vocabularyId: itemId,
            ...progressData,
            reviewCount: 1,
            overrideCount: overrideIncrement
          },
          update: {
            ...progressData,
            reviewCount: { increment: 1 },
            overrideCount: { increment: overrideIncrement },
            ...(hasProduced ? { hasProduced: true } : {})
          }
        })
      );

      if (elo && state) {
        promises.push(
          prisma.userVocabulary.upsert({
            where: { userId_vocabularyId: { userId, vocabularyId: itemId } },
            create: {
              userId,
              vocabularyId: itemId,
              eloRating: elo.rating,
              eloVariance: elo.variance,
              srsState: state,
              nextReviewDate: fsrs.nextReviewDate
            },
            update: {
              eloRating: elo.rating,
              eloVariance: elo.variance,
              srsState: state,
              nextReviewDate: fsrs.nextReviewDate
            }
          })
        );
      }
    } else {
      promises.push(
        prisma.userGrammarRuleProgress.upsert({
          where: { userId_grammarRuleId: { userId, grammarRuleId: itemId } },
          create: {
            userId,
            grammarRuleId: itemId,
            ...progressData,
            reviewCount: 1
          },
          update: {
            ...progressData,
            reviewCount: { increment: 1 },
            ...(hasProduced ? { hasProduced: true } : {})
          }
        })
      );

      if (elo && state) {
        promises.push(
          prisma.userGrammarRule.upsert({
            where: { userId_grammarRuleId: { userId, grammarRuleId: itemId } },
            create: {
              userId,
              grammarRuleId: itemId,
              eloRating: elo.rating,
              eloVariance: elo.variance,
              srsState: state,
              nextReviewDate: fsrs.nextReviewDate
            },
            update: {
              eloRating: elo.rating,
              eloVariance: elo.variance,
              srsState: state,
              nextReviewDate: fsrs.nextReviewDate
            }
          })
        );
      }
    }

    await Promise.all(promises);
  },

  /**
   * Batch version of update to avoid N+1 queries.
   */
  async batchUpdateSrsMetrics(params: SrsUpdateParams[]): Promise<void> {
    const operations = params.flatMap((p) => {
      const {
        userId,
        itemId,
        type,
        fsrs,
        elo,
        state,
        errorType,
        errorCounts,
        medianResponseMs,
        hasProduced,
        overrideIncrement = 0
      } = p;

      const progressData = {
        ...fsrs,
        lastErrorType: errorType,
        errorCounts,
        hasProduced: !!hasProduced,
        ...(medianResponseMs !== undefined && medianResponseMs !== null ? { medianResponseMs } : {})
      };

      const ops: any[] = [];
      if (type === 'vocabulary') {
        ops.push(
          prisma.userVocabularyProgress.upsert({
            where: { userId_vocabularyId: { userId, vocabularyId: itemId } },
            create: {
              userId,
              vocabularyId: itemId,
              ...progressData,
              reviewCount: 1,
              overrideCount: overrideIncrement
            },
            update: {
              ...progressData,
              reviewCount: { increment: 1 },
              overrideCount: { increment: overrideIncrement },
              ...(hasProduced ? { hasProduced: true } : {})
            }
          })
        );

        if (elo && state) {
          ops.push(
            prisma.userVocabulary.upsert({
              where: { userId_vocabularyId: { userId, vocabularyId: itemId } },
              create: {
                userId,
                vocabularyId: itemId,
                eloRating: elo.rating,
                eloVariance: elo.variance,
                srsState: state,
                nextReviewDate: fsrs.nextReviewDate
              },
              update: {
                eloRating: elo.rating,
                eloVariance: elo.variance,
                srsState: state,
                nextReviewDate: fsrs.nextReviewDate
              }
            })
          );
        }
      } else {
        ops.push(
          prisma.userGrammarRuleProgress.upsert({
            where: { userId_grammarRuleId: { userId, grammarRuleId: itemId } },
            create: {
              userId,
              grammarRuleId: itemId,
              ...progressData,
              reviewCount: 1
            },
            update: {
              ...progressData,
              reviewCount: { increment: 1 },
              ...(hasProduced ? { hasProduced: true } : {})
            }
          })
        );

        if (elo && state) {
          ops.push(
            prisma.userGrammarRule.upsert({
              where: { userId_grammarRuleId: { userId, grammarRuleId: itemId } },
              create: {
                userId,
                grammarRuleId: itemId,
                eloRating: elo.rating,
                eloVariance: elo.variance,
                srsState: state,
                nextReviewDate: fsrs.nextReviewDate
              },
              update: {
                eloRating: elo.rating,
                eloVariance: elo.variance,
                srsState: state,
                nextReviewDate: fsrs.nextReviewDate
              }
            })
          );
        }
      }
      return ops;
    });

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }
  }
};
