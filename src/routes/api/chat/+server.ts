import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { generateChatCompletion, type ChatMessage } from '$lib/server/llm';
import { chatPracticeRateLimiter } from '$lib/server/ratelimit';
import { updateEloRatings } from '$lib/server/grader';
import { sanitizeForPrompt } from '$lib/server/sanitize';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';

export async function POST(event) {
	const { locals } = event;
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;
	const useLocalLlm = locals.user.useLocalLlm ?? false;

	if (!useLocalLlm && (await chatPracticeRateLimiter.isLimited(event))) {
		return json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
	}

	if (!useLocalLlm && (await isQuotaExceeded(userId, false))) {
		return json({ error: 'Daily AI quota exceeded. Please try again tomorrow.' }, { status: 429 });
	}
	const { sessionId, message, persona, language, assignmentId } = await event.request.json();

	if (!message) {
		return json({ error: 'Message is required' }, { status: 400 });
	}

	if (typeof message !== 'string' || message.length > 2000) {
		return json({ error: 'Message must be a string of at most 2000 characters' }, { status: 400 });
	}

	// Load or create a conversation session for DB-persisted history
	let convSessionId = sessionId as string | undefined;
	let chatHistory: ChatMessage[] = [];

	if (convSessionId) {
		// Verify session belongs to user and load history
		const existingSession = await prisma.conversationSession.findFirst({
			where: { id: convSessionId, userId },
			include: {
				messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true } }
			}
		});
		if (existingSession) {
			chatHistory = existingSession.messages.map((m) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content
			}));
		} else {
			convSessionId = undefined; // invalid session, create a new one
		}
	}

	if (!convSessionId) {
		const newSession = await prisma.conversationSession.create({
			data: {
				userId,
				language: language || '',
				persona: persona || ''
			}
		});
		convSessionId = newSession.id;
	}

	// Save the user message to DB
	await prisma.message.create({
		data: {
			sessionId: convSessionId,
			role: 'user',
			content: message
		}
	});

	const activeLanguageName = language;
	const { getCachedLanguageByName } = await import('$lib/server/cache');
	const activeLanguage = activeLanguageName
		? await getCachedLanguageByName(activeLanguageName)
		: null;

	let userVocabList = '';
	const vocabIdMap: Record<string, string> = {};
	const vocabLemmaMap: Record<string, string> = {};
	let userGrammarList = '';
	const grammarIdMap: Record<string, string> = {};

	if (activeLanguage) {
		const userVocabs = await prisma.userVocabulary.findMany({
			where: { userId, vocabulary: { languageId: activeLanguage.id } },
			include: { vocabulary: true },
			take: 20,
			orderBy: { nextReviewDate: 'asc' }
		});

		userVocabs.forEach((uv, i) => {
			vocabIdMap[`v${i}`] = uv.vocabulary.id;
			vocabLemmaMap[`v${i}`] = uv.vocabulary.lemma;
			userVocabList += `- ${uv.vocabulary.lemma} (ID: v${i})\n`;
		});

		const userGrammars = await prisma.userGrammarRule.findMany({
			where: { userId, grammarRule: { languageId: activeLanguage.id } },
			include: { grammarRule: true },
			take: 10,
			orderBy: { nextReviewDate: 'asc' }
		});

		userGrammars.forEach((ug, i) => {
			grammarIdMap[`g${i}`] = ug.grammarRule.id;
			userGrammarList += `- ${ug.grammarRule.title} (ID: g${i})\n`;
		});
	}

	// Resolve assignment info if applicable
	let assignmentTopic: string | null = null;
	let assignmentGoalTurns: number | null = null;
	if (assignmentId) {
		const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
		if (assignment) {
			assignmentTopic = assignment.topic ?? null;
			assignmentGoalTurns = assignment.targetScore || 5;
		}
	}

	const userMessageCount = chatHistory.filter((m) => m.role === 'user').length + 1; // +1 for current message

	let assignmentPrompt = '';
	if (assignmentId && assignmentTopic) {
		const safeAssignmentTopic = sanitizeForPrompt(assignmentTopic, 300);
		assignmentPrompt = `\nIMPORTANT ASSIGNMENT INSTRUCTIONS:
The user is completing an assignment. The required topic of conversation is: "${safeAssignmentTopic}".
You must steer the conversation towards this topic naturally.
The user has completed ${userMessageCount} out of ${assignmentGoalTurns} required turns.
Set "assignmentCompleted" to true if the user has reached at least ${assignmentGoalTurns} turns and has successfully discussed the topic. Otherwise set it to false.\n`;
	}

	const systemPrompt = `You are an AI fully immersed in a live-action roleplay (LARP). You are completely taking on the persona of a "${persona}". The user is practicing the "${language}" language.
You must embody this character completely, down to your personality, quirks, and worldview. NEVER break character, never refer to yourself as an AI, and respond exactly as this character naturally would in ${language}.
Keep your responses relatively short, realistic, and conversational, suitable for an authentic dialogue.

In addition to your reply, you must act as a grader. You must ONLY evaluate the user's MOST RECENT message for both vocabulary and grammar accuracy.
CRITICAL: Do NOT correct or evaluate any previous messages in the chat history. The chat history is provided ONLY for conversational context. Your feedback must apply EXCLUSIVELY to the very last message sent by the user.
Provide brief feedback in English ("feedback") on their grammar and vocabulary usage in their MOST RECENT message only. Set "correctionType" to "correction" if the message contained errors that need fixing, or "feedback" if the message was correct or only has minor style notes.
If the user correctly used any of their targeted vocabulary in their most recent message, or if you can evaluate words they used, provide a score (0.0 to 1.0) for them in "vocabularyUpdates".
If they correctly used any of their targeted grammar rules in their most recent message, provide a score (0.0 to 1.0) for them in "grammarUpdates". BE THOROUGH: if the most recent message demonstrates a grammar rule (e.g. past tense, word order), you MUST score it.
If they used OTHER ${language} words correctly by coincidence in their most recent message, list their base forms (lemmas) in lowercase in "extraVocabLemmas".
${assignmentPrompt}

Targeted Vocabulary the user is learning (Score these if used):
${userVocabList || '(None currently active)'}

Targeted Grammar Rules the user is learning (Score these if demonstrated):
${userGrammarList || '(None currently active)'}

Return your response as a JSON object with the following structure:
{
  "message": "Your response as the persona in ${language}",
  "feedback": "Brief English feedback on the user's grammar/vocabulary usage strictly in their MOST RECENT message",
  "correctionType": "correction" | "feedback",
  "globalScore": <number (0.0 to 1.0) — holistic quality score for the user's MOST RECENT message. 0.0 = no attempt or help request, 0.5 = significant errors, 0.85+ = correct with minor issues>,
  "vocabularyUpdates": [ { "id": "<vocabulary ID from the list>", "score": <number (0.0 to 1.0)> } ],
  "grammarUpdates": [ { "id": "<grammar ID from the list>", "score": <number (0.0 to 1.0)> } ],
  "extraVocabLemmas": ["<lemma1>", "<lemma2>"]${assignmentId ? ',\n  "assignmentCompleted": <boolean>' : ''}
}`;

	// Append the current user message to history for the LLM call
	const llmMessages: ChatMessage[] = [...chatHistory, { role: 'user', content: message }];

	try {
		const response = await generateChatCompletion({
			userId,
			messages: llmMessages,
			systemPrompt,
			jsonMode: true,
			stream: true
		});

		const stream = new ReadableStream({
			async start(controller) {
				// Emit session metadata so the client can track the conversation
				controller.enqueue(
					new TextEncoder().encode(
						JSON.stringify({ type: 'metadata', sessionId: convSessionId }) + '\n'
					)
				);

				let fullContent = '';
				let totalTokens = 0;

				try {
					for await (const chunk of response) {
						if (chunk.usage?.total_tokens) {
							totalTokens = chunk.usage.total_tokens;
						}
						const content = chunk.choices[0]?.delta?.content || '';
						if (content) {
							fullContent += content;
							controller.enqueue(
								new TextEncoder().encode(JSON.stringify({ type: 'chunk', content }) + '\n')
							);
						}
					}

					if (!useLocalLlm && totalTokens > 0) {
						recordTokenUsage(userId, totalTokens);
					}

					let parsedResponse;
					try {
						parsedResponse = JSON.parse(fullContent);
					} catch (error) {
						console.error('Failed to parse LLM response as JSON:', fullContent, error);
						parsedResponse = {
							message: fullContent,
							feedback: null,
							vocabularyUpdates: [],
							extraVocabLemmas: []
						};
					}

					// Map vocabulary IDs back to real UUIDs
					const mappedVocabUpdates = (parsedResponse.vocabularyUpdates || []).map(
						(u: { id: string; score: number }) => ({
							id: vocabIdMap[u.id] || u.id,
							score: u.score,
							lemma: vocabLemmaMap[u.id] || u.id
						})
					);

					// Map grammar IDs back to real UUIDs
					const mappedGrammarUpdates = (parsedResponse.grammarUpdates || []).map(
						(u: { id: string; score: number }) => ({
							id: grammarIdMap[u.id] || u.id,
							score: u.score
						})
					);

					parsedResponse.vocabularyUpdates = mappedVocabUpdates;
					parsedResponse.grammarUpdates = mappedGrammarUpdates;

					// Use LLM's holistic globalScore; fall back to mean of item scores
					const allItemScores = [
						...mappedVocabUpdates.map((u: { score: number }) => u.score),
						...mappedGrammarUpdates.map((u: { score: number }) => u.score)
					];
					const fallbackScore =
						allItemScores.length > 0
							? allItemScores.reduce((a: number, b: number) => a + b, 0) / allItemScores.length
							: 1.0;
					const globalScore =
						typeof parsedResponse.globalScore === 'number'
							? Math.max(0, Math.min(1, parsedResponse.globalScore))
							: fallbackScore;

					const evaluationPayload = {
						globalScore,
						vocabularyUpdates: mappedVocabUpdates.map((u: { id: string; score: number }) => ({
							id: u.id,
							score: u.score
						})),
						grammarUpdates: mappedGrammarUpdates.map((u: { id: string; score: number }) => ({
							id: u.id,
							score: u.score
						})),
						extraVocabLemmas: parsedResponse.extraVocabLemmas || [],
						feedback: parsedResponse.feedback || ''
					};

					if (
						mappedVocabUpdates.length > 0 ||
						mappedGrammarUpdates.length > 0 ||
						evaluationPayload.extraVocabLemmas.length > 0
					) {
						await updateEloRatings(userId, evaluationPayload, 'native-to-target');
					}

					// Save assistant response to DB
					const assistantContent = parsedResponse.message || fullContent;
					await prisma.message.create({
						data: {
							sessionId: convSessionId!,
							role: 'assistant',
							content: assistantContent,
							correction: parsedResponse.feedback || null
						}
					});

					// Record assignment completion if applicable (grade data — always persisted)
					if (assignmentId && parsedResponse.assignmentCompleted) {
						await prisma.assignmentScore.upsert({
							where: { assignmentId_userId: { assignmentId, userId } },
							create: { assignmentId, userId, score: 100, passed: true },
							update: { score: 100, passed: true }
						});
					}

					controller.enqueue(
						new TextEncoder().encode(
							JSON.stringify({ type: 'done', grading: parsedResponse }) + '\n'
						)
					);

					controller.close();
				} catch (e) {
					controller.error(e);
				}
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'application/x-ndjson',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (error) {
		console.error('Error generating chat response:', error);
		return json({ error: 'Failed to generate response' }, { status: 500 });
	}
}
