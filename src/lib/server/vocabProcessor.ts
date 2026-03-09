import { prisma } from '$lib/server/prisma';
import { generateChatCompletion } from '$lib/server/llm';

export const AMBIGUOUS_WORDS_BY_LANG: Record<string, string[]> = {
	German: [
		'er',
		'sie',
		'es',
		'wir',
		'ihr', // personal pronouns (she/they/formal-you ambiguity)
		'man',
		'sich', // impersonal / reflexive
		'ihn',
		'ihm',
		'ihnen', // accusative/dative pronoun forms
		'jemand',
		'niemand',
		'etwas',
		'nichts' // indefinite pronouns
	],
	Spanish: [
		// Conjugated forms of ser / estar / tener / ir / haber — contextually ambiguous
		'es',
		'está',
		'son',
		'están',
		'era',
		'fue',
		'sido',
		'siendo',
		'hay',
		'hubo',
		'había', // haber impersonal
		'va',
		'van',
		'voy',
		'vamos', // ir conjugations
		'tiene',
		'tienen',
		'tengo', // tener
		// Object / reflexive / indirect-object pronouns
		'se',
		'le',
		'les',
		'lo',
		'la',
		'los',
		'las', // clitic pronouns
		'me',
		'te',
		'nos',
		'os' // other clitics
	]
};

export const FUNCTION_WORDS = new Set([
	// German articles & determiners
	'der',
	'die',
	'das',
	'den',
	'dem',
	'des',
	'ein',
	'eine',
	'einen',
	'einem',
	'einer',
	'eines',
	'kein',
	'keine',
	'keinen',
	'keinem',
	'keiner',
	'keines',
	// German pronouns & common particles
	'ich',
	'du',
	'er',
	'sie',
	'es',
	'wir',
	'ihr',
	'sie',
	'sie',
	'sich',
	'mich',
	'dich',
	'ihn',
	'uns',
	'euch',
	'ihnen',
	'mir',
	'dir',
	'ihm',
	'ihr',
	'uns',
	'euch',
	'ihnen',
	'mein',
	'dein',
	'sein',
	'unser',
	'euer',
	'ihr',
	// German conjunctions / particles
	'und',
	'oder',
	'aber',
	'doch',
	'denn',
	'weil',
	'dass',
	'wenn',
	'ob',
	'als',
	'wie',
	'nicht',
	'auch',
	'noch',
	'schon',
	'nur',
	'sehr',
	'so',
	'ja',
	'nein',
	'gar',
	// German prepositions (contracted forms already in inflection map)
	'in',
	'an',
	'auf',
	'für',
	'mit',
	'von',
	'zu',
	'bei',
	'nach',
	'aus',
	'über',
	'unter',
	'vor',
	'hinter',
	'neben',
	'zwischen',
	'durch',
	'um',
	'gegen',
	'ohne',
	'bis',
	'am',
	'im',
	'ins',
	'zum',
	'zur',
	'vom',
	'beim',
	'ans',
	'aufs',
	'fürs',
	// French articles
	'le',
	'la',
	'les',
	"l'",
	'un',
	'une',
	'des',
	// French pronouns
	'je',
	'tu',
	'il',
	'elle',
	'on',
	'nous',
	'vous',
	'ils',
	'elles',
	'me',
	'te',
	'se',
	'lui',
	'leur',
	'y',
	'en',
	// French prepositions/conjunctions
	'à',
	'de',
	'dans',
	'sur',
	'sous',
	'avec',
	'pour',
	'sans',
	'par',
	'vers',
	'et',
	'ou',
	'mais',
	'donc',
	'car',
	'ni',
	'que',
	'qui',
	'quoi',
	'dont',
	'où',
	'ne',
	'pas',
	'plus',
	'jamais',
	'très',
	'trop',
	'bien',
	'mal',
	// English function words
	'a',
	'an',
	'the',
	'of',
	'in',
	'is',
	'it',
	'to',
	'he',
	'she',
	'we',
	'they',
	'i',
	'you',
	'this',
	'that',
	'and',
	'or',
	'but',
	'at',
	'as',
	'be',
	'by',
	'do',
	'for',
	'if',
	'me',
	'my',
	'no',
	'not',
	'on',
	'up',
	'us',
	'was',
	'are',
	'has',
	'had',
	'his',
	'her',
	'its'
]);

export function stemWord(word: string, language: string): Set<string> {
	const candidates = new Set<string>();
	const lower = word.toLowerCase();
	candidates.add(lower);
	candidates.add(lower.charAt(0).toUpperCase() + lower.slice(1));

	if (language === 'German') {
		// Basic German stemming: strip inflectional suffixes
		const suffixes = [
			'ung',
			'te',
			'ten',
			'tet',
			'test',
			'en',
			'er',
			'es',
			'em',
			'et',
			'st',
			'e',
			't',
			'n',
			's'
		];
		for (const suffix of suffixes) {
			if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
				const stem = lower.slice(0, -suffix.length);
				candidates.add(stem);
				candidates.add(stem.charAt(0).toUpperCase() + stem.slice(1));
				if (suffix !== 'en') {
					candidates.add(stem + 'en');
					candidates.add((stem + 'en').charAt(0).toUpperCase() + (stem + 'en').slice(1));
				}
			}
		}

		// Past participle: ge-...-t or ge-...-en
		if (lower.startsWith('ge') && lower.length > 4) {
			const rest = lower.slice(2);
			candidates.add(rest);
			candidates.add(rest.charAt(0).toUpperCase() + rest.slice(1));
			if (rest.endsWith('t') && rest.length > 2) {
				const pStem = rest.slice(0, -1);
				candidates.add(pStem + 'en');
				candidates.add((pStem + 'en').charAt(0).toUpperCase() + (pStem + 'en').slice(1));
			}
			if (rest.endsWith('en') && rest.length > 3) {
				candidates.add(rest);
				candidates.add(rest.charAt(0).toUpperCase() + rest.slice(1));
			}
		}

		// zu-infinitive: aufzugeben → aufgeben
		const zuMatch = lower.match(/^(.+?)zu(.+)$/);
		if (zuMatch && zuMatch[1].length >= 2 && zuMatch[2].length >= 2) {
			const combined = zuMatch[1] + zuMatch[2];
			candidates.add(combined);
			candidates.add(combined.charAt(0).toUpperCase() + combined.slice(1));
		}
	} else if (language === 'French') {
		// Basic French stemming
		const suffixes = [
			'es',
			's',
			'ent',
			'ons',
			'ez',
			'ais',
			'ait',
			'ions',
			'iez',
			'aient',
			'er',
			'ir',
			're',
			'ée',
			'ées',
			'és'
		];
		for (const suffix of suffixes) {
			if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
				const stem = lower.slice(0, -suffix.length);
				candidates.add(stem);
				candidates.add(stem + 'er');
				candidates.add(stem + 'ir');
				candidates.add(stem + 're');
			}
		}
	} else if (language === 'Spanish') {
		// Basic Spanish stemming
		const suffixes = [
			'as',
			'a',
			'amos',
			'áis',
			'an',
			'es',
			'e',
			'emos',
			'éis',
			'en',
			'is',
			'imos',
			'ís',
			'aba',
			'abas',
			'ábamos',
			'abais',
			'aban',
			'ía',
			'ías',
			'íamos',
			'íais',
			'ían',
			'ar',
			'er',
			'ir',
			'ado',
			'ido',
			'ados',
			'idos',
			'ada',
			'ida',
			'adas',
			'idas',
			's',
			'es'
		];
		for (const suffix of suffixes) {
			if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
				const stem = lower.slice(0, -suffix.length);
				candidates.add(stem);
				candidates.add(stem + 'ar');
				candidates.add(stem + 'er');
				candidates.add(stem + 'ir');
			}
		}
	}

	return candidates;
}

export async function processVocabEnrichment(
	userId: string,
	targetLanguageText: string,
	activeLangName: string,
	activeLanguageId: string,
	masteredVocab: any[],
	learningVocab: any[],
	enqueue: (data: any) => void
) {
	try {
		const rawWords = targetLanguageText
			.replace(/<[^>]+>/g, '')
			.split(/\s+/)
			.map((w) => w.replace(/[.,!?;:'"|()/[\]{}\-\u2014\u2013]/g, '').trim())
			.filter((w) => w.length > 0);

		const existingIds = new Set([...masteredVocab, ...learningVocab].map((v) => v.id));

		const candidates = new Set<string>();
		for (const word of rawWords) {
			const stems = stemWord(word, activeLangName);
			for (const stem of stems) {
				candidates.add(stem);
			}
		}

		let enrichmentVocab: any[] = [];
		if (candidates.size > 0) {
			enrichmentVocab = await prisma.vocabulary.findMany({
				where: {
					languageId: activeLanguageId,
					lemma: { in: Array.from(candidates) },
					id: { notIn: Array.from(existingIds) }
				},
				include: { meanings: true }
			});

			if (enrichmentVocab.length > 0) {
				enqueue({
					type: 'vocab_enrichment',
					data: enrichmentVocab
				});
			}
		}

		const foundLemmas = new Set<string>([
			...masteredVocab.map((v) => v.lemma.toLowerCase()),
			...learningVocab.map((v) => v.lemma.toLowerCase()),
			...enrichmentVocab.map((v: any) => v.lemma.toLowerCase())
		]);

		const unknownContentWords = [
			...new Set(
				rawWords
					.filter(
						(w) =>
							w.length >= 3 &&
							!FUNCTION_WORDS.has(w.toLowerCase()) &&
							!foundLemmas.has(w.toLowerCase())
					)
			)
		].slice(0, 20);

		const ambiguousForLang = AMBIGUOUS_WORDS_BY_LANG[activeLangName] ?? [];
		const ambiguousSet = new Set(ambiguousForLang);
		const sentenceWordsLower = rawWords
			.map((w) => w.replace(/[.,!?;:'"|()/[\]{}\-\u2014\u2013¡¿]/g, '').toLowerCase())
			.filter(Boolean);
		const ambiguousInSentence =
			ambiguousForLang.length > 0
				? [...new Set(sentenceWordsLower.filter((w) => ambiguousSet.has(w)))]
				: [];
		const fullSentence = targetLanguageText.replace(/<[^>]+>/g, '').trim();

		if (unknownContentWords.length > 0 || ambiguousInSentence.length > 0) {
			const aiTasks: Promise<void>[] = [];

			if (unknownContentWords.length > 0) {
				aiTasks.push(
					(async () => {
						try {
							const aiRes = await generateChatCompletion({
								userId,
								messages: [
									{
										role: 'user',
										content: `Provide vocabulary dictionary entries for these ${activeLangName} words or inflected forms: ${JSON.stringify(unknownContentWords)}\n\nRespond with JSON in this exact shape:\n{"vocabulary":[{"lemma":"...","meaning":"...","partOfSpeech":"noun|verb|adjective|adverb|preposition|conjunction|pronoun|article|particle|interjection|other","gender":"MASCULINE|FEMININE|NEUTER or null for non-nouns","plural":"plural form or null"}]}`
									}
								],
								systemPrompt: `You are an expert ${activeLangName} lexicographer. For each word given (which may be an inflected form), output its base-form (lemma) dictionary entry with an English meaning. Output ONLY valid JSON matching the requested schema, no markdown or extra text.`,
								jsonMode: true,
								temperature: 0.1
							});
							let aiResultRaw: string;
							if (typeof aiRes.choices?.[0]?.message?.content === 'string') {
								aiResultRaw = aiRes.choices[0].message.content;
							} else {
								aiResultRaw = JSON.stringify(aiRes);
							}
							const aiResult = JSON.parse(aiResultRaw);
							if (aiResult?.vocabulary?.length > 0) {
								const aiVocabEntries = [];
								for (const v of aiResult.vocabulary) {
									const cleanLemma =
										v.lemma?.replace(/^[.,!?;:'"()[\\]{}-]+|[.,!?;:'"()[\\]{}-]+$/g, '') || '';

									if (
										activeLangName === 'German' &&
										cleanLemma &&
										cleanLemma.charAt(0) === cleanLemma.charAt(0).toLowerCase() &&
										v.partOfSpeech === 'noun'
									) {
										v.partOfSpeech = 'other';
									}

									const existing = await prisma.vocabulary.findFirst({
										where: {
											lemma: { equals: cleanLemma, mode: 'insensitive' },
											languageId: activeLanguageId
										},
										include: { meanings: true }
									});
									if (existing) {
										if (existing.meanings.length === 0 && v.meaning) {
											aiVocabEntries.push(
												await prisma.vocabulary.update({
													where: { id: existing.id },
													data: {
														meanings: {
															create: [{ value: v.meaning, partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech }]
														},
														partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech
													},
													include: { meanings: true }
												})
											);
										} else {
											aiVocabEntries.push(existing);
										}
									} else {
										aiVocabEntries.push(
											await prisma.vocabulary.create({
												data: {
													lemma: cleanLemma,
													meanings: { create: [{ value: v.meaning, partOfSpeech: v.partOfSpeech }] },
													partOfSpeech: v.partOfSpeech,
													gender: v.gender ?? null,
													plural: v.plural ?? null,
													languageId: activeLanguageId,
													isAutoGenerated: true
												},
												include: { meanings: true }
											})
										);
									}
								}
								enqueue({ type: 'vocab_enrichment', data: aiVocabEntries });
							}
						} catch (aiFallbackErr) {
							console.error('AI vocab fallback failed:', aiFallbackErr);
						}
					})()
				);
			}

			if (ambiguousInSentence.length > 0 && fullSentence) {
				aiTasks.push(
					(async () => {
						try {
							const ctxRes = await generateChatCompletion({
								userId,
								messages: [
									{
										role: 'user',
										content: `Sentence: "${fullSentence}"\nWords to explain: ${JSON.stringify(ambiguousInSentence)}\n\nRespond with JSON in this exact shape:\n{"vocabulary":[{"lemma":"the word as it appears","meaning":"precise contextual meaning/role in this sentence","partOfSpeech":"verb|pronoun|particle|other"}]}`
									}
								],
								systemPrompt: `You are an expert ${activeLangName} lexicographer. For each word given, provide a generic, dictionary-style definition and its grammatical role. DO NOT provide a definition that is tied to a specific context or sentence. Output ONLY valid JSON, no markdown.`,
								jsonMode: true,
								temperature: 0.1
							});
							let ctxRaw: string;
							if (typeof ctxRes.choices?.[0]?.message?.content === 'string') {
								ctxRaw = ctxRes.choices[0].message.content;
							} else {
								ctxRaw = JSON.stringify(ctxRes);
							}
							const ctxResult = JSON.parse(ctxRaw);
							if (ctxResult?.vocabulary?.length > 0) {
								const ctxEntries = [];
								for (const v of ctxResult.vocabulary) {
									const cleanLemma =
										v.lemma?.replace(/^[.,!?;:'"()[\\]{}-]+|[.,!?;:'"()[\\]{}-]+$/g, '') || '';

									if (
										activeLangName === 'German' &&
										cleanLemma &&
										cleanLemma.charAt(0) === cleanLemma.charAt(0).toLowerCase() &&
										v.partOfSpeech === 'noun'
									) {
										v.partOfSpeech = 'other';
									}

									const existing = await prisma.vocabulary.findFirst({
										where: {
											lemma: { equals: cleanLemma, mode: 'insensitive' },
											languageId: activeLanguageId
										},
										include: { meanings: true }
									});
									if (existing) {
										if (existing.meanings.length === 0 && v.meaning) {
											ctxEntries.push(
												await prisma.vocabulary.update({
													where: { id: existing.id },
													data: {
														meanings: {
															create: [{ value: v.meaning, partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech }]
														},
														partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech
													},
													include: { meanings: true }
												})
											);
										} else {
											ctxEntries.push(existing);
										}
									} else {
										ctxEntries.push(
											await prisma.vocabulary.create({
												data: {
													lemma: cleanLemma,
													meanings: { create: [{ value: v.meaning, partOfSpeech: v.partOfSpeech ?? 'pronoun' }] },
													partOfSpeech: v.partOfSpeech ?? 'pronoun',
													gender: null,
													plural: null,
													languageId: activeLanguageId,
													isAutoGenerated: true
												},
												include: { meanings: true }
											})
										);
									}
								}
								enqueue({ type: 'vocab_enrichment', data: ctxEntries });
							}
						} catch (ctxErr) {
							console.error('Contextual word AI lookup failed:', ctxErr);
						}
					})()
				);
			}

			// Don't await them sequentially so we don't block the API response
			Promise.allSettled(aiTasks).catch((e) => console.error("Vocab enrichment error", e));
		}
	} catch (err) {
		console.error('Vocab enrichment setup failed', err);
	}
}