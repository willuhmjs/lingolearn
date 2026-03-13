import { json } from '@sveltejs/kit';
import { updateEloRatings, buildEvaluationPrompt, parseEvaluationResponse } from '$lib/server/grader';
import { generateChatCompletion } from '$lib/server/llm';
import { prisma } from '$lib/server/prisma';
import { submitAnswerRateLimiter } from '$lib/server/ratelimit';
import { updateGamification } from '$lib/server/gamification';
import { CefrService } from '$lib/server/cefrService';
import { XP_CONFIG } from '$lib/server/srsConfig';
import { isClearlyCorrect } from '$lib/server/fuzzyGrade';

/** Track a correct/incorrect answer against an assignment score record. */
async function updateAssignmentScore(assignmentId: string, userId: string, isCorrect: boolean) {
	const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
	if (!assignment) {
		console.error(`Assignment ${assignmentId} not found`);
		throw new Error('Assignment not found');
	}

	// Verify the user is a member of the assignment's class
	const member = await prisma.classMember.findUnique({
		where: { classId_userId: { classId: assignment.classId, userId } }
	});
	if (!member) {
		throw new Error('User is not a member of this class');
	}

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
}

export async function POST(event) {
	const { request, locals } = event;

	const user = locals.user ? await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: { useLocalLlm: true }
	}) : null;

	if (!user?.useLocalLlm && await submitAnswerRateLimiter.isLimited(event)) {
		return json({ error: 'Too many requests. Limit is 15/min, 300/day.' }, { status: 429 });
	}

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			userInput,
			targetSentence,
			targetedVocabularyIds,
			targetedGrammarIds,
			gameMode: bodyGameMode,
			assignmentId,
			activeLanguageName: bodyLanguageName
		} = body;
		const userId = locals.user.id;
		const gameMode = bodyGameMode || 'native-to-target';

		console.log("SUBMIT ANSWER REQUEST:", {
			targetedVocabularyIds,
			targetedGrammarIds,
			gameMode,
			activeLanguageName: bodyLanguageName
		});

		if (!userInput || !targetSentence) {
			return json({ error: 'Missing userInput or targetSentence' }, { status: 400 });
		}

		// Fetch the full objects for the targeted IDs, preserving client's order
		const targetedVocabRaw = await prisma.vocabulary.findMany({
			where: { id: { in: targetedVocabularyIds || [] } }
		});
		const targetedVocabulary = (targetedVocabularyIds || [])
			.map((id: string) => targetedVocabRaw.find((v) => v.id === id))
			.filter(Boolean);

		const targetedGrammarRaw = await prisma.grammarRule.findMany({
			where: { id: { in: targetedGrammarIds || [] } }
		});
		const targetedGrammar = (targetedGrammarIds || [])
			.map((id: string) => targetedGrammarRaw.find((g) => g.id === id))
			.filter(Boolean);

			// Fast-path for multiple choice: no LLM needed
		if (gameMode === 'multiple-choice') {
			const isCorrect = userInput.trim() === targetSentence.trim();
			const score = isCorrect ? 1.0 : 0.0;
			const evaluation = {
				globalScore: score,
				vocabularyUpdates: targetedVocabulary.map((v: any, i: number) => ({ id: `v${i}`, score })),
				grammarUpdates: targetedGrammar.map((g: any, i: number) => ({ id: `g${i}`, score })),
				extraVocabLemmas: [],
				feedback: isCorrect ? 'Correct!' : 'Incorrect.',
				feedbackEnglish: isCorrect ? 'Correct!' : 'Incorrect.'
			};

			const remappedEvaluation = {
				...evaluation,
				vocabularyUpdates: targetedVocabulary.map((v: any) => ({ id: v.id, score })),
				grammarUpdates: targetedGrammar.map((g: any) => ({ id: g.id, score }))
			};

			console.log('Sending payload to updateEloRatings:', JSON.stringify(remappedEvaluation, null, 2));
			await updateEloRatings(userId, remappedEvaluation, gameMode);

			let assignmentProgress = null;
			if (assignmentId) {
				try {
					assignmentProgress = await updateAssignmentScore(assignmentId, userId, isCorrect);
				} catch (err) {
					console.error('Assignment score update failed:', err);
					// Continue execution - assignment tracking is non-critical
				}
			}

			// Award XP for correct answers (multiple choice awards less).
			// No XP during class assignments — prevents gaming the system.
			const xpToAdd = isCorrect && !assignmentId ? XP_CONFIG.CORRECT_ANSWER.MULTIPLE_CHOICE : 0;
			if (xpToAdd > 0) {
				await updateGamification(userId, xpToAdd);
			}

			// Check for CEFR level up
			let levelUp = null;
			if (locals.user.activeLanguage?.id) {
				levelUp = await CefrService.evaluateLevelUp(userId, locals.user.activeLanguage.id);
			}

			return json({ ...remappedEvaluation, assignmentProgress, levelUp });
		}

		// Fast path for translation modes: skip LLM if fuzzy matching is confident
		// (skip fill-blank: userInput is only the blank words, not the full sentence)
		if (gameMode === 'native-to-target' || gameMode === 'target-to-native') {
			if (isClearlyCorrect(userInput, targetSentence)) {
				const score = 1.0;
				const remappedEvaluation = {
					globalScore: score,
					vocabularyUpdates: targetedVocabulary.map((v: any) => ({ id: v.id, score })),
					grammarUpdates: targetedGrammar.map((g: any) => ({ id: g.id, score })),
					extraVocabLemmas: [],
					feedback: 'Correct!',
					feedbackEnglish: 'Correct!'
				};

				await updateEloRatings(userId, remappedEvaluation, gameMode);

				let assignmentProgress = null;
				if (assignmentId) {
					try {
						assignmentProgress = await updateAssignmentScore(assignmentId, userId, true);
					} catch (err) {
						console.error('Assignment score update failed:', err);
					}
				}

				// No XP during class assignments — prevents gaming the system.
			if (!assignmentId) {
				await updateGamification(userId, XP_CONFIG.CORRECT_ANSWER.OTHER_MODES);
			}

				let levelUp = null;
				if (locals.user.activeLanguage?.id) {
					levelUp = await CefrService.evaluateLevelUp(userId, locals.user.activeLanguage.id);
				}

				return json({ ...remappedEvaluation, assignmentProgress, levelUp });
			}
		}

		let userLevel = locals.user.cefrLevel || 'A1';
		let activeLanguageName = bodyLanguageName || locals.user.activeLanguage?.name || 'German';
		const activeLanguageId = locals.user.activeLanguage?.id;

		if (assignmentId) {
			const assignment = await prisma.assignment.findUnique({
				where: { id: assignmentId }
			});
			if (assignment) {
				if (assignment.targetCefrLevel) {
					userLevel = assignment.targetCefrLevel;
				}
				if (assignment.language && assignment.language !== 'international') {
					const assignmentLanguage = await prisma.language.findUnique({
						where: { code: assignment.language }
					});
					if (assignmentLanguage) {
						activeLanguageName = assignmentLanguage.name;
					}
				}
			}
		}

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
			stream: false,
			signal: request.signal
		});

		const data = llmResponse;
		let fullContent = data.choices?.[0]?.message?.content || '';

		// Strip markdown JSON block if present
		const firstBrace = fullContent.indexOf('{');
		const lastBrace = fullContent.lastIndexOf('}');
		if (firstBrace !== -1 && lastBrace !== -1) {
			fullContent = fullContent.slice(firstBrace, lastBrace + 1);
		} else {
			console.error("No JSON braces found in LLM response:", fullContent);
		}

		const stream = new ReadableStream({
			async start(controller) {
				try {
					if (fullContent) {
						controller.enqueue(new TextEncoder().encode(fullContent));
					}
				} catch (err) {
					console.error('Stream read error in submit-answer', err);
				}

				// Post-stream processing: parse response, update Elo/SRS, then send final payload, then close
				try {
					const evaluation = parseEvaluationResponse(fullContent);
					// Remap short IDs (v0, g0, ...) back to real UUIDs for DB updates
					const remappedEvaluation = {
						...evaluation,
						vocabularyUpdates: evaluation.vocabularyUpdates.map((u: any) => ({
							...u,
							id: idMap[u.id] || u.id
						})),
						grammarUpdates: evaluation.grammarUpdates.map((u: any) => ({
							...u,
							id: idMap[u.id] || u.id
						}))
					};

					console.log('Sending payload to updateEloRatings:', JSON.stringify(remappedEvaluation, null, 2));
					await updateEloRatings(userId, remappedEvaluation, gameMode);

					// Track assignment score if applicable
					let assignmentProgress = null;
					const isCorrect = (evaluation.globalScore ?? 0) >= 0.5;
					if (assignmentId) {
						try {
							assignmentProgress = await updateAssignmentScore(assignmentId, userId, isCorrect);
						} catch (err) {
							console.error('Assignment score update failed:', err);
							// Continue execution - assignment tracking is non-critical
						}
					}

					// Award XP for high-scoring answers.
					// No XP during class assignments — prevents gaming the system.
					const earnedXp = (evaluation.globalScore ?? 0) >= XP_CONFIG.SCORE_THRESHOLD && !assignmentId;
					const xpToAdd = earnedXp ? XP_CONFIG.CORRECT_ANSWER.OTHER_MODES : 0;
					if (xpToAdd > 0) {
						await updateGamification(userId, xpToAdd);
					}

					// Check for CEFR level up
					let levelUp = null;
					if (activeLanguageId) {
						levelUp = await CefrService.evaluateLevelUp(userId, activeLanguageId);
					}

					// Send the final evaluation payload before closing the stream
					// We return the remapped evaluation so the client gets real UUIDs back with eloAfter
					controller.enqueue(
						new TextEncoder().encode(
							`\n\nJSON_PAYLOAD:${JSON.stringify({ ...remappedEvaluation, assignmentProgress, levelUp })}`
						)
					);
				} catch (e) {
					console.error('Post-stream processing error in submit-answer:', e);
				}

				controller.close();
			},
			cancel() {
				// Stream cancelled by client
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
