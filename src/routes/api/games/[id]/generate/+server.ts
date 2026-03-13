import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { generateChatCompletion } from '$lib/server/llm';
import { sanitizeForPrompt } from '$lib/server/sanitize';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { topic, count } = await request.json();

		if (!topic) {
			return json({ error: 'Topic is required' }, { status: 400 });
		}

		const numQuestions = Math.min(Math.max(1, parseInt(count) || 5), 20);

		const game = await prisma.game.findUnique({
			where: { id: params.id }
		});

		if (!game) {
			return json({ error: 'Game not found' }, { status: 404 });
		}

		if (game.creatorId !== session.user.id) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const safeTopic = sanitizeForPrompt(topic, 300);
		const prompt = `Generate ${numQuestions} multiple choice questions for a language learning game.
The language is ${sanitizeForPrompt(game.language, 50)}.
The topic is: ${safeTopic}.
Return ONLY a valid JSON array of objects.
Each object must have these exact keys:
- "question" (the question text)
- "answer" (the correct answer)
- "options" (an array of 3 incorrect options/distractors, EXCLUDING the correct answer)

Example:
[
  {
    "question": "What is the capital of France?",
    "answer": "Paris",
    "options": ["London", "Berlin", "Madrid"]
  }
]`;

		const response = await generateChatCompletion({
			userId: session.user.id,
			messages: [{ role: 'user', content: prompt }]
		});

		if (!response || !response.choices || !response.choices[0]) {
			return json({ error: 'Failed to generate questions' }, { status: 500 });
		}

		// Try to parse the JSON
		let questionsData;
		try {
			const content = response.choices[0].message.content;
			// Extract JSON array if there's surrounding text (like markdown backticks)
			const match = content.match(/\[[\s\S]*\]/);
			const jsonString = match ? match[0] : content;
			questionsData = JSON.parse(jsonString);
		} catch (e) {
			console.error('Failed to parse LLM response:', e);
			return json({ error: 'Failed to parse generated questions' }, { status: 500 });
		}

		if (!Array.isArray(questionsData)) {
			return json({ error: 'Invalid format returned by LLM' }, { status: 500 });
		}

		// Save the questions to the database
		const currentQuestionsCount = await prisma.gameQuestion.count({
			where: { gameId: params.id }
		});

		const createdQuestions = [];
		for (let i = 0; i < questionsData.length; i++) {
			const q = questionsData[i];
			if (q.question && q.answer && Array.isArray(q.options)) {
				// Filter out the correct answer from options if it somehow got included
				const filteredOptions = q.options.filter((opt: string) => opt.toLowerCase() !== q.answer.toLowerCase());
				
				const created = await prisma.gameQuestion.create({
					data: {
						gameId: params.id,
						question: q.question,
						answer: q.answer,
						options: filteredOptions,
						order: currentQuestionsCount + i
					}
				});
				createdQuestions.push(created);
			}
		}

		if (createdQuestions.length > 0 && game.isPublished) {
			await prisma.game.update({
				where: { id: params.id },
				data: { isPublished: false }
			});
		}

		return json({ questions: createdQuestions });
	} catch (error) {
		console.error('Failed to generate questions:', error);
		return json({ error: 'Failed to generate questions' }, { status: 500 });
	}
};
