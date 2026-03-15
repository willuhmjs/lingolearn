import { prisma } from '$lib/server/prisma';
import { generateChatCompletion } from '$lib/server/llm';
import { recordTokenUsage } from '$lib/server/aiQuota';
import { stemmer as germanStemmer } from '@orama/stemmers/german';
import { getFrequencyRank, estimateFrequencyRank } from '$lib/frequency/index';

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

/**
 * Static lookup table mapping common German strong/irregular verb ablaut forms
 * to their infinitive lemma. Covers the ~50 most frequent strong verbs across
 * all their principal parts (simple past, past participle, 2nd/3rd person singular).
 *
 * This handles the cases that no suffix-stripping algorithm can solve — forms
 * where the stem vowel changes completely (e.g. fahr→fuhr, geh→ging, seh→sah).
 * Without this table these forms would fall through to the expensive AI enrichment
 * call; with it they resolve locally at zero cost.
 *
 * Keys are lowercased surface forms. Values are the canonical German infinitive
 * as stored in the Vocabulary table.
 */
export const GERMAN_STRONG_VERB_LOOKUP: Record<string, string> = {
	// fahren
	fuhr: 'fahren', fuhren: 'fahren', fuhst: 'fahren',
	// laufen
	lief: 'laufen', liefen: 'laufen', liefst: 'laufen',
	// stehen
	stand: 'stehen', standen: 'stehen', standst: 'stehen',
	// gehen
	ging: 'gehen', gingen: 'gehen', gingst: 'gehen',
	// kommen
	kam: 'kommen', kamen: 'kommen', kamst: 'kommen',
	// sehen
	sah: 'sehen', sahen: 'sehen', sahst: 'sehen',
	// lesen (gelesen caught by ge- stripping, but past tense not)
	las: 'lesen', lasen: 'lesen', lasest: 'lesen',
	// essen
	aß: 'essen', aßen: 'essen', aßt: 'essen',
	ass: 'essen', assen: 'essen', // ASCII alternative for aß
	// trinken
	trank: 'trinken', tranken: 'trinken', trankst: 'trinken',
	// schreiben
	schrieb: 'schreiben', schrieben: 'schreiben', schriebst: 'schreiben',
	// sprechen
	sprach: 'sprechen', sprachen: 'sprechen', sprachst: 'sprechen',
	spricht: 'sprechen',
	// bleiben
	blieb: 'bleiben', blieben: 'bleiben', bliebst: 'bleiben',
	// rufen
	rief: 'rufen', riefen: 'rufen', riefst: 'rufen',
	// finden
	fand: 'finden', fanden: 'finden', fandst: 'finden',
	// geben
	gab: 'geben', gaben: 'geben', gabst: 'geben',
	gibt: 'geben',
	// nehmen
	nahm: 'nehmen', nahmen: 'nehmen', nahmst: 'nehmen',
	nimmt: 'nehmen',
	// wissen
	wusste: 'wissen', wussten: 'wissen', wusstest: 'wissen', weiß: 'wissen', weiss: 'wissen',
	// haben
	hatte: 'haben', hatten: 'haben', hattest: 'haben', hattet: 'haben',
	// sein
	war: 'sein', waren: 'sein', warst: 'sein', wart: 'sein',
	ist: 'sein', bist: 'sein', bin: 'sein', seid: 'sein',
	// werden
	wurde: 'werden', wurden: 'werden', wurdest: 'werden', wurdet: 'werden',
	ward: 'werden',
	// modal verbs (past tense forms)
	wollte: 'wollen', wollten: 'wollen', wolltest: 'wollen',
	musste: 'müssen', mussten: 'müssen', musstest: 'müssen', müssen: 'müssen',
	konnte: 'können', konnten: 'können', konntest: 'können', kann: 'können',
	durfte: 'dürfen', durften: 'dürfen', durftest: 'dürfen', darf: 'dürfen',
	sollte: 'sollen', sollten: 'sollen', solltest: 'sollen',
	mochte: 'mögen', mochten: 'mögen', mochtest: 'mögen', mag: 'mögen',
	// lassen
	ließ: 'lassen', ließen: 'lassen', ließest: 'lassen', liess: 'lassen',
	// halten
	hielt: 'halten', hielten: 'halten', hieltest: 'halten',
	hält: 'halten', haelt: 'halten',
	// fallen
	fiel: 'fallen', fielen: 'fallen', fielst: 'fallen',
	fällt: 'fallen', faellt: 'fallen',
	// schlafen
	schlief: 'schlafen', schliefen: 'schlafen', schliefst: 'schlafen',
	schläft: 'schlafen', schlaeft: 'schlafen',
	// tragen
	trug: 'tragen', trugen: 'tragen', trugst: 'tragen',
	trägt: 'tragen', traegt: 'tragen',
	// wachsen
	wuchs: 'wachsen', wuchsen: 'wachsen', wuchsest: 'wachsen',
	// ziehen
	zog: 'ziehen', zogen: 'ziehen', zogst: 'ziehen',
	// lügen
	log: 'lügen', logen: 'lügen', logst: 'lügen',
	// bitten
	bat: 'bitten', baten: 'bitten', batest: 'bitten',
	// bieten
	bot: 'bieten', boten: 'bieten', botst: 'bieten',
	// fliegen
	flog: 'fliegen', flogen: 'fliegen', flogst: 'fliegen',
	// schwimmen
	schwamm: 'schwimmen', schwammen: 'schwimmen', schwammst: 'schwimmen',
	// werfen
	warf: 'werfen', warfen: 'werfen', warfst: 'werfen',
	wirft: 'werfen',
	// treffen
	traf: 'treffen', trafen: 'treffen', trafst: 'treffen',
	trifft: 'treffen',
	// helfen
	half: 'helfen', halfen: 'helfen', halfst: 'helfen',
	hilft: 'helfen',
	// sterben
	starb: 'sterben', starben: 'sterben', starbst: 'sterben',
	stirbt: 'sterben',
	// werben
	warb: 'werben', warben: 'werben', warbst: 'werben',
	wirbt: 'werben',
	// brechen
	brach: 'brechen', brachen: 'brechen', brachst: 'brechen',
	bricht: 'brechen',
	// schwören
	schwor: 'schwören', schworen: 'schwören',
	// streiten
	stritt: 'streiten', stritten: 'streiten', strittest: 'streiten',
	// reiten
	ritt: 'reiten', ritten: 'reiten', rittest: 'reiten',
	// schneiden
	schnitt: 'schneiden', schnitten: 'schneiden', schnittest: 'schneiden',
	// leiden
	litt: 'leiden', litten: 'leiden', littest: 'leiden',
	// greifen
	griff: 'greifen', griffen: 'greifen', griffst: 'greifen',
	// treiben
	trieb: 'treiben', trieben: 'treiben', triebst: 'treiben',
	// scheinen
	schien: 'scheinen', schienen: 'scheinen', schienst: 'scheinen',
	// steigen
	stieg: 'steigen', stiegen: 'steigen', stiegst: 'steigen',
	// schreien
	schrie: 'schreien', schrien: 'schreien',
	// fließen
	floss: 'fließen', flossen: 'fließen',
	// schießen
	schoss: 'schießen', schossen: 'schießen',
	// genießen
	genoss: 'genießen', genossen: 'genießen',
	// vergessen
	vergaß: 'vergessen', vergaßen: 'vergessen',
	vergass: 'vergessen', vergassen: 'vergessen',
	vergisst: 'vergessen',
	// anfangen
	fing: 'anfangen', fingen: 'anfangen', fingst: 'anfangen',
};

/**
 * Restore common Snowball ASCII normalisations back to German umlaut forms.
 * Snowball converts ä→a, ö→o, ü→u, ß→ss internally before stemming.
 * The DB stores lemmas with proper umlauts (e.g. "Übung", "schön", "groß"),
 * so we generate umlaut-restored variants of the ASCII stem as additional
 * candidates. This is additive — we keep the ASCII stem AND add restored forms.
 *
 * We apply all four substitutions independently and return all combinations
 * up to two simultaneous substitutions (words with three umlauts are rare
 * enough that a combinatorial explosion isn't worth guarding against here —
 * the Set deduplicates and the DB query uses an IN clause).
 */
function restoreUmlauts(stem: string): string[] {
	const variants = new Set<string>([stem]);

	const subs: [RegExp, string][] = [
		[/ss/g, 'ß'],
		[/ae/g, 'ä'],
		[/oe/g, 'ö'],
		[/ue/g, 'ü'],
	];

	// Single substitutions
	for (const [pattern, replacement] of subs) {
		if (pattern.test(stem)) {
			variants.add(stem.replace(pattern, replacement));
		}
	}

	return [...variants];
}

/**
 * Generates candidate lemma forms for a surface word to use in DB lookups.
 * Uses the Snowball stemmer from @orama/stemmers for German (same algorithm as
 * Elasticsearch/Lucene), with manual additions for:
 *   - umlaut restoration (Snowball normalises ä/ö/ü/ß internally)
 *   - capitalised variants (DB stores German nouns capitalised)
 *   - zu-infinitives and past-participle ge- prefix stripping
 * French and Spanish use lightweight suffix rules (unchanged from before).
 */
export function stemWord(word: string, language: string): Set<string> {
	const candidates = new Set<string>();
	const lower = word.toLowerCase();
	const capitalised = lower.charAt(0).toUpperCase() + lower.slice(1);
	candidates.add(lower);
	candidates.add(capitalised);

	const addBoth = (s: string) => {
		if (!s) return;
		candidates.add(s);
		candidates.add(s.charAt(0).toUpperCase() + s.slice(1));
		// Also add umlaut-restored variants so Snowball's ASCII normalisation
		// doesn't prevent matching DB lemmas stored with ß/ä/ö/ü
		for (const restored of restoreUmlauts(s)) {
			candidates.add(restored);
			candidates.add(restored.charAt(0).toUpperCase() + restored.slice(1));
		}
	};

	if (language === 'German') {
		// Strong/irregular verb lookup — resolves ablaut forms that no suffix
		// algorithm can handle (e.g. fuhr→fahren, ging→gehen, war→sein).
		const strongLemma = GERMAN_STRONG_VERB_LOOKUP[lower];
		if (strongLemma) addBoth(strongLemma);

		// Snowball Stemmer — handles inflectional suffixes and derivations
		const stem = germanStemmer(lower);
		addBoth(stem);
		// Verb infinitive reconstruction (most German infinitives end in -en)
		if (!stem.endsWith('en')) addBoth(stem + 'en');

		// Also apply short-suffix stripping for forms Snowball leaves unreduced:
		// verb conjugations (geht→geh, spielt→spiel) and noun -s plurals (Autos→Auto)
		// and adjective -em dative (schönem→schön).
		const shortSuffixes = ['en', 'em', 'st', 't', 'e', 's'];
		for (const suffix of shortSuffixes) {
			if (lower.length >= suffix.length + 3 && lower.endsWith(suffix)) {
				const stripped = lower.slice(0, -suffix.length);
				addBoth(stripped);
				addBoth(stripped + 'en');
			}
		}

		// zu-infinitive: aufzugeben → aufgeben
		const zuMatch = lower.match(/^(.{2,})zu(.{2,})$/);
		if (zuMatch) addBoth(zuMatch[1] + zuMatch[2]);

		// Past participle: ge-…-t / ge-…-en → strip prefix
		if (lower.startsWith('ge') && lower.length > 4) {
			const rest = lower.slice(2);
			addBoth(rest);
			if (rest.endsWith('t')) addBoth(rest.slice(0, -1) + 'en');
		}
	} else if (language === 'French') {
		const suffixes = ['es', 's', 'ent', 'ons', 'ez', 'ais', 'ait', 'ions', 'iez', 'aient', 'er', 'ir', 're', 'ée', 'ées', 'és'];
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
		const suffixes = ['as', 'a', 'amos', 'áis', 'an', 'es', 'e', 'emos', 'éis', 'en', 'is', 'imos', 'ís', 'aba', 'abas', 'ábamos', 'abais', 'aban', 'ía', 'ías', 'íamos', 'íais', 'ían', 'ar', 'er', 'ir', 'ado', 'ido', 'ados', 'idos', 'ada', 'ida', 'adas', 'idas', 's', 'es'];
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

/**
 * Upsert a single AI-discovered vocab entry into the DB.
 * Returns the resulting Vocabulary record, or null if skipped.
 */
async function upsertAiVocabEntry(
	v: { lemma?: string; meaning?: string; partOfSpeech?: string; gender?: string | null; plural?: string | null },
	activeLangName: string,
	activeLanguageId: string,
	skipDbWrite: boolean,
	fallbackPartOfSpeech = 'other'
) {
	const cleanLemma = v.lemma?.replace(/^[.,!?;:'"()[\]{}-]+|[.,!?;:'"()[\]{}-]+$/g, '') || '';
	if (!cleanLemma) return null;

	// German nouns must be capitalised; if the LLM lowercased it, demote POS to avoid bad data.
	if (
		activeLangName === 'German' &&
		cleanLemma.charAt(0) === cleanLemma.charAt(0).toLowerCase() &&
		v.partOfSpeech === 'noun'
	) {
		v.partOfSpeech = 'other';
	}

	const existing = await prisma.vocabulary.findFirst({
		where: { lemma: { equals: cleanLemma, mode: 'insensitive' }, languageId: activeLanguageId },
		include: { meanings: true }
	});

	if (existing) {
		if (!skipDbWrite && existing.meanings.length === 0 && v.meaning) {
			return prisma.vocabulary.update({
				where: { id: existing.id },
				data: {
					meanings: { create: [{ value: v.meaning, partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech }] },
					partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech
				},
				include: { meanings: true }
			});
		}
		return existing;
	}

	if (!skipDbWrite) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const gender = (v.gender ?? null) as any;
		const frequency =
			getFrequencyRank(cleanLemma, activeLangName) ??
			estimateFrequencyRank(cleanLemma);
		return prisma.vocabulary.create({
			data: {
				lemma: cleanLemma,
				meanings: { create: [{ value: v.meaning ?? '', partOfSpeech: v.partOfSpeech ?? fallbackPartOfSpeech }] },
				partOfSpeech: v.partOfSpeech ?? fallbackPartOfSpeech,
				gender,
				plural: v.plural ?? null,
				languageId: activeLanguageId,
				isAutoGenerated: true,
				frequency
			},
			include: { meanings: true }
		});
	}

	return null;
}

export async function processVocabEnrichment(
	userId: string,
	targetLanguageText: string,
	activeLangName: string,
	activeLanguageId: string,
	masteredVocab: any[],
	learningVocab: any[],
	enqueue: (data: any) => void,
	skipDbWrite = false,
	chargeQuota = true
) {
	try {
		const rawWords = targetLanguageText
			.replace(/<[^>]+>/g, '')
			.split(/\s+/)
			.map((w) => w.replace(/[.,!?;:'"|()/[\]{}\-\u2014\u2013]/g, '').trim())
			.filter((w) => w.length > 0);

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
					lemma: { in: Array.from(candidates) }
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
							w.length >= 2 &&
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
			// Signal start of AI lookup
			enqueue({ type: 'vocab_enrichment', data: [], status: 'searching' });

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
										content: `Provide vocabulary dictionary entries for these ${activeLangName} words or inflected forms: ${JSON.stringify(unknownContentWords)}\n\nRespond with JSON in this exact shape:\n{"vocabulary":[{"lemma":"... (in ${activeLangName})","meaning":"... (in English)","partOfSpeech":"noun|verb|adjective|adverb|preposition|conjunction|pronoun|article|particle|interjection|other","gender":"MASCULINE|FEMININE|NEUTER or null for non-nouns","plural":"plural form or null"}]}`
									}
								],
								systemPrompt: `You are an expert ${activeLangName} lexicographer. For each word given (which may be an inflected form), output its base-form (lemma) dictionary entry in ${activeLangName} with an English meaning. Output ONLY valid JSON matching the requested schema, no markdown or extra text.`,
								jsonMode: true,
								temperature: 0.1,
								// Good-will: these calls create/enrich shared vocabulary in the DB
								onUsage: chargeQuota ? ({ totalTokens }) => {
									recordTokenUsage(userId, totalTokens, true);
								} : undefined
							});
							let aiResultRaw: string;
							if (typeof aiRes.choices?.[0]?.message?.content === 'string') {
								aiResultRaw = aiRes.choices[0].message.content;
							} else {
								aiResultRaw = JSON.stringify(aiRes);
							}
							const aiResult = JSON.parse(aiResultRaw);
							if (aiResult?.vocabulary?.length > 0) {
								// Process all entries in parallel — no sequential awaits.
								const aiVocabEntries = (await Promise.all(
									aiResult.vocabulary.map((v: any) =>
										upsertAiVocabEntry(v, activeLangName, activeLanguageId, skipDbWrite, 'other')
									)
								)).filter(Boolean);
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
										content: `Sentence: "${fullSentence}"\nWords to explain: ${JSON.stringify(ambiguousInSentence)}\n\nRespond with JSON in this exact shape:\n{"vocabulary":[{"lemma":"the word as it appears (in ${activeLangName})","meaning":"precise contextual English meaning/role in this sentence","partOfSpeech":"verb|pronoun|particle|other"}]}`
									}
								],
								systemPrompt: `You are an expert ${activeLangName} lexicographer. For each word given, provide a generic, dictionary-style definition and its grammatical role. DO NOT provide a definition that is tied to a specific context or sentence. Output ONLY valid JSON, no markdown.`,
								jsonMode: true,
								temperature: 0.1,
								// Good-will: these calls create/enrich shared vocabulary in the DB
								onUsage: chargeQuota ? ({ totalTokens }) => {
									recordTokenUsage(userId, totalTokens, true);
								} : undefined
							});
							let ctxRaw: string;
							if (typeof ctxRes.choices?.[0]?.message?.content === 'string') {
								ctxRaw = ctxRes.choices[0].message.content;
							} else {
								ctxRaw = JSON.stringify(ctxRes);
							}
							const ctxResult = JSON.parse(ctxRaw);
							if (ctxResult?.vocabulary?.length > 0) {
								// Process all entries in parallel — no sequential awaits.
								const ctxEntries = (await Promise.all(
									ctxResult.vocabulary.map((v: any) =>
										upsertAiVocabEntry(v, activeLangName, activeLanguageId, skipDbWrite, 'pronoun')
									)
								)).filter(Boolean);
								enqueue({ type: 'vocab_enrichment', data: ctxEntries });
							}
						} catch (ctxErr) {
							console.error('Contextual word AI lookup failed:', ctxErr);
						}
					})()
				);
			}

			// Await all AI tasks so the stream stays open and tooltips show "AI analyzing"
			await Promise.allSettled(aiTasks);
		}
	} catch (err) {
		console.error('Vocab enrichment setup failed', err);
	}
}
