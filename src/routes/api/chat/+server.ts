import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { generateChatCompletion, type ChatMessage } from '$lib/server/llm';

export async function POST({ request, locals }) {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = session.user.id;
	const { sessionId, message, persona, language } = await request.json();

	if (!message) {
		return json({ error: 'Message is required' }, { status: 400 });
	}

	let currentSessionId = sessionId;
	let currentSession;

	// Create a new session if one doesn't exist
	if (!currentSessionId) {
		if (!persona || !language) {
			return json({ error: 'Persona and language are required for a new session' }, { status: 400 });
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
			content: message
		}
	});

	// Fetch conversation history
	const history = await prisma.message.findMany({
		where: { sessionId: currentSessionId },
		orderBy: { createdAt: 'asc' }
	});

	const chatMessages: ChatMessage[] = history.map(m => ({
		role: m.role as 'user' | 'assistant',
		content: m.content
	}));

	const systemPrompt = `You are an AI acting as a "${currentSession.persona}" in a conversational roleplay. The user is practicing the "${currentSession.language}" language.
Respond naturally in character in ${currentSession.language}. Keep your responses relatively short and conversational, suitable for language practice.
If the user makes significant grammar or vocabulary mistakes in their message, you may optionally provide a brief correction, but prioritize the natural flow of the conversation. 
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
			jsonMode: true
		});

		const responseContent = response.choices[0]?.message?.content;
		if (!responseContent) {
			throw new Error('No response from LLM');
		}

		let parsedResponse;
		try {
			parsedResponse = JSON.parse(responseContent);
		} catch (error) {
			console.error('Failed to parse LLM response as JSON:', responseContent, error);
			parsedResponse = { reply: responseContent, correction: null };
		}

		const aiMessage = await prisma.message.create({
			data: {
				sessionId: currentSessionId,
				role: 'assistant',
				content: parsedResponse.reply,
				correction: parsedResponse.correction
			}
		});

		return json({
			sessionId: currentSessionId,
			message: aiMessage
		});
	} catch (error) {
		console.error('Error generating chat response:', error);
		return json({ error: 'Failed to generate response' }, { status: 500 });
	}
}
