import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

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

		// 2. Seed starter vocabulary as LEARNING dynamically
		const startingElo = 1000; // A1 base Elo
		let vocabSeeded = 0;

		const beginnerVocabularies = await prisma.vocabulary.findMany({
			where: {
				languageId,
				isBeginner: true
			}
		});

		if (beginnerVocabularies.length > 0) {
			const vocabData = beginnerVocabularies.map((v) => ({
				userId,
				vocabularyId: v.id,
				srsState: 'LEARNING' as const,
				eloRating: startingElo
			}));

			const result = await prisma.userVocabulary.createMany({
				data: vocabData,
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
