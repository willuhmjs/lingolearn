import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { CefrService } from '$lib/server/cefrService';

/**
 * Absolute beginner onboarding endpoint.
 * Seeds the user's account with essential A1 starter vocabulary and grammar as LEARNING,
 * so the lesson generator immediately has material to teach them from scratch.
 */

import type { RequestEvent } from './$types';

/**
 * Absolute beginner onboarding endpoint.
 * Seeds the user's account with essential A1 starter vocabulary and grammar as LEARNING,
 * so the lesson generator immediately has material to teach them from scratch.
 */

export async function POST({ locals }: RequestEvent) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = locals.user.id;
  if (!locals.user.activeLanguage) {
    return json({ error: 'Active language is required' }, { status: 400 });
  }
  const languageId = locals.user.activeLanguage.id;

  try {
    // 1. Set user level to A1
    const existingProgress = await prisma.userProgress.findUnique({
      where: { userId_languageId: { userId, languageId } },
      select: { cefrLevel: true }
    });
    const oldLevel = existingProgress?.cefrLevel;

    await prisma.userProgress.upsert({
      where: {
        userId_languageId: { userId, languageId }
      },
      create: {
        userId,
        languageId,
        hasOnboarded: true,
        cefrLevel: 'A1'
      },
      update: {
        hasOnboarded: true,
        cefrLevel: 'A1'
      }
    });

    await CefrService.applyGrammarMasteryForLevel(userId, languageId, 'A1', oldLevel);

    // 2. Seed starter vocabulary as LEARNING
    // Strategy: take all isBeginner words, then top up to VOCAB_TARGET with the
    // highest-frequency words not already included (frequency ASC = most common first).
    const VOCAB_TARGET = 60;
    const startingElo = 1000; // A1 base Elo
    let vocabSeeded = 0;

    const beginnerVocab = await prisma.vocabulary.findMany({
      where: { languageId, isBeginner: true },
      orderBy: { frequency: 'asc' }
    });

    let starterVocab = beginnerVocab;

    if (starterVocab.length < VOCAB_TARGET) {
      const beginnerIds = new Set(beginnerVocab.map((v) => v.id));
      const frequencyTopUp = await prisma.vocabulary.findMany({
        where: {
          languageId,
          isBeginner: false,
          frequency: { not: null }
        },
        orderBy: { frequency: 'asc' },
        take: VOCAB_TARGET - starterVocab.length
      });
      starterVocab = [...starterVocab, ...frequencyTopUp.filter((v) => !beginnerIds.has(v.id))];
    } else if (starterVocab.length > VOCAB_TARGET) {
      // Too many isBeginner words — keep the most frequent ones
      starterVocab = starterVocab.slice(0, VOCAB_TARGET);
    }

    if (starterVocab.length > 0) {
      const result = await prisma.userVocabulary.createMany({
        data: starterVocab.map((v) => ({
          userId,
          vocabularyId: v.id,
          srsState: 'LEARNING' as const,
          eloRating: startingElo
        })),
        skipDuplicates: true
      });
      vocabSeeded = result.count;
    }

    // 3. Seed starter grammar as LEARNING
    let grammarSeeded = 0;

    const grammarRules = await prisma.grammarRule.findMany({
      where: {
        languageId,
        level: 'A1'
      }
    });

    if (grammarRules.length > 0) {
      const grammarData = grammarRules.map((g) => ({
        userId,
        grammarRuleId: g.id,
        srsState: 'LEARNING' as const,
        eloRating: startingElo
      }));

      const result = await prisma.userGrammarRule.createMany({
        data: grammarData,
        skipDuplicates: true
      });
      grammarSeeded = result.count;
    }

    console.log(
      `[Beginner Onboarding] User ${userId}: seeded ${vocabSeeded} vocab, ${grammarSeeded} grammar as LEARNING at Elo ${startingElo}`
    );

    return json({
      success: true,
      level: 'A1',
      vocabSeeded,
      grammarSeeded,
      message:
        "Welcome! We've set you up as a complete beginner. Your lessons will start with the very basics — greetings, pronouns, and simple sentences. Let's begin your language journey!"
    });
  } catch (error: unknown) {
    console.error('Error in beginner onboarding API:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, { status: 500 });
  }
}
