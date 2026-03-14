import { json, type RequestEvent } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { llmDictionaryRateLimiter } from '$lib/server/ratelimit';
import { generateChatCompletion } from '$lib/server/llm';

export async function POST(event: RequestEvent) {
	const { request, locals } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: { useLocalLlm: true }
	});

	// Apply Rate Limiting
	if (!user?.useLocalLlm && await llmDictionaryRateLimiter.isLimited(event)) {
		return json({ error: 'Too many requests' }, { status: 429 });
	}

	try {
		const body = await request.json();
		const { word, languageId, existingId } = body;

		if (!word || !languageId) {
			return json({ error: 'Missing word or languageId' }, { status: 400 });
		}

		// Retrieve target language name
		const language = await prisma.language.findUnique({
			where: { id: languageId }
		});

		if (!language) {
			return json({ error: 'Invalid languageId' }, { status: 400 });
		}

		// Prepare LLM Call
		const systemPrompt = `You are an expert linguist and dictionary assistant for the ${language.name} language.
The user will provide a word or short phrase they searched for. The input may be in ${language.name} or in English.

Your task is to determine the correct ${language.name} translation or dictionary entry.
If the input is an English word or phrase (like "Apple Juice"), you must accurately translate it into ${language.name}. 
However, you MUST be extremely strict about safety: only allow inputs that are "classroom safe" (e.g., everyday vocabulary, academic, or polite words). If the input is slang, inappropriate, or unsafe for a school environment, reject it.
If the input is already in ${language.name}, verify it is a real, valid word or common phrase in ${language.name}.

${
	language.name === 'German'
		? `CRITICAL INSTRUCTION FOR GERMAN: You MUST return the word with actual umlauts (ä, ö, ü, ß) instead of their multi-letter equivalents (ae, oe, ue, ss). For example, return "Käse" instead of "Kaese", "groß" instead of "gross".
Also, if the first letter of the word (lemma) is lowercase, it MUST NOT be classified as a "noun". In German, all nouns are capitalized.`
		: ''
}

If the input is gibberish, highly inappropriate, unsafe, or not a real word/phrase in either language, respond with:
{ "valid": false }

If it is a valid word or safe English translation, normalize the ${language.name} result to its absolute dictionary form (lemma).
- Verbs: infinitive
- Nouns: nominative singular
- Adjectives: uninflected base form
- For phrases (like "Apfelsaft" for "Apple Juice"): use the most standard, natural base form.

Return the dictionary entry in the following JSON format:
{
  "valid": true,
  "lemma": "normalized base form in ${language.name}",
  "meanings": [
    {
      "value": "English translation/meaning",
      "partOfSpeech": "noun" | "verb" | "adjective" | "adverb" | "pronoun" | "preposition" | "conjunction" | "interjection" | "particle" | "article" | "phrase",
      "context": "optional usage context"
    }
  ],
  "gender": "MASCULINE" | "FEMININE" | "NEUTER" | null,
  "plural": "plural form" | null,
  "conjugations": { "present": "...", "past": "...", "future": "..." } | null,
  "declensions": { "nominative": "...", "accusative": "...", "dative": "...", "genitive": "..." } | null,
  "example": "A simple example sentence using the word in ${language.name}",
  "exampleTranslation": "English translation of the example sentence",
  "synonyms": ["synonym1", "synonym2"] | [],
  "antonyms": ["antonym1", "antonym2"] | [],
  "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null
}`;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

		const response = await generateChatCompletion({
			userId: locals.user.id,
			messages: [{ role: 'user', content: word }],
			systemPrompt,
			jsonMode: true,
			temperature: 0.1,
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		const content = response.choices?.[0]?.message?.content;
		if (!content) {
			throw new Error('No content returned from LLM');
		}

		let llmResult;
		try {
			// Strip markdown code block wrapping if present
			const cleanedContent = content.replace(/```(?:json)?\n?/gi, '').trim();
			llmResult = JSON.parse(cleanedContent);
		} catch {
			console.error('Failed to parse LLM dictionary response:', content);
			return json(
				{ success: false, error: 'Invalid response from language model' },
				{ status: 500 }
			);
		}

		if (!llmResult.valid) {
			return json(
				{ success: false, error: 'The word you entered could not be found or is invalid.' },
				{ status: 400 }
			);
		}

		// Validate required fields for valid result
		if (!llmResult.lemma) {
			return json(
				{ success: false, error: 'The word you entered could not be found or is invalid.' },
				{ status: 400 }
			);
		}

		// Check if it already exists in the database
		const existingVocab = existingId ? await prisma.vocabulary.findUnique({
			where: { id: existingId },
			include: { meanings: true }
		}) : await prisma.vocabulary.findFirst({
			where: {
				languageId: languageId,
				lemma: {
					equals: llmResult.lemma,
					mode: 'insensitive'
				}
			},
			include: { meanings: true }
		});

		// If it exists and has meanings, check if it's sparse (missing metadata enrichment).
		// If not sparse, return as-is. If sparse, fall through to update it with LLM data.
		if (existingVocab && existingVocab.meanings && existingVocab.meanings.length > 0) {
			const GENDERED_LANGUAGES = ['german', 'french', 'spanish', 'italian', 'portuguese', 'russian'];
			const isNoun = existingVocab.partOfSpeech === 'noun';
			const langIsGendered = GENDERED_LANGUAGES.includes(language.name.toLowerCase());
			const missingGender = isNoun && langIsGendered && !existingVocab.gender;
			const meta = existingVocab.metadata as Record<string, unknown> | null;
			const isSparse = missingGender || !meta || !(meta.example || meta.declensions || meta.conjugations);
			if (!isSparse) {
				return json({ success: true, data: existingVocab });
			}
			// Sparse — fall through to enrich with LLM data below
		}

		// Enforce German lowercase non-noun rule programmatically just in case
		const primaryPos = llmResult.meanings?.[0]?.partOfSpeech || 'other';
		
		if (
			language.name.toUpperCase() === 'GERMAN' &&
			llmResult.lemma.charAt(0) === llmResult.lemma.charAt(0).toLowerCase()
		) {
			if (primaryPos === 'noun') {
				if (llmResult.meanings && llmResult.meanings[0]) {
					llmResult.meanings[0].partOfSpeech = 'other'; // or another fallback, but strictly not noun
				}
			}
		}

		// If new valid word, insert it
		const metadata: Record<string, unknown> = {};
		if (llmResult.conjugations) metadata.conjugations = llmResult.conjugations;
		if (llmResult.declensions) metadata.declensions = llmResult.declensions;
		if (llmResult.example) metadata.example = llmResult.example;
		if (llmResult.exampleTranslation) metadata.exampleTranslation = llmResult.exampleTranslation;
		if (llmResult.synonyms) metadata.synonyms = llmResult.synonyms;
		if (llmResult.antonyms) metadata.antonyms = llmResult.antonyms;
		if (llmResult.level) metadata.level = llmResult.level;

		const meaningsData = Array.isArray(llmResult.meanings) 
			? llmResult.meanings.map((m: any) => ({
					value: m.value,
					partOfSpeech: m.partOfSpeech || null,
					context: m.context || null
			  }))
			: [];

		// Users with a local/custom LLM must not write to the shared vocabulary database.
		// Return a transient (non-persisted) vocab object so the UI still works.
		if (user?.useLocalLlm) {
			const transientVocab = {
				id: existingVocab?.id ?? null,
				languageId,
				lemma: llmResult.lemma,
				partOfSpeech: meaningsData.length > 0 ? meaningsData[0].partOfSpeech : null,
				gender: llmResult.gender && ['MASCULINE', 'FEMININE', 'NEUTER'].includes(llmResult.gender.toUpperCase())
					? llmResult.gender.toUpperCase()
					: null,
				plural: llmResult.plural || null,
				isBeginner: false,
				isAutoGenerated: true,
				metadata: Object.keys(metadata).length > 0 ? metadata : null,
				meanings: meaningsData
			};
			return json({ success: true, data: transientVocab });
		}

		let newVocab;

		if (existingVocab) {
			// update existing vocab with meanings
			newVocab = await prisma.vocabulary.update({
				where: { id: existingVocab.id },
				data: {
					partOfSpeech: meaningsData.length > 0 ? meaningsData[0].partOfSpeech : null,
					gender:
						llmResult.gender &&
						['MASCULINE', 'FEMININE', 'NEUTER'].includes(llmResult.gender.toUpperCase())
							? (llmResult.gender.toUpperCase() as 'MASCULINE' | 'FEMININE' | 'NEUTER')
							: null,
					plural: llmResult.plural || null,
					isAutoGenerated: true,
					metadata: Object.keys(metadata).length > 0 ? (metadata as any) : undefined,
					meanings: {
						create: meaningsData
					}
				},
				include: { meanings: true }
			});
		} else {
			newVocab = await prisma.vocabulary.create({
				data: {
					languageId,
					lemma: llmResult.lemma,
					partOfSpeech: meaningsData.length > 0 ? meaningsData[0].partOfSpeech : null,
					gender:
						llmResult.gender &&
						['MASCULINE', 'FEMININE', 'NEUTER'].includes(llmResult.gender.toUpperCase())
							? (llmResult.gender.toUpperCase() as 'MASCULINE' | 'FEMININE' | 'NEUTER')
							: null,
					plural: llmResult.plural || null,
					isBeginner: false,
					isAutoGenerated: true,
					metadata: Object.keys(metadata).length > 0 ? (metadata as any) : undefined,
					meanings: {
						create: meaningsData
					}
				},
				include: { meanings: true }
			});
		}

		return json({ success: true, data: newVocab });
	} catch (err: unknown) {
		console.error('LLM Dictionary Lookup Error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
