import { json, type RequestEvent } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { llmDictionaryRateLimiter } from '$lib/server/ratelimit';
import { generateChatCompletion } from '$lib/server/llm';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';
import { getLanguageConfig } from '$lib/languages';

// Module-level dedup map: "languageId:wordLower" → in-flight LLM promise.
// Any concurrent request for the same word joins the existing promise instead of
// spawning a second LLM call. Resolves to the JSON-serialisable payload so the
// Response object (single-use) doesn't need to be shared.
const inflightLookups = new Map<
	string,
	Promise<{ success: boolean; data?: unknown; error?: string }>
>();

export async function POST(event: RequestEvent) {
	const { request, locals } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { useLocalLlm: true }
	});

	// Apply Rate Limiting
	if (!user?.useLocalLlm && (await llmDictionaryRateLimiter.isLimited(event))) {
		return json({ error: 'Too many requests' }, { status: 429 });
	}

	if (!user?.useLocalLlm && (await isQuotaExceeded(userId, false))) {
		return json({ error: 'Daily AI quota exceeded. Please try again tomorrow.' }, { status: 429 });
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

		const useLocalLlm = user?.useLocalLlm ?? false;

		// Dedup key: same word + language → same LLM call. Local LLM users are excluded
		// because they never write to the shared DB and each user may have their own model.
		const dedupKey = `${languageId}:${word.toLowerCase()}`;

		if (!useLocalLlm && inflightLookups.has(dedupKey)) {
			// Another request is already enriching this word — wait for it and return its result.
			const payload = await inflightLookups.get(dedupKey)!;
			return json(payload, { status: payload.success ? 200 : 400 });
		}

		// Wrap the LLM + DB work in a promise and register it before awaiting,
		// so any concurrent request that arrives while we're mid-flight joins it.
		const workPromise = (async (): Promise<{
			success: boolean;
			data?: unknown;
			error?: string;
		}> => {
			// Prepare LLM Call
			const systemPrompt = `You are an expert linguist and dictionary assistant for the ${language.name} language.
The user will provide a word or short phrase they searched for. The input may be in ${language.name} or in English.

Your task is to determine the correct ${language.name} translation or dictionary entry.
If the input is an English word or phrase (like "Apple Juice"), you must accurately translate it into ${language.name}.
However, you MUST be extremely strict about safety: only allow inputs that are "classroom safe" (e.g., everyday vocabulary, academic, or polite words). If the input is slang, inappropriate, or unsafe for a school environment, reject it.
If the input is already in ${language.name}, verify it is a real, valid word or common phrase in ${language.name}.

${
	getLanguageConfig(language.name).capitalizeNouns
		? `CRITICAL: Nouns in ${language.name} are always capitalized. If the lemma starts with a lowercase letter, it MUST NOT be classified as a "noun". Also return the word with its correct native characters (e.g. umlauts/diacritics) rather than ASCII substitutes.`
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
  "conjugations": { "present": { "1sg": "...", "2sg": "...", "3sg": "...", "1pl": "...", "2pl": "...", "3pl": "..." }, "past": { "1sg": "...", "2sg": "...", "3sg": "...", "1pl": "...", "2pl": "...", "3pl": "..." }, "future": { "1sg": "...", "2sg": "...", "3sg": "...", "1pl": "...", "2pl": "...", "3pl": "..." } } | null,
  "declensions": { "nominative": "...", "accusative": "...", "dative": "...", "genitive": "..." } | null,
  "example": "A simple example sentence using the word in ${language.name}",
  "exampleTranslation": "English translation of the example sentence",
  "synonyms": ["synonym1", "synonym2"] | [],
  "antonyms": ["antonym1", "antonym2"] | [],
  "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null
}`;

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

			let tokensUsed = 0;
			const response = await generateChatCompletion({
				userId: userId,
				messages: [{ role: 'user', content: word }],
				systemPrompt,
				jsonMode: true,
				temperature: 0.1,
				signal: controller.signal,
				onUsage: useLocalLlm
					? undefined
					: ({ totalTokens }) => {
							tokensUsed = totalTokens;
						}
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
				return { success: false, error: 'Invalid response from language model' };
			}

			if (!llmResult.valid) {
				// Charged: LLM determined word is invalid/inappropriate — no DB benefit
				if (!useLocalLlm) recordTokenUsage(userId, tokensUsed, false);
				return { success: false, error: 'The word you entered could not be found or is invalid.' };
			}

			// Validate required fields for valid result
			if (!llmResult.lemma) {
				// Charged: LLM call produced no usable output
				if (!useLocalLlm) recordTokenUsage(userId, tokensUsed, false);
				return { success: false, error: 'The word you entered could not be found or is invalid.' };
			}

			// Check if it already exists in the database
			const existingVocab = existingId
				? await prisma.vocabulary.findUnique({
						where: { id: existingId },
						include: { meanings: true }
					})
				: await prisma.vocabulary.findFirst({
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
				const isNoun = existingVocab.partOfSpeech === 'noun';
				const missingGender =
					isNoun && getLanguageConfig(language.name).hasGender && !existingVocab.gender;
				const meta = existingVocab.metadata as Record<string, unknown> | null;
				const isSparse =
					missingGender || !meta || !(meta.example || meta.declensions || meta.conjugations);
				if (!isSparse) {
					// Charged: LLM was called but the word already existed — no new DB benefit
					if (!useLocalLlm) recordTokenUsage(userId, tokensUsed, false);
					return { success: true, data: existingVocab };
				}
				// Sparse — fall through to enrich with LLM data below (will be good-will)
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
			// No token recording — local LLM users are not on the public quota.
			if (useLocalLlm) {
				const transientVocab = {
					id: existingVocab?.id ?? null,
					languageId,
					lemma: llmResult.lemma,
					partOfSpeech: meaningsData.length > 0 ? meaningsData[0].partOfSpeech : null,
					gender:
						llmResult.gender &&
						['MASCULINE', 'FEMININE', 'NEUTER'].includes(llmResult.gender.toUpperCase())
							? llmResult.gender.toUpperCase()
							: null,
					plural: llmResult.plural || null,
					isBeginner: false,
					isAutoGenerated: true,
					metadata: Object.keys(metadata).length > 0 ? metadata : null,
					meanings: meaningsData
				};
				return { success: true, data: transientVocab };
			}

			// Good-will: this call will write to (or enrich) the shared DB
			recordTokenUsage(userId, tokensUsed, true);

			let newVocab;

			if (existingVocab) {
				// Enriching an existing word — auto-approve it (no admin review needed).
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
						isAutoGenerated: false,
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

			return { success: true, data: newVocab };
		})();

		if (!useLocalLlm) {
			inflightLookups.set(dedupKey, workPromise);
			workPromise.finally(() => inflightLookups.delete(dedupKey));
		}

		const payload = await workPromise;
		return json(payload, { status: payload.success ? 200 : 400 });
	} catch (err: unknown) {
		console.error('LLM Dictionary Lookup Error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
