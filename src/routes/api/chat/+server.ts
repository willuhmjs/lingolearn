import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { generateChatCompletion, type ChatMessage } from '$lib/server/llm';
import { chatPracticeRateLimiter } from '$lib/server/ratelimit';

export async function POST(event) {
	// Apply rate limiting
	if (await chatPracticeRateLimiter.isLimited(event)) {
		return json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
	}

	const session = await event.locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = session.user.id;
	const { sessionId, message, persona, language } = await event.request.json();

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
				persona
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

	const systemPrompt = `You are an AI fully immersed in a live-action roleplay (LARP). You are completely taking on the persona of a "${currentSession.persona}". The user is practicing the "${currentSession.language}" language.
You must embody this character completely, down to your personality, quirks, and worldview. NEVER break character, never refer to yourself as an AI, and respond exactly as this character naturally would in ${currentSession.language}. 
Keep your responses relatively short, realistic, and conversational, suitable for an authentic dialogue.
If the user makes significant grammar or vocabulary mistakes in their message, you may optionally provide a brief correction in the "correction" field, but your main "reply" must remain 100% in character and focused on the natural flow of the conversation.
Return your response as a JSON object with the following structure:
{
  "reply": "Your response as the persona in ${currentSession.language}",
  "correction": "Optional string: Brief correction of the user's last message if needed, otherwise null"
}`;

	try {
		const response = await generateChatCompletion({
			userId,
			messages: chatMessages,
			systemPrompt,
			jsonMode: true,
			stream: true,
			signal: event.request.signal
		});

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

				const reader = response.body?.getReader();
				if (!reader) {
					controller.close();
					return;
				}

				const decoder = new TextDecoder();
				let buffer = '';
				let fullContent = '';

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							const trimmedLine = line.trim();
							if (trimmedLine.startsWith('data:') && !trimmedLine.includes('[DONE]')) {
								try {
									const dataStr = trimmedLine.slice(5).trim();
									const data = JSON.parse(dataStr);
									const content = data.choices[0]?.delta?.content || data.choices[0]?.message?.content || '';
									if (content) {
										fullContent += content;
										controller.enqueue(
											new TextEncoder().encode(JSON.stringify({ type: 'chunk', content }) + '\n')
										);
									}
								} catch {
									// ignore partial JSON parse errors
								}
							}
						}
					}

					const finalBufferTrimmed = buffer.trim();
					if (finalBufferTrimmed.startsWith('data:') && !finalBufferTrimmed.includes('[DONE]')) {
						try {
							const dataStr = finalBufferTrimmed.slice(5).trim();
							const data = JSON.parse(dataStr);
							const content = data.choices[0]?.delta?.content || '';
							if (content) {
								fullContent += content;
								controller.enqueue(
									new TextEncoder().encode(JSON.stringify({ type: 'chunk', content }) + '\n')
								);
							}
						} catch {
							// ignore parse errors
						}
					}

					let parsedResponse;
					try {
						parsedResponse = JSON.parse(fullContent);
					} catch (error) {
						console.error('Failed to parse LLM response as JSON:', fullContent, error);
						parsedResponse = { reply: fullContent, correction: null };
					}

					const aiMessage = await prisma.message.create({
						data: {
							sessionId: currentSessionId,
							role: 'assistant',
							content: parsedResponse.reply,
							correction: parsedResponse.correction
						}
					});

					controller.enqueue(
						new TextEncoder().encode(JSON.stringify({ type: 'done', message: aiMessage }) + '\n')
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
