import { json } from '@sveltejs/kit';
import { buildEvaluationPrompt, parseEvaluationResponse, updateEloRatings } from '$lib/server/grader';
import { generateChatCompletion } from '$lib/server/llm';
import { prisma } from '$lib/server/prisma';
import { submitAnswerRateLimiter } from '$lib/server/ratelimit';
import { updateGamification } from '$lib/server/gamification';

/** Track a correct/incorrect answer against an assignment score record. */
async function updateAssignmentScore(assignmentId: string, userId: string, isCorrect: boolean) {
	try {
		const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
		if (!assignment) return null;

		const increment = isCorrect ? 1 : 0;

		const current = await prisma.assignmentScore.findUnique({
			where: { assignmentId_userId: { assignmentId, userId } }
		});

		const newScore = (current?.score ?? 0) + increment;
		const passed = newScore >= assignment.targetScore;

		const updated = await prisma.assignmentScore.upsert({
			where: { assignmentId_userId: { assignmentId, userId } },
			create: { assignmentId, userId, score: newScore, passed },
			update: { score: newScore, passed }
		});

		return { score: updated.score, targetScore: assignment.targetScore, passed: updated.passed };
	} catch (e) {
		console.error('Failed to update assignment score:', e);
		return null;
	}
}

export async function POST(event) {
	const { request, locals } = event;
	if (await submitAnswerRateLimiter.isLimited(event)) {
		return json({ error: 'Too many requests. Limit is 15/min, 300/day.' }, { status: 429 });
	}

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { userInput, targetSentence, targetedVocabularyIds, targetedGrammarIds, gameMode: bodyGameMode, assignmentId } = body;
		const userId = locals.user.id;
		const gameMode = bodyGameMode || 'native-to-target';

		if (!userInput || !targetSentence) {
			return json({ error: 'Missing userInput or targetSentence' }, { status: 400 });
		}

		// Fetch the full objects for the targeted IDs, preserving client's order
		const targetedVocabRaw = await prisma.vocabulary.findMany({
			where: { id: { in: targetedVocabularyIds || [] } }
		});
		const targetedVocabulary = (targetedVocabularyIds || [])
			.map((id: string) => targetedVocabRaw.find(v => v.id === id))
			.filter(Boolean);

		const targetedGrammarRaw = await prisma.grammarRule.findMany({
			where: { id: { in: targetedGrammarIds || [] } }
		});
		const targetedGrammar = (targetedGrammarIds || [])
			.map((id: string) => targetedGrammarRaw.find(g => g.id === id))
			.filter(Boolean);

		// Fast-path for multiple choice: no LLM needed
		if (gameMode === 'multiple-choice') {
			const isCorrect = userInput.trim() === targetSentence.trim();
			const score = isCorrect ? 1.0 : 0.0;
			const evaluation = {
				globalScore: score,
				vocabularyUpdates: targetedVocabulary.map((v: { id: string }) => ({ id: v.id, score })),
				grammarUpdates: [],
				extraVocabLemmas: [],
				feedback: isCorrect ? 'Correct!' : 'Incorrect.',
				feedbackEnglish: isCorrect ? 'Correct!' : 'Incorrect.'
			};

			console.log('Sending payload to updateEloRatings:', JSON.stringify(evaluation, null, 2));
			await updateEloRatings(userId, evaluation, gameMode);

			let assignmentProgress = null;
			if (assignmentId) {
				assignmentProgress = await updateAssignmentScore(assignmentId, userId, isCorrect);
			}

			const xpToAdd = isCorrect ? 10 : 0;
			if (xpToAdd > 0) {
				await updateGamification(userId, xpToAdd);
			}

			return json({ ...evaluation, assignmentProgress });
		}

		// Build prompt and call LLM with streaming
		const userLevel = locals.user.cefrLevel || 'A1';
		const activeLanguageName = locals.user.activeLanguage?.name || 'German';
		const { systemPrompt, userMessage, idMap } = buildEvaluationPrompt(
			userInput,
			targetSentence,
			targetedVocabulary,
			targetedGrammar,
			gameMode,
			userLevel,
			activeLanguageName
		);

		const llmResponse = await generateChatCompletion({
			userId,
			messages: [{ role: 'user', content: userMessage }],
			systemPrompt,
			jsonMode: true,
			stream: true,
			signal: request.signal
		});

		let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

		const stream = new ReadableStream({
			async start(controller) {
				if (!llmResponse.body) {
					controller.close();
					return;
				}
				const reader = llmResponse.body.getReader();
				upstreamReader = reader;
				const decoder = new TextDecoder();
				let fullContent = '';
				let buffer = '';

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							if (line.trim() === '' || line.startsWith(':')) continue;
							if (line.startsWith('data: ')) {
								const dataStr = line.slice(6);
								if (dataStr.trim() === '[DONE]') continue;
								try {
									const data = JSON.parse(dataStr);
									const content = data.choices[0]?.delta?.content;
									if (content) {
										fullContent += content;
										controller.enqueue(new TextEncoder().encode(content));
									}
								} catch {
									// partial SSE parse error
								}
							}
						}
					}
					// Process remaining buffer
					if (buffer) {
						const lines = buffer.split('\n');
						for (const line of lines) {
							if (line.startsWith('data: ')) {
								const dataStr = line.slice(6);
								if (dataStr.trim() !== '[DONE]') {
									try {
										const data = JSON.parse(dataStr);
										const content = data.choices[0]?.delta?.content;
										if (content) {
											fullContent += content;
											controller.enqueue(new TextEncoder().encode(content));
										}
									} catch {
										// partial SSE parse error
									}
								}
							}
						}
					}
				} catch (err) {
					console.error('Stream read error in submit-answer', err);
				}

				// Post-stream processing: parse response, update Elo/SRS, then send final payload, then close
				try {
					const evaluation = parseEvaluationResponse(fullContent);
					// Remap short IDs (v0, g0, ...) back to real UUIDs
					evaluation.vocabularyUpdates = evaluation.vocabularyUpdates.map(u => ({
						...u,
						id: idMap[u.id] || u.id
					}));
					evaluation.grammarUpdates = evaluation.grammarUpdates.map(u => ({
						...u,
						id: idMap[u.id] || u.id
					}));
					console.log('Sending payload to updateEloRatings:', JSON.stringify(evaluation, null, 2));
					await updateEloRatings(userId, evaluation, gameMode);

					// Track assignment score if applicable
					let assignmentProgress = null;
					const isCorrect = (evaluation.globalScore ?? 0) >= 0.5;
					if (assignmentId) {
						assignmentProgress = await updateAssignmentScore(assignmentId, userId, isCorrect);
					}

					const xpToAdd = isCorrect ? 10 : 0;
					if (xpToAdd > 0) {
						await updateGamification(userId, xpToAdd);
					}

					// Send the final evaluation payload before closing the stream
					controller.enqueue(new TextEncoder().encode(`\n\nJSON_PAYLOAD:${JSON.stringify({ ...evaluation, assignmentProgress })}`));
				} catch (e) {
					console.error('Post-stream processing error in submit-answer:', e);
				}

				controller.close();
			},
			cancel() {
				// Client disconnected — cancel upstream LLM reader
				upstreamReader?.cancel();
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (error) {
		console.error('Error submitting answer:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
}
