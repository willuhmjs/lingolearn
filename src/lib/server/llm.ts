import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/prisma';
import { getSiteSettings } from '$lib/server/settings';
import OpenAI from 'openai';

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface GenerateChatCompletionOptions {
	userId: string;
	messages: ChatMessage[];
	model?: string;
	systemPrompt?: string;
	jsonMode?: boolean;
	jsonSchema?: Record<string, unknown>;
	temperature?: number;
	stream?: boolean;
	signal?: AbortSignal;
}

/**
 * Calls an OpenAI-compatible /v1/chat/completions endpoint using the OpenAI SDK.
 * Looks up custom base URL and API key from the User record, falling back to env vars.
 */
export async function generateChatCompletion({
	userId,
	messages,
	model,
	systemPrompt,
	jsonMode = false,
	jsonSchema,
	temperature = 0.3,
	stream = false,
	signal
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}: GenerateChatCompletionOptions): Promise<any> {
	// 1. Fetch user credentials from database and site settings
	const [user, settings] = await Promise.all([
		prisma.user.findUnique({
			where: { id: userId },
			select: { useLocalLlm: true, llmBaseUrl: true, llmApiKey: true, activeLanguage: true }
		}),
		getSiteSettings()
	]);

	// 2. Resolve Base URL and API Key (User custom OR Site Settings OR fallback to environment variables)
	const rawBaseUrl = (
		(user?.useLocalLlm && user?.llmBaseUrl) ? user.llmBaseUrl :
		settings.llmEndpoint ||
		env.DEFAULT_LLM_BASE_URL ||
		''
	).replace(/^["']|["']$/g, '');
	
	const apiKey = (
		(user?.useLocalLlm && user?.llmApiKey) ? user.llmApiKey :
		settings.llmApiKey || 
		env.DEFAULT_LLM_API_KEY || 
		''
	).replace(
		/^["']|["']$/g,
		''
	);
	const resolvedModel = (
		model ||
		settings.llmModel ||
		env.DEFAULT_LLM_MODEL ||
		'gpt-3.5-turbo'
	).replace(/^["']|["']$/g, '');

	if (!rawBaseUrl) {
		throw new Error('LLM Base URL is not configured.');
	}

	if (!apiKey) {
		throw new Error('LLM API Key is not configured.');
	}

	let baseUrl = rawBaseUrl.replace(/\/$/, '');
	if (!baseUrl.endsWith('/v1')) {
		if (baseUrl.endsWith('/openai')) {
			// Some endpoints might be /openai
		} else {
			baseUrl += '/v1';
		}
	}

	const openai = new OpenAI({
		baseURL: baseUrl,
		apiKey: apiKey,
	});

	// 3. Prepare messages payload
	const payloadMessages = [...messages];
	const languageName = user?.activeLanguage?.name || 'German';

	let constraintPrompt = '';
	if (languageName === 'German') {
		constraintPrompt =
			"Agieren Sie als erfahrener deutscher Lektor. Schreiben Sie den Text in fehlerfreiem Hochdeutsch (Duden-Konform) und vermeiden Sie Anglizismen oder englische Schreibweisen bei verwandten Begriffen. Achten Sie besonders darauf, keine englischen Schreibweisen für deutsche Wörter zu verwenden (z.B. 'oft' statt 'often', 'kollektiv' statt 'collective').";
	} else if (languageName === 'French') {
		constraintPrompt =
			"Agissez en tant que relecteur français expérimenté. Écrivez le texte dans un français impeccable (conforme à l'Académie française) et évitez les anglicismes ou les orthographes anglaises pour les termes apparentés. Veillez particulièrement à ne pas utiliser l'orthographe anglaise pour les mots français.";
	} else if (languageName === 'Spanish') {
		constraintPrompt =
			'Actúe como un revisor de español experimentado. Escriba el texto en un español impecable (conforme a la RAE) y evite los anglicismos o la ortografía inglesa para términos relacionados. Tenga especial cuidado en no utilizar la ortografía inglesa para palabras españolas.';
	}

	if (systemPrompt) {
		payloadMessages.unshift({ role: 'system', content: `${systemPrompt}\n\n${constraintPrompt}` });
	} else if (constraintPrompt) {
		payloadMessages.unshift({ role: 'system', content: constraintPrompt });
	}

	if (jsonSchema || jsonMode) {
		// OpenAI requires the word "JSON" to be in the prompt when using json_object
		// Even without response_format, we still want to clearly ask for JSON
		const hasJsonPrompt = payloadMessages.some(m => 
			typeof m.content === 'string' && m.content.toLowerCase().includes('json')
		);
		
		if (!hasJsonPrompt) {
			if (payloadMessages.length > 0 && payloadMessages[0].role === 'system') {
				payloadMessages[0].content += '\n\nPlease return your response ONLY as valid JSON. Do not include any other text.';
			} else {
				payloadMessages.unshift({ role: 'system', content: 'Please return your response ONLY as valid JSON. Do not include any other text.' });
			}
		}
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const response = await openai.chat.completions.create({
			model: resolvedModel,
			messages: payloadMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
			temperature,
			stream: stream as boolean,
		} as OpenAI.Chat.Completions.ChatCompletionCreateParams, { signal });

		if (stream) {
			return response;
		}

		const completion = response as OpenAI.Chat.Completions.ChatCompletion;

		// Extract JSON payload if the model output special tokens or markdown around the JSON block
		if ((jsonMode || jsonSchema) && completion.choices?.[0]?.message?.content) {
			const content = completion.choices[0].message.content;
			const firstBrace = content.indexOf('{');
			const lastBrace = content.lastIndexOf('}');
			const firstBracket = content.indexOf('[');
			const lastBracket = content.lastIndexOf(']');

			let startIndex = -1;
			let endIndex = -1;

			if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
				startIndex = firstBrace;
				endIndex = lastBrace;
			} else if (firstBracket !== -1 && lastBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
				startIndex = firstBracket;
				endIndex = lastBracket;
			}

			if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
				completion.choices[0].message.content = content.substring(startIndex, endIndex + 1);
			}
		}

		return completion;
	} catch (e) {
		const error = e as Error;
		console.error(`LLM API Error: ${error.message}`, error);
		throw new Error(`LLM API Error: ${error.message}`);
	}
}

/**
 * Normalizes an array of words to their absolute dictionary form (lemma) based on the user's active language.
 * E.g., infinitives for verbs, nominative singular for nouns, base form for adjectives.
 */
export async function normalizeWords(userId: string, words: string[]): Promise<string[]> {
	if (!words || words.length === 0) return [];

	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { activeLanguage: true }
	});
	const languageName = user?.activeLanguage?.name || 'German';

	const systemPrompt = `You are an expert ${languageName} linguist. Given a list of ${languageName} words, normalize each one to its absolute dictionary form (lemma).
Rules:
1. Verbs: infinitive (e.g., "gehst" -> "gehen", "gemacht" -> "machen")
2. Nouns: nominative singular (e.g., "Äpfeln" -> "apfel", "Hauses" -> "haus")
3. Adjectives: uninflected base form (e.g., "schnellem" -> "schnell")
4. Output as JSON in this format: { "normalizedWords": ["word1", "word2"] }
5. Ensure the order matches the input exactly. Output in lowercase without articles.`;

	try {
		const response = await generateChatCompletion({
			userId,
			messages: [{ role: 'user', content: JSON.stringify(words) }],
			systemPrompt,
			jsonMode: true,
			temperature: 0.1
		});

		const result = JSON.parse(response.choices[0].message.content);
		if (result && Array.isArray(result.normalizedWords)) {
			return result.normalizedWords;
		}
	} catch (e) {
		console.error('Failed to normalize words', e);
	}

	return words; // Fallback to original words if anything fails
}
