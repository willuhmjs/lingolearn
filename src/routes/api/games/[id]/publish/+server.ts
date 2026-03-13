import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { publishGameRateLimiter } from '$lib/server/ratelimit';
import { generateChatCompletion } from '$lib/server/llm';
import { sanitizeForPrompt } from '$lib/server/sanitize';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent) {
	const { locals, params } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const gameId = params.id;

	const user = await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: { useLocalLlm: true }
	});

	if (!user?.useLocalLlm && await publishGameRateLimiter.isLimited(event)) {
		return json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
	}

	const game = await prisma.game.findUnique({
		where: { id: gameId },
		include: { questions: true }
	});

	if (!game) {
		return json({ error: 'Game not found' }, { status: 404 });
	}

	if (game.creatorId !== locals.user.id && locals.user.role !== 'ADMIN') {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	// LLM Review
	const safeTitle = sanitizeForPrompt(game.title ?? '', 200);
	const safeDescription = sanitizeForPrompt(game.description ?? '', 500);
	const systemPrompt = `You are a helpful assistant reviewing a language learning game for safety, appropriateness, and quality.
The game is titled "${safeTitle}" with description "${safeDescription}".
It has ${game.questions.length} questions.
Here are the questions and answers:
${game.questions.map((q: {question: string, answer: string}, i: number) => `${i + 1}. Q: ${sanitizeForPrompt(q.question, 300)} | A: ${sanitizeForPrompt(q.answer, 200)}`).join('\n')}

Is this game appropriate to be published to a public community? Also, suggest a category for the game from the following list: Vocabulary, Grammar, Culture, Conversation, General. Respond in JSON format:
{ "approved": boolean, "reason": "short explanation", "category": "Vocabulary" | "Grammar" | "Culture" | "Conversation" | "General" }`;

	try {
		const llmResponse = await generateChatCompletion({
			userId: locals.user.id,
			messages: [{ role: 'user', content: 'Please review this game.' }],
			systemPrompt,
			jsonMode: true,
			temperature: 0.1
		});

		const result = JSON.parse(llmResponse.choices[0].message.content);

		if (!result.approved) {
			return json({ error: `Game review failed: ${result.reason}` }, { status: 400 });
		}

		const validCategories = ['Vocabulary', 'Grammar', 'Culture', 'Conversation', 'General'];
		const category = validCategories.includes(result.category) ? result.category : 'General';

		const updatedGame = await prisma.game.update({
			where: { id: gameId },
			data: { 
				isPublished: true,
				category 
			}
		});

		return json(updatedGame);
	} catch (error) {
		console.error('Error during LLM review:', error);
		return json({ error: 'Failed to complete game review.' }, { status: 500 });
	}
}
