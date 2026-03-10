import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { generateChatCompletion, type ChatMessage } from '$lib/server/llm';
import { chatPracticeRateLimiter } from '$lib/server/ratelimit';
import { updateEloRatings } from '$lib/server/grader';

export async function POST(event) {
	const { locals } = event;
	const user = locals.user ? await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: { useLocalLlm: true }
	}) : null;

	// Apply rate limiting
	if (!user?.useLocalLlm && await chatPracticeRateLimiter.isLimited(event)) {
		return json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
	}

	const session = await locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = session.user.id;
	const { sessionId, message, persona, language, assignmentId } = await event.request.json();

	if (!message) {
		return json({ error: 'Message is required' }, { status: 400 });
	}

	const normalizedMessage = message
		.replace(/ß/g, 'ss')
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/Ä/g, 'Ae')
		.replace(/Ö/g, 'Oe')
		.replace(/Ü/g, 'Ue');

	let currentSessionId = sessionId;
	let currentSession;

	// Create a new session if one doesn't exist
	if (!currentSessionId) {
		if (!persona || !language) {
			return json(
				{ error: 'Persona and language are required for a new session' },
				{ status: 400 }
			);
		}

		currentSession = await prisma.conversationSession.create({
			data: {
				userId,
				language,
				persona,
				assignmentId: assignmentId || null
			}
		});
		currentSessionId = currentSession.id;
	} else {
		currentSession = await prisma.conversationSession.findUnique({
			where: { id: currentSessionId, userId }
		});
		if (!currentSession) {
			return json({ error: 'Session not found' }, { status: 404 });
		}
	}

	let assignmentTopic = null;
	let assignmentGoalTurns = null;
	if ('assignmentId' in currentSession && currentSession.assignmentId) {
		const assignment = await prisma.assignment.findUnique({
			where: { id: currentSession.assignmentId as string }
		});
		if (assignment) {
			assignmentTopic = assignment.topic;
			assignmentGoalTurns = assignment.targetScore || 5;
		}
	}

	// Fetch user's vocabulary that needs review
	const activeLanguageName = language || currentSession.language;
	const { getCachedLanguageByName } = await import('$lib/server/cache');
	const activeLanguage = await getCachedLanguageByName(activeLanguageName);

	let userVocabList = '';
	const vocabIdMap: Record<string, string> = {};
	const vocabLemmaMap: Record<string, string> = {};
	
	let userGrammarList = '';
	const grammarIdMap: Record<string, string> = {};

	if (activeLanguage) {
		const userVocabs = await prisma.userVocabulary.findMany({
			where: {
				userId,
				vocabulary: { languageId: activeLanguage.id }
			},
			include: { vocabulary: true },
			take: 20, // get some recent/active vocab
			orderBy: { nextReviewDate: 'asc' }
		});

		userVocabs.forEach((uv, i) => {
			vocabIdMap[`v${i}`] = uv.vocabulary.id;
			vocabLemmaMap[`v${i}`] = uv.vocabulary.lemma;
			userVocabList += `- ${uv.vocabulary.lemma} (ID: v${i})\n`;
		});

		const userGrammars = await prisma.userGrammarRule.findMany({
			where: {
				userId,
				grammarRule: { languageId: activeLanguage.id }
			},
			include: { grammarRule: true },
			take: 10, // Increased from 5 to improve tracking comprehensiveness
			orderBy: { nextReviewDate: 'asc' }
		});

		userGrammars.forEach((ug, i) => {
			grammarIdMap[`g${i}`] = ug.grammarRule.id;
			userGrammarList += `- ${ug.grammarRule.title} (ID: g${i})\n`;
		});
	}

	// Save the user's message
	await prisma.message.create({
		data: {
			sessionId: currentSessionId,
			role: 'user',
			content: normalizedMessage
		}
	});

	// Fetch conversation history
	const history = await prisma.message.findMany({
		where: { sessionId: currentSessionId },
		orderBy: { createdAt: 'asc' }
	});

	const chatMessages: ChatMessage[] = history.map((m) => ({
		role: m.role as 'user' | 'assistant',
		content: m.content
	}));

	const userMessageCount = history.filter(m => m.role === 'user').length;
	
	let assignmentPrompt = '';
	if ('assignmentId' in currentSession && currentSession.assignmentId && assignmentTopic) {
		assignmentPrompt = `\nIMPORTANT ASSIGNMENT INSTRUCTIONS:
The user is completing an assignment. The required topic of conversation is: "${assignmentTopic}".
You must steer the conversation towards this topic naturally.
The user has completed ${userMessageCount} out of ${assignmentGoalTurns} required turns.
Set "assignmentCompleted" to true if the user has reached at least ${assignmentGoalTurns} turns and has successfully discussed the topic. Otherwise set it to false.\n`;
	}

	const systemPrompt = `You are an AI fully immersed in a live-action roleplay (LARP). You are completely taking on the persona of a "${currentSession.persona}". The user is practicing the "${currentSession.language}" language.
You must embody this character completely, down to your personality, quirks, and worldview. NEVER break character, never refer to yourself as an AI, and respond exactly as this character naturally would in ${currentSession.language}. 
Keep your responses relatively short, realistic, and conversational, suitable for an authentic dialogue.

In addition to your reply, you must act as a grader. You must ONLY evaluate the user's MOST RECENT message for both vocabulary and grammar accuracy.
CRITICAL: Do NOT correct or evaluate any previous messages in the chat history. The chat history is provided ONLY for conversational context. Your feedback must apply EXCLUSIVELY to the very last message sent by the user.
Provide brief feedback in English ("feedbackEnglish") on their grammar and vocabulary usage in their MOST RECENT message only.
If the user correctly used any of their targeted vocabulary in their most recent message, or if you can evaluate words they used, provide a score (0.0 to 1.0) for them in "vocabularyUpdates".
If they correctly used any of their targeted grammar rules in their most recent message, provide a score (0.0 to 1.0) for them in "grammarUpdates". BE THOROUGH: if the most recent message demonstrates a grammar rule (e.g. past tense, word order), you MUST score it.
If they used OTHER ${currentSession.language} words correctly by coincidence in their most recent message, list their base forms (lemmas) in lowercase in "extraVocabLemmas".
${assignmentPrompt}

Targeted Vocabulary the user is learning (Score these if used):
${userVocabList || '(None currently active)'}

Targeted Grammar Rules the user is learning (Score these if demonstrated):
${userGrammarList || '(None currently active)'}

Return your response as a JSON object with the following structure:
{
  "message": "Your response as the persona in ${currentSession.language}",
  "feedbackEnglish": "Brief English feedback on the user's grammar/vocabulary usage strictly in their MOST RECENT message",
  "vocabularyUpdates": [ { "id": "<vocabulary ID from the list>", "score": <number (0.0 to 1.0)> } ],
  "grammarUpdates": [ { "id": "<grammar ID from the list>", "score": <number (0.0 to 1.0)> } ],
  "extraVocabLemmas": ["<lemma1>", "<lemma2>"]${('assignmentId' in currentSession && currentSession.assignmentId) ? ',\n  "assignmentCompleted": <boolean>' : ''}
}`;

	try {
		console.log('Sending message to OpenAI...', { messages: chatMessages.length, systemPrompt });
		const response = await generateChatCompletion({
			userId,
			messages: chatMessages,
			systemPrompt,
			jsonMode: true,
			stream: true,
			signal: event.request.signal
		});
		console.log('OpenAI response started streaming');

		const stream = new ReadableStream({
			async start(controller) {
				// Send metadata first
				controller.enqueue(
					new TextEncoder().encode(
						JSON.stringify({
							type: 'metadata',
							sessionId: currentSessionId
						}) + '\n'
					)
				);

				let fullContent = '';

				try {
					for await (const chunk of response) {
						const content = chunk.choices[0]?.delta?.content || '';
						if (content) {
							fullContent += content;
							controller.enqueue(
								new TextEncoder().encode(JSON.stringify({ type: 'chunk', content }) + '\n')
							);
						}
					}

					let parsedResponse;
					try {
						parsedResponse = JSON.parse(fullContent);
					} catch (error) {
						console.error('Failed to parse LLM response as JSON:', fullContent, error);
						parsedResponse = { message: fullContent, feedbackEnglish: null, vocabularyUpdates: [], extraVocabLemmas: [] };
					}

					// Update DB based on parsed response
					const replyMessage = parsedResponse.message || parsedResponse.reply || '';
					const aiMessage = await prisma.message.create({
						data: {
							sessionId: currentSessionId,
							role: 'assistant',
							content: replyMessage,
							correction: parsedResponse.feedbackEnglish
						}
					});

					// Map vocabulary IDs back
					const mappedVocabUpdates = (parsedResponse.vocabularyUpdates || []).map((u: { id: string, score: number }) => ({
						id: vocabIdMap[u.id] || u.id,
						score: u.score,
						lemma: vocabLemmaMap[u.id] || u.id
					}));

					// Map grammar IDs back
					const mappedGrammarUpdates = (parsedResponse.grammarUpdates || []).map((u: { id: string, score: number }) => ({
						id: grammarIdMap[u.id] || u.id,
						score: u.score
					}));

					// Update parsedResponse for the frontend
					parsedResponse.vocabularyUpdates = mappedVocabUpdates;
					parsedResponse.grammarUpdates = mappedGrammarUpdates;

					const evaluationPayload = {
						globalScore: 1.0,
						vocabularyUpdates: mappedVocabUpdates.map((u: { id: string; score: number }) => ({ id: u.id, score: u.score })),
						grammarUpdates: mappedGrammarUpdates.map((u: { id: string; score: number }) => ({ id: u.id, score: u.score })),
						extraVocabLemmas: parsedResponse.extraVocabLemmas || [],
						feedback: '',
						feedbackEnglish: parsedResponse.feedbackEnglish || ''
					};

					if (mappedVocabUpdates.length > 0 || mappedGrammarUpdates.length > 0 || evaluationPayload.extraVocabLemmas.length > 0) {
						await updateEloRatings(userId, evaluationPayload, 'native-to-target');
					}

					if ('assignmentId' in currentSession && currentSession.assignmentId && parsedResponse.assignmentCompleted) {
						await prisma.assignmentScore.upsert({
							where: {
								assignmentId_userId: {
									assignmentId: currentSession.assignmentId as string,
									userId
								}
							},
							create: {
								assignmentId: currentSession.assignmentId as string,
								userId,
								score: 100,
								passed: true
							},
							update: {
								score: 100,
								passed: true
							}
						});
					}

					controller.enqueue(
						new TextEncoder().encode(JSON.stringify({ type: 'done', message: aiMessage, grading: parsedResponse }) + '\n')
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
