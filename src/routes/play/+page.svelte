<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { toast } from '@zerodevx/svelte-toast';
	import type { PageData } from './$types';

	export let data: PageData;

	type GameMode = 'en-to-de' | 'de-to-en' | 'fill-blank' | 'multiple-choice';

	let englishFlag = '🇬🇧';

	onMount(async () => {
		try {
			if ('keyboard' in navigator && typeof (navigator as any).keyboard?.getLayoutMap === 'function') {
				const layoutMap = await (navigator as any).keyboard.getLayoutMap();
				// Keyboard Layout Map doesn't directly expose locale, but we can check navigator.language as primary signal
			}
		} catch {}
		// Fall back to navigator.language / navigator.languages
		const langs = [...(navigator.languages || []), navigator.language].map(l => l.toLowerCase());
		if (langs.some(l => l === 'en-us' || l.startsWith('en-us'))) {
			englishFlag = '🇺🇸';
		}
	});

	let challenge: any = null;
	let loading = false;
	let isStreaming = false;
	let userInput = '';
	let feedback: any = null;
	let submitting = false;
	let showEnglishFeedback = false;
	let gameMode: GameMode = data.cefrLevel === 'A1' ? 'multiple-choice' : 'en-to-de';
	let fillBlankAnswers: string[] = [];
	let selectedChoice: string | null = null;
	let shuffledChoices: string[] = [];
	let hasSubmittedMc = false;

	// User level tracking (populated from page data and updated from lesson metadata)
	let userLevel = data.cefrLevel || 'A1';
	let isAbsoluteBeginner = data.cefrLevel === 'A1';

	// AbortControllers for in-flight API requests
	let generateController: AbortController | null = null;
	let submitController: AbortController | null = null;

	function cancelAllRequests() {
		if (generateController) {
			generateController.abort();
			generateController = null;
		}
		if (submitController) {
			submitController.abort();
			submitController = null;
		}
	}

	onDestroy(() => {
		cancelAllRequests();
	});

	// Map of common German inflected/contracted forms → { lemma, note }
	// This enables tooltips on conjugated verbs, contractions, etc.
	const GERMAN_INFLECTION_MAP: Record<string, { lemma: string; note: string }> = {
		// sein (to be) conjugations
		'bin': { lemma: 'sein', note: 'ich bin (I am)' },
		'bist': { lemma: 'sein', note: 'du bist (you are)' },
		'ist': { lemma: 'sein', note: 'er/sie/es ist (he/she/it is)' },
		'sind': { lemma: 'sein', note: 'wir/sie/Sie sind (we/they are)' },
		'seid': { lemma: 'sein', note: 'ihr seid (you all are)' },
		'war': { lemma: 'sein', note: 'ich/er war (I/he was)' },
		'warst': { lemma: 'sein', note: 'du warst (you were)' },
		'waren': { lemma: 'sein', note: 'wir/sie waren (we/they were)' },
		'wart': { lemma: 'sein', note: 'ihr wart (you all were)' },
		'gewesen': { lemma: 'sein', note: 'past participle of sein' },
		// haben (to have) conjugations
		'habe': { lemma: 'haben', note: 'ich habe (I have)' },
		'hast': { lemma: 'haben', note: 'du hast (you have)' },
		'hat': { lemma: 'haben', note: 'er/sie/es hat (he/she/it has)' },
		'habt': { lemma: 'haben', note: 'ihr habt (you all have)' },
		'hatte': { lemma: 'haben', note: 'ich/er hatte (I/he had)' },
		'hattest': { lemma: 'haben', note: 'du hattest (you had)' },
		'hatten': { lemma: 'haben', note: 'wir/sie hatten (we/they had)' },
		'hattet': { lemma: 'haben', note: 'ihr hattet (you all had)' },
		'gehabt': { lemma: 'haben', note: 'past participle of haben' },
		// werden (to become) conjugations
		'werde': { lemma: 'werden', note: 'ich werde (I become/will)' },
		'wirst': { lemma: 'werden', note: 'du wirst (you become/will)' },
		'wird': { lemma: 'werden', note: 'er/sie/es wird (becomes/will)' },
		'werdet': { lemma: 'werden', note: 'ihr werdet (you all become/will)' },
		'wurde': { lemma: 'werden', note: 'ich/er wurde (became/was)' },
		'wurdest': { lemma: 'werden', note: 'du wurdest (you became)' },
		'wurden': { lemma: 'werden', note: 'wir/sie wurden (became/were)' },
		'geworden': { lemma: 'werden', note: 'past participle of werden' },
		// können (can) conjugations
		'kann': { lemma: 'können', note: 'ich/er kann (I/he can)' },
		'kannst': { lemma: 'können', note: 'du kannst (you can)' },
		'könnt': { lemma: 'können', note: 'ihr könnt (you all can)' },
		'konnte': { lemma: 'können', note: 'ich/er konnte (could)' },
		'konntest': { lemma: 'können', note: 'du konntest (you could)' },
		'konnten': { lemma: 'können', note: 'wir/sie konnten (could)' },
		'gekonnt': { lemma: 'können', note: 'past participle of können' },
		// müssen (must) conjugations
		'muss': { lemma: 'müssen', note: 'ich/er muss (I/he must)' },
		'musst': { lemma: 'müssen', note: 'du musst (you must)' },
		'müsst': { lemma: 'müssen', note: 'ihr müsst (you all must)' },
		'musste': { lemma: 'müssen', note: 'ich/er musste (had to)' },
		'musstest': { lemma: 'müssen', note: 'du musstest (you had to)' },
		'mussten': { lemma: 'müssen', note: 'wir/sie mussten (had to)' },
		'gemusst': { lemma: 'müssen', note: 'past participle of müssen' },
		// wollen (to want) conjugations
		'will': { lemma: 'wollen', note: 'ich/er will (I/he want(s))' },
		'willst': { lemma: 'wollen', note: 'du willst (you want)' },
		'wollt': { lemma: 'wollen', note: 'ihr wollt (you all want)' },
		'wollte': { lemma: 'wollen', note: 'ich/er wollte (wanted)' },
		'wolltest': { lemma: 'wollen', note: 'du wolltest (you wanted)' },
		'wollten': { lemma: 'wollen', note: 'wir/sie wollten (wanted)' },
		'gewollt': { lemma: 'wollen', note: 'past participle of wollen' },
		// sollen (should) conjugations
		'soll': { lemma: 'sollen', note: 'ich/er soll (I/he should)' },
		'sollst': { lemma: 'sollen', note: 'du sollst (you should)' },
		'sollt': { lemma: 'sollen', note: 'ihr sollt (you all should)' },
		'sollte': { lemma: 'sollen', note: 'ich/er sollte (should)' },
		'solltest': { lemma: 'sollen', note: 'du solltest (you should)' },
		'sollten': { lemma: 'sollen', note: 'wir/sie sollten (should)' },
		'gesollt': { lemma: 'sollen', note: 'past participle of sollen' },
		// dürfen (may) conjugations
		'darf': { lemma: 'dürfen', note: 'ich/er darf (I/he may)' },
		'darfst': { lemma: 'dürfen', note: 'du darfst (you may)' },
		'dürft': { lemma: 'dürfen', note: 'ihr dürft (you all may)' },
		'durfte': { lemma: 'dürfen', note: 'ich/er durfte (was allowed)' },
		'durftest': { lemma: 'dürfen', note: 'du durftest (you were allowed)' },
		'durften': { lemma: 'dürfen', note: 'wir/sie durften (were allowed)' },
		'gedurft': { lemma: 'dürfen', note: 'past participle of dürfen' },
		// mögen/möchten
		'mag': { lemma: 'mögen', note: 'ich/er mag (I/he like(s))' },
		'magst': { lemma: 'mögen', note: 'du magst (you like)' },
		'mögt': { lemma: 'mögen', note: 'ihr mögt (you all like)' },
		'mochte': { lemma: 'mögen', note: 'ich/er mochte (liked)' },
		'möchte': { lemma: 'mögen', note: 'ich/er möchte (would like)' },
		'möchtest': { lemma: 'mögen', note: 'du möchtest (you would like)' },
		'möchten': { lemma: 'mögen', note: 'wir/sie möchten (would like)' },
		'möchtet': { lemma: 'mögen', note: 'ihr möchtet (you all would like)' },
		// wissen (to know)
		'weiß': { lemma: 'wissen', note: 'ich/er weiß (I/he know(s))' },
		'weißt': { lemma: 'wissen', note: 'du weißt (you know)' },
		'wisst': { lemma: 'wissen', note: 'ihr wisst (you all know)' },
		'wusste': { lemma: 'wissen', note: 'ich/er wusste (knew)' },
		'wusstest': { lemma: 'wissen', note: 'du wusstest (you knew)' },
		'wussten': { lemma: 'wissen', note: 'wir/sie wussten (knew)' },
		'gewusst': { lemma: 'wissen', note: 'past participle of wissen' },
		// geben (to give)
		'gibt': { lemma: 'geben', note: 'er/sie/es gibt (gives); es gibt (there is/are)' },
		'gab': { lemma: 'geben', note: 'ich/er gab (gave)' },
		'gabst': { lemma: 'geben', note: 'du gabst (you gave)' },
		'gaben': { lemma: 'geben', note: 'wir/sie gaben (gave)' },
		'gegeben': { lemma: 'geben', note: 'past participle of geben' },
		// fahren (to drive/go)
		'fährt': { lemma: 'fahren', note: 'er/sie/es fährt (drives)' },
		'fährst': { lemma: 'fahren', note: 'du fährst (you drive)' },
		'fuhr': { lemma: 'fahren', note: 'ich/er fuhr (drove)' },
		'gefahren': { lemma: 'fahren', note: 'past participle of fahren' },
		// sprechen (to speak)
		'spricht': { lemma: 'sprechen', note: 'er/sie/es spricht (speaks)' },
		'sprichst': { lemma: 'sprechen', note: 'du sprichst (you speak)' },
		'sprach': { lemma: 'sprechen', note: 'ich/er sprach (spoke)' },
		'gesprochen': { lemma: 'sprechen', note: 'past participle of sprechen' },
		// sehen (to see)
		'sieht': { lemma: 'sehen', note: 'er/sie/es sieht (sees)' },
		'siehst': { lemma: 'sehen', note: 'du siehst (you see)' },
		'sah': { lemma: 'sehen', note: 'ich/er sah (saw)' },
		'gesehen': { lemma: 'sehen', note: 'past participle of sehen' },
		// lesen (to read)
		'liest': { lemma: 'lesen', note: 'er/sie/du liest (reads/you read)' },
		'las': { lemma: 'lesen', note: 'ich/er las (read)' },
		'gelesen': { lemma: 'lesen', note: 'past participle of lesen' },
		// essen (to eat)
		'isst': { lemma: 'essen', note: 'er/sie/du isst (eats/you eat)' },
		'aß': { lemma: 'essen', note: 'ich/er aß (ate)' },
		'gegessen': { lemma: 'essen', note: 'past participle of essen' },
		// nehmen (to take)
		'nimmt': { lemma: 'nehmen', note: 'er/sie/es nimmt (takes)' },
		'nimmst': { lemma: 'nehmen', note: 'du nimmst (you take)' },
		'nahm': { lemma: 'nehmen', note: 'ich/er nahm (took)' },
		'genommen': { lemma: 'nehmen', note: 'past participle of nehmen' },
		// kommen (to come)
		'kommt': { lemma: 'kommen', note: 'er/sie/es kommt (comes)' },
		'kam': { lemma: 'kommen', note: 'ich/er kam (came)' },
		'gekommen': { lemma: 'kommen', note: 'past participle of kommen' },
		// gehen (to go)
		'geht': { lemma: 'gehen', note: 'er/sie/es geht (goes)' },
		'ging': { lemma: 'gehen', note: 'ich/er ging (went)' },
		'gegangen': { lemma: 'gehen', note: 'past participle of gehen' },
		// stehen (to stand)
		'steht': { lemma: 'stehen', note: 'er/sie/es steht (stands)' },
		'stand': { lemma: 'stehen', note: 'ich/er stand (stood)' },
		'gestanden': { lemma: 'stehen', note: 'past participle of stehen' },
		// finden (to find)
		'findet': { lemma: 'finden', note: 'er/sie/es findet (finds)' },
		'fand': { lemma: 'finden', note: 'ich/er fand (found)' },
		'gefunden': { lemma: 'finden', note: 'past participle of finden' },
		// tun (to do)
		'tut': { lemma: 'tun', note: 'er/sie/es tut (does)' },
		'tat': { lemma: 'tun', note: 'ich/er tat (did)' },
		'getan': { lemma: 'tun', note: 'past participle of tun' },
		// laufen (to run)
		'läuft': { lemma: 'laufen', note: 'er/sie/es läuft (runs)' },
		'läufst': { lemma: 'laufen', note: 'du läufst (you run)' },
		'lief': { lemma: 'laufen', note: 'ich/er lief (ran)' },
		'gelaufen': { lemma: 'laufen', note: 'past participle of laufen' },
		// schlafen (to sleep)
		'schläft': { lemma: 'schlafen', note: 'er/sie/es schläft (sleeps)' },
		'schläfst': { lemma: 'schlafen', note: 'du schläfst (you sleep)' },
		'schlief': { lemma: 'schlafen', note: 'ich/er schlief (slept)' },
		'geschlafen': { lemma: 'schlafen', note: 'past participle of schlafen' },
		// tragen (to carry/wear)
		'trägt': { lemma: 'tragen', note: 'er/sie/es trägt (carries/wears)' },
		'trägst': { lemma: 'tragen', note: 'du trägst (you carry/wear)' },
		// heißen (to be called)
		'heiße': { lemma: 'heißen', note: 'ich heiße (I am called)' },
		'heißt': { lemma: 'heißen', note: 'du/er heißt (you are/is called)' },

		// Preposition + article contractions
		'am': { lemma: 'an', note: 'am = an + dem (at/on the)' },
		'ans': { lemma: 'an', note: 'ans = an + das (to/onto the)' },
		'im': { lemma: 'in', note: 'im = in + dem (in the)' },
		'ins': { lemma: 'in', note: 'ins = in + das (into the)' },
		'zum': { lemma: 'zu', note: 'zum = zu + dem (to the, masc./neut.)' },
		'zur': { lemma: 'zu', note: 'zur = zu + der (to the, fem.)' },
		'vom': { lemma: 'von', note: 'vom = von + dem (from the)' },
		'beim': { lemma: 'bei', note: 'beim = bei + dem (at/by the)' },
		'aufs': { lemma: 'auf', note: 'aufs = auf + das (onto the)' },
		'fürs': { lemma: 'für', note: 'fürs = für + das (for the)' },
		'durchs': { lemma: 'durch', note: 'durchs = durch + das (through the)' },
		'ums': { lemma: 'um', note: 'ums = um + das (around the)' },
		'übers': { lemma: 'über', note: 'übers = über + das (over the)' },
		'unters': { lemma: 'unter', note: 'unters = unter + das (under the)' },
		'hinters': { lemma: 'hinter', note: 'hinters = hinter + das (behind the)' },
		'vors': { lemma: 'vor', note: 'vors = vor + das (in front of the)' },
	};

	function buildTooltipHtml(vocab: any, overrideArticle?: string, inflectionNote?: string): string {
		const isNoun = vocab.partOfSpeech?.toLowerCase() === 'noun';
		const lemmaDisplay = isNoun
			? vocab.lemma.charAt(0).toUpperCase() + vocab.lemma.slice(1)
			: vocab.lemma;
		let html = `<span class="word-tooltip">`;
		html += `<span class="word-tooltip-header">${overrideArticle ?? lemmaDisplay}</span>`;
		html += `<span class="word-tooltip-body">`;
		if (inflectionNote) {
			html += `<span class="word-tooltip-row"><strong>Form:</strong> ${inflectionNote}</span>`;
		}
		if (overrideArticle) {
			html += `<span class="word-tooltip-row"><strong>Noun:</strong> ${lemmaDisplay}</span>`;
			if (vocab.gender) html += `<span class="word-tooltip-row"><strong>Gender:</strong> ${vocab.gender}</span>`;
		} else {
			if (vocab.partOfSpeech) html += `<span class="word-tooltip-row"><strong>POS:</strong> ${vocab.partOfSpeech}</span>`;
			if (isNoun && vocab.gender) html += `<span class="word-tooltip-row"><strong>Gender:</strong> ${vocab.gender}</span>`;
		}
		if (vocab.plural) html += `<span class="word-tooltip-row"><strong>Plural:</strong> ${vocab.plural}</span>`;
		if (vocab.meaning) html += `<span class="word-tooltip-row"><strong>Meaning:</strong> ${vocab.meaning}</span>`;
		html += `</span></span>`;
		return html;
	}

	function getBasicStems(word: string): string[] {
		const stems: string[] = [];
		const suffixes = ['ung', 'te', 'ten', 'tet', 'test', 'en', 'er', 'es', 'em', 'et', 'st', 'e', 't', 'n', 's'];
		for (const suffix of suffixes) {
			if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
				const stem = word.slice(0, -suffix.length);
				stems.push(stem);
				if (suffix !== 'en') {
					stems.push(stem + 'en');
				}
			}
		}
		// Past participle: ge-...-t or ge-...-en
		if (word.startsWith('ge') && word.length > 4) {
			const rest = word.slice(2);
			stems.push(rest);
			if (rest.endsWith('t') && rest.length > 2) {
				stems.push(rest.slice(0, -1) + 'en');
			}
			if (rest.endsWith('en') && rest.length > 3) {
				stems.push(rest);
			}
		}
		// zu-infinitive: aufzugeben → aufgeben
		const zuMatch = word.match(/^(.+?)zu(.+)$/);
		if (zuMatch && zuMatch[1].length >= 2 && zuMatch[2].length >= 2) {
			stems.push(zuMatch[1] + zuMatch[2]);
		}
		return stems;
	}

	function getBasicEnglishStems(word: string): string[] {
		const stems: string[] = [];
		// Plural / verb forms
		if (word.endsWith('ies') && word.length > 4) stems.push(word.slice(0, -3) + 'y');
		if (word.endsWith('ves') && word.length > 4) stems.push(word.slice(0, -3) + 'f', word.slice(0, -3) + 'fe');
		if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes')) {
			stems.push(word.endsWith('es') ? word.slice(0, -2) : word);
		}
		if (word.endsWith('s') && !word.endsWith('ss')) stems.push(word.slice(0, -1));
		if (word.endsWith('es') && word.length > 3) stems.push(word.slice(0, -2));
		// -ing forms
		if (word.endsWith('ing') && word.length > 5) {
			stems.push(word.slice(0, -3));
			stems.push(word.slice(0, -3) + 'e');
			// double consonant: running → run
			const base = word.slice(0, -3);
			if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
				stems.push(base.slice(0, -1));
			}
		}
		// -ed forms
		if (word.endsWith('ed') && word.length > 4) {
			stems.push(word.slice(0, -2));
			stems.push(word.slice(0, -1)); // e.g., "liked" → "like"
			stems.push(word.slice(0, -2) + 'e');
			const base = word.slice(0, -2);
			if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
				stems.push(base.slice(0, -1));
			}
		}
		// -er comparative
		if (word.endsWith('er') && word.length > 4) {
			stems.push(word.slice(0, -2));
			stems.push(word.slice(0, -1));
		}
		// -ly → adjective
		if (word.endsWith('ly') && word.length > 4) {
			stems.push(word.slice(0, -2));
		}
		return stems;
	}

	function buildVocabMap(): Map<string, any> {
		const map = new Map();
		const isEnToDe = challenge?.gameMode === 'en-to-de';
		for (const v of challenge?.allVocabulary || []) {
			map.set(v.lemma.toLowerCase(), v);
			if (isEnToDe && v.meaning) {
				for (const m of v.meaning.split(',')) {
					const key = m.trim().toLowerCase();
					if (key) map.set(key, v);
				}
			}
		}
		for (const v of challenge?.targetedVocabulary || []) {
			map.set(v.lemma.toLowerCase(), v);
			if (isEnToDe && v.meaning) {
				for (const m of v.meaning.split(',')) {
					const key = m.trim().toLowerCase();
					if (key) map.set(key, v);
				}
			}
		}
		return map;
	}

	function parseTextWithTooltips(text: string, isTargetedVocab: boolean): string {
		const vocabMap = buildVocabMap();
		const isDeToEn = challenge.gameMode === 'de-to-en';

		// Step 1: Replace <vocab> tags with placeholders to protect them
		const vocabReplacements: string[] = [];
		text = text.replace(/<vocab(?:\s+[^>]*)?id="([^"]+)"(?:[^>]*)?>([^<]*)<\/vocab>/g, (_match: string, id: string, word: string) => {
			const vocab = challenge.targetedVocabulary?.find((v: any) => v.id === id);
			const tooltipHtml = vocab ? buildTooltipHtml(vocab) : '';
			const replacement = `<span class="vocab-highlight tooltip-trigger">${word}${tooltipHtml}</span>`;
			vocabReplacements.push(replacement);
			return `\x00VOCAB_${vocabReplacements.length - 1}\x00`;
		});

		// Clean up incomplete tags from streaming
		text = text.replace(/<vocab[^>]*>|<\/vocab>|<vocab[^>]*$/g, '');

		const isEnToDe = challenge.gameMode === 'en-to-de';
		const englishArticles = new Set(['the', 'a', 'an']);

		// Helper: find vocab entry for a cleaned word
		// Returns { vocab, inflectionNote? } or null
		function findVocab(cleanWord: string): { vocab: any; inflectionNote?: string } | null {
			let vocab = vocabMap.get(cleanWord);
			if (vocab) return { vocab };

			// Check the inflection map for conjugations/contractions
			if (!isEnToDe) {
				const inflection = GERMAN_INFLECTION_MAP[cleanWord];
				if (inflection) {
					vocab = vocabMap.get(inflection.lemma.toLowerCase());
					if (vocab) return { vocab, inflectionNote: inflection.note };
					// Even if the lemma isn't in our vocabulary, create a synthetic entry
					return {
						vocab: { lemma: inflection.lemma, meaning: inflection.note, partOfSpeech: null },
						inflectionNote: inflection.note
					};
				}
			}

			const stems = isEnToDe ? getBasicEnglishStems(cleanWord) : getBasicStems(cleanWord);
			for (const stem of stems) {
				vocab = vocabMap.get(stem);
				if (vocab) return { vocab };
			}
			return null;
		}

		// Helper: find the next noun vocab by scanning upcoming words
		function findNextNoun(words: string[], startIdx: number): any {
			const skippablePOS = new Set(['adjective', 'adverb', 'article', 'determiner', 'pronoun']);
			for (let j = startIdx; j < words.length && j < startIdx + 5; j++) {
				const w = words[j];
				if (w.match(/\x00VOCAB_\d+\x00/)) continue;
				const clean = w.replace(/[.,!?;:'"|()\[\]{}\-\u2014\u2013]/g, '').toLowerCase();
				if (!clean || englishArticles.has(clean)) continue;
				const result = findVocab(clean);
				const v = result?.vocab;
				if (v && v.partOfSpeech?.toLowerCase() === 'noun') return v;
				// Skip adjectives/adverbs that can appear between article and noun
				if (v && skippablePOS.has(v.partOfSpeech?.toLowerCase())) continue;
				// No vocab match at all — might be an adjective we don't know; keep scanning
				if (!v) continue;
				// Known non-noun, non-skippable POS — stop
				break;
			}
			return null;
		}

		// Determine if a word is a plural English form pointing at a known noun
		function isLikelyPlural(cleanWord: string): boolean {
			if (cleanWord.endsWith('s') && !cleanWord.endsWith('ss')) {
				const singular = cleanWord.slice(0, -1);
				const v = vocabMap.get(singular);
				if (v && v.partOfSpeech?.toLowerCase() === 'noun') return true;
			}
			if (cleanWord.endsWith('ies') && cleanWord.length > 4) {
				const singular = cleanWord.slice(0, -3) + 'y';
				const v = vocabMap.get(singular);
				if (v && v.partOfSpeech?.toLowerCase() === 'noun') return true;
			}
			return false;
		}

		// Step 2: Split into tokens (words + whitespace) and process with lookahead
		const tokens = text.split(/(\s+)/);
		const result: string[] = [];

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			// Preserve whitespace tokens
			if (/^\s+$/.test(token)) {
				result.push(token);
				continue;
			}
			// Don't touch placeholders
			if (token.match(/\x00VOCAB_\d+\x00/)) {
				result.push(token);
				continue;
			}

			const cleanWord = token.replace(/[.,!?;:'"|()\[\]{}\-\u2014\u2013]/g, '').toLowerCase();
			if (!cleanWord) {
				result.push(token);
				continue;
			}

			// Handle English articles in en-to-de mode
			if (isEnToDe && englishArticles.has(cleanWord)) {
				// Get only non-whitespace tokens ahead
				const upcomingWords = tokens.slice(i + 1).filter((t: string) => !/^\s+$/.test(t));
				const nounVocab = findNextNoun(upcomingWords, 0);
				if (nounVocab) {
					const isPlural = upcomingWords.length > 0 && isLikelyPlural(
						upcomingWords[0].replace(/[.,!?;:'"|()\[\]{}\-\u2014\u2013]/g, '').toLowerCase()
					);
					let article: string;
					if (cleanWord === 'the') {
						article = isPlural ? 'die' : (nounVocab.gender || 'der/die/das');
					} else {
						// "a" / "an" — indefinite
						const genderMap: Record<string, string> = { 'der': 'ein', 'die': 'eine', 'das': 'ein' };
						article = nounVocab.gender ? (genderMap[nounVocab.gender] || 'ein/eine') : 'ein/eine';
					}
					const tooltip = buildTooltipHtml(nounVocab, article);
					result.push(`<span class="word-hover has-info tooltip-trigger">${token}${tooltip}</span>`);
					continue;
				}
				// Fallback: show generic article tooltip even when noun not found
				const genericArticle = cleanWord === 'the' ? 'der/die/das' : 'ein/eine';
				const genericTooltip = `<span class="word-tooltip"><span class="word-tooltip-header">${genericArticle}</span><span class="word-tooltip-body"><span class="word-tooltip-row"><strong>Article:</strong> ${cleanWord === 'the' ? 'definite' : 'indefinite'}</span></span></span>`;
				result.push(`<span class="word-hover has-info tooltip-trigger">${token}${genericTooltip}</span>`);
				continue;
			}

			const vocabResult = findVocab(cleanWord);
			if (vocabResult) {
				result.push(`<span class="word-hover has-info tooltip-trigger">${token}${buildTooltipHtml(vocabResult.vocab, undefined, vocabResult.inflectionNote)}</span>`);
			} else {
				result.push(`<span class="word-hover">${token}</span>`);
			}
		}
		text = result.join('');

		// Step 3: Restore vocab placeholders
		text = text.replace(/\x00VOCAB_(\d+)\x00/g, (_: string, idx: string) => vocabReplacements[parseInt(idx)]);

		return text;
	}

	$: parsedChallengeText = (() => {
		if (!challenge?.challengeText) return '';
		return parseTextWithTooltips(challenge.challengeText, true);
	})();

	$: parsedTargetSentence = (() => {
		if (!challenge?.targetSentence) return '';
		return parseTextWithTooltips(challenge.targetSentence, false);
	})();

	async function generateChallenge() {
		// Cancel any in-flight requests before starting a new one
		cancelAllRequests();

		loading = true;
		isStreaming = true;
		feedback = null;
		showEnglishFeedback = false;
		userInput = '';
		challenge = null;
		fillBlankAnswers = [];
		selectedChoice = null;
		shuffledChoices = [];
		hasSubmittedMc = false;

		generateController = new AbortController();
		
		try {
			const res = await fetch('/api/generate-lesson', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameMode }),
				signal: generateController.signal
			});
			
			if (!res.ok) {
				const error = await res.json();
				toast.push(`Error: ${error.error}`, { theme: { '--toastBackground': '#F56565', '--toastBarBackground': '#C53030' } });
				return;
			}
			
			const reader = res.body?.getReader();
			if (!reader) throw new Error("No readable stream available");
			const decoder = new TextDecoder();
			let accumulatedJson = '';
			let buffer = '';
			let idMap: Record<string, string> = {};
			
			challenge = {
				challengeText: '',
				targetSentence: '',
				targetedVocabulary: [],
				targetedGrammar: [],
				userId: ''
			};

			// Keep loading=true until we actually have visible challenge text

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
				
				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const msg = JSON.parse(line);
						if (msg.type === 'metadata') {
							challenge.userId = msg.data.userId;
							challenge.targetedVocabulary = msg.data.targetedVocabulary;
							challenge.targetedGrammar = msg.data.targetedGrammar;
							challenge.allVocabulary = msg.data.allVocabulary || [];
							challenge.gameMode = msg.data.gameMode;
							idMap = msg.data.idMap || {};
							userLevel = msg.data.userLevel || 'A1';
							isAbsoluteBeginner = msg.data.isAbsoluteBeginner || false;
						} else if (msg.type === 'vocab_enrichment') {
							const existingIds = new Set((challenge.allVocabulary || []).map((v: any) => v.id));
							const newVocab = msg.data.filter((v: any) => !existingIds.has(v.id));
							challenge.allVocabulary = [...(challenge.allVocabulary || []), ...newVocab];
						} else if (msg.type === 'chunk') {
							accumulatedJson += msg.content;
							
							// Try to extract challengeText for progressive display
							const challengeMatch = accumulatedJson.match(/"challengeText"\s*:\s*"((?:[^"\\]|\\.)*)/);
							if (challengeMatch && challengeMatch[1]) {
								challenge.challengeText = challengeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
								// Only stop loading once we have actual text to show
								if (loading) loading = false;
							}
						}
					} catch (e) {
						// Ignore parse errors on partial lines
					}
				}
				
				challenge = challenge; // trigger reactivity
			}
			
			if (buffer.trim()) {
				try {
					const msg = JSON.parse(buffer);
					if (msg.type === 'chunk') {
						accumulatedJson += msg.content;
					} else if (msg.type === 'vocab_enrichment') {
						const existingIds = new Set((challenge.allVocabulary || []).map((v: any) => v.id));
						const newVocab = msg.data.filter((v: any) => !existingIds.has(v.id));
						challenge.allVocabulary = [...(challenge.allVocabulary || []), ...newVocab];
					}
				} catch (e) {}
			}
			
			// Try to parse the complete JSON at the end to get everything (targetSentence, etc)
			try {
				let cleaned = accumulatedJson;
				const firstBrace = cleaned.indexOf('{');
				const lastBrace = cleaned.lastIndexOf('}');
				if (firstBrace !== -1 && lastBrace !== -1) {
					cleaned = cleaned.slice(firstBrace, lastBrace + 1);
				}
				const parsed = JSON.parse(cleaned);
				challenge = { ...challenge, ...parsed };

				// Remap short IDs (v0, g0, ...) from LLM back to real UUIDs
				if (parsed.targetedVocabularyIds && Array.isArray(parsed.targetedVocabularyIds)) {
					parsed.targetedVocabularyIds = parsed.targetedVocabularyIds.map((id: string) => idMap[id] || id);
					challenge.targetedVocabularyIds = parsed.targetedVocabularyIds;
				}
				if (parsed.targetedGrammarIds && Array.isArray(parsed.targetedGrammarIds)) {
					parsed.targetedGrammarIds = parsed.targetedGrammarIds.map((id: string) => idMap[id] || id);
					challenge.targetedGrammarIds = parsed.targetedGrammarIds;
				}
				// Remap vocab tags in challengeText: <vocab id="v0"> -> <vocab id="real-uuid">
				if (challenge.challengeText) {
					challenge.challengeText = challenge.challengeText.replace(
						/<vocab\s+id="([^"]+)">/g,
						(_match: string, shortId: string) => `<vocab id="${idMap[shortId] || shortId}">`
					);
				}
				// Remap fill-blank hint vocabIds
				if (challenge.hints && Array.isArray(challenge.hints)) {
					challenge.hints = challenge.hints.map((h: any) => ({
						...h,
						vocabId: idMap[h.vocabId] || h.vocabId
					}));
				}

				// Filter targeted vocab/grammar to only IDs the LLM actually used in the sentence.
				// The LLM returns targetedVocabularyIds/targetedGrammarIds listing only what it used.
				// Discard any vocab/grammar the LLM didn't use so they aren't graded or shown.
				if (parsed.targetedVocabularyIds && Array.isArray(parsed.targetedVocabularyIds)) {
					const usedVocabIds = new Set(parsed.targetedVocabularyIds);
					challenge.targetedVocabulary = (challenge.targetedVocabulary || [])
						.filter((v: any) => usedVocabIds.has(v.id));
				}
				if (parsed.targetedGrammarIds && Array.isArray(parsed.targetedGrammarIds)) {
					const usedGrammarIds = new Set(parsed.targetedGrammarIds);
					challenge.targetedGrammar = (challenge.targetedGrammar || [])
						.filter((g: any) => usedGrammarIds.has(g.id));
				}

				// Initialize fill-blank answers array
				if (challenge.gameMode === 'fill-blank' && challenge.hints) {
					fillBlankAnswers = challenge.hints.map(() => '');
				}

				// Shuffle multiple-choice options
				if (challenge.gameMode === 'multiple-choice' && challenge.distractors && challenge.targetSentence) {
					const allChoices = [...challenge.distractors, challenge.targetSentence];
					shuffledChoices = allChoices.sort(() => Math.random() - 0.5);
				}
			} catch(e) {
				console.error("Failed to parse final JSON", e);
			}

		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				// Request was intentionally cancelled — don't show an error
				return;
			}
			console.error(error);
			toast.push(`Failed to generate challenge: ${error instanceof Error ? error.message : 'Unknown error'}`, { theme: { '--toastBackground': '#F56565', '--toastBarBackground': '#C53030' } });
		} finally {
			generateController = null;
			loading = false;
			isStreaming = false;
		}
	}

	async function submitAnswer() {
		const mode = challenge?.gameMode || 'en-to-de';

		// Build userInput based on mode
		let effectiveInput = userInput;
		if (mode === 'fill-blank') {
			if (fillBlankAnswers.some(a => !a.trim())) return;
			effectiveInput = fillBlankAnswers.join(', ');
		} else if (mode === 'multiple-choice') {
			if (!selectedChoice) return;
			effectiveInput = selectedChoice;
		} else {
			if (!userInput.trim()) return;
		}

		if (isStreaming) {
			toast.push('Please wait for the challenge to finish generating.', { theme: { '--toastBackground': '#F6E05E', '--toastBarBackground': '#D69E2E', '--toastColor': '#000' } });
			return;
		}
		if (!challenge?.targetSentence) {
			toast.push('Challenge was not properly generated (missing target sentence). Please generate a new challenge.', { theme: { '--toastBackground': '#F56565', '--toastBarBackground': '#C53030' } });
			return;
		}
		
		if (mode === 'multiple-choice') {
			hasSubmittedMc = true;
		}
		
		submitting = true;
		feedback = null;

		submitController = new AbortController();

		try {
			const res = await fetch('/api/submit-answer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: challenge.userId,
					userInput: effectiveInput,
					targetSentence: challenge.targetSentence,
					targetedVocabularyIds: challenge.targetedVocabulary?.map((v: any) => v.id) || [],
					targetedGrammarIds: challenge.targetedGrammar?.map((g: any) => g.id) || [],
					gameMode: challenge.gameMode || 'en-to-de'
				}),
				signal: submitController.signal
			});
			
			if (!res.ok) {
				const error = await res.json();
				toast.push(`Error: ${error.error}`, { theme: { '--toastBackground': '#F56565', '--toastBarBackground': '#C53030' } });
				feedback = null;
				return;
			}
			
			const reader = res.body?.getReader();
			if (!reader) throw new Error('Failed to get readable stream');

			const decoder = new TextDecoder();
			let responseText = '';

			// Keep submitting=true until we have actual feedback text to show

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				responseText += decoder.decode(value, { stream: true });

				// Progressively extract the "feedback" field from the streaming JSON
				const feedbackMatch = responseText.match(/"feedback"\s*:\s*"((?:[^"\\]|\\.)*)/);
				if (feedbackMatch) {
					let feedbackText: string;
					try {
						feedbackText = JSON.parse(`"${feedbackMatch[1]}"`);
					} catch (e) {
						feedbackText = feedbackMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
					}
					if (!feedback) {
						feedback = {
							globalScore: null,
							vocabularyUpdates: [],
							grammarUpdates: [],
							feedback: feedbackText,
							feedbackEnglish: ''
						};
					} else {
						feedback.feedback = feedbackText;
					}
					// Only stop showing "Evaluating..." once we have visible feedback
					if (submitting) submitting = false;
					feedback = feedback; // trigger reactivity
				}
			}

			// Parse the complete JSON response for all structured data
			try {
				const data = JSON.parse(responseText);
				// Build grader idMap from the order of IDs we sent (same order the grader used)
				const graderIdMap: Record<string, string> = {};
				(challenge.targetedVocabulary || []).forEach((v: any, i: number) => { graderIdMap[`v${i}`] = v.id; });
				(challenge.targetedGrammar || []).forEach((g: any, i: number) => { graderIdMap[`g${i}`] = g.id; });
				feedback = {
					globalScore: data.globalScore ?? 0,
					vocabularyUpdates: (data.vocabularyUpdates || []).map((u: any) => ({
						...u,
						id: graderIdMap[u.id] || u.id
					})),
					grammarUpdates: (data.grammarUpdates || []).map((u: any) => ({
						...u,
						id: graderIdMap[u.id] || u.id
					})),
					feedback: data.feedback || '',
					feedbackEnglish: data.feedbackEnglish || ''
				};
				// Auto-show English feedback for beginners
				if (isAbsoluteBeginner && feedback.feedbackEnglish) {
					showEnglishFeedback = true;
				}
			} catch (e) {
				console.error('Failed to parse full feedback response', e, responseText);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}
			console.error(error);
			toast.push(`Failed to submit answer: ${error instanceof Error ? error.message : 'Unknown error'}`, { theme: { '--toastBackground': '#F56565', '--toastBarBackground': '#C53030' } });
			feedback = null;
			hasSubmittedMc = false;
		} finally {
			submitController = null;
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Play - LernenDeutsch</title>
</svelte:head>

<div class="page-container">
	<div class="content-wrapper">
		<header class="page-header">
			<h1>Play Mode</h1>
			<p>Test your skills with personalized challenges.</p>
		</header>

		{#if !challenge && !loading}
			<div class="card empty-state">
				<h2>Ready to test your skills?</h2>

				{#if isAbsoluteBeginner}
					<div class="beginner-tip">
						<span class="tip-icon">💡</span>
						<div>
							<strong>Tip for beginners:</strong> Start with <strong>Multiple Choice</strong> or <strong>German to English</strong> — these let you recognize words before producing them. Once you feel confident, try <strong>Fill in the Blank</strong> and <strong>English to German</strong>!
						</div>
					</div>
				{/if}

				<div class="mode-selector">
					<span class="mode-label">Game Mode:</span>
					<div class="mode-buttons">
						<!-- Easiest first -->
						<button
							class="mode-btn" class:active={gameMode === 'multiple-choice'}
							on:click={() => gameMode = 'multiple-choice'}
						>
							🔘 Multiple Choice
							<span class="mode-difficulty easy">Easiest</span>
						</button>
						<button
							class="mode-btn" class:active={gameMode === 'de-to-en'}
							on:click={() => gameMode = 'de-to-en'}
						>
							🇩🇪 → {englishFlag} German to English
							<span class="mode-difficulty easy">Easy</span>
						</button>
						<button
							class="mode-btn" class:active={gameMode === 'fill-blank'}
							on:click={() => gameMode = 'fill-blank'}
						>
							✏️ Fill in the Blank
							<span class="mode-difficulty medium">Medium</span>
						</button>
						<button
							class="mode-btn" class:active={gameMode === 'en-to-de'}
							on:click={() => gameMode = 'en-to-de'}
						>
							{englishFlag} → 🇩🇪 English to German
							<span class="mode-difficulty hard">Hardest</span>
						</button>
					</div>
				</div>
				<button on:click={generateChallenge} class="btn btn-primary">
					Generate Next Challenge
				</button>
			</div>
		{/if}

		{#if loading}
			<div class="card loading-state">
				<div class="spinner"></div>
				<p>Generating your personalized i+1 challenge...</p>
			</div>
		{/if}

		{#if challenge && !loading}
			<div class="card challenge-card">
				<div class="challenge-section">
					{#if challenge.gameMode === 'fill-blank'}
						<h3>Fill in the blanks:</h3>
					{:else if challenge.gameMode === 'multiple-choice'}
						<h3>Choose the correct English translation:</h3>
					{:else if challenge.gameMode === 'de-to-en'}
						<h3>Translate this to English:</h3>
					{:else}
						<h3>Translate this to German:</h3>
					{/if}
					<p class="challenge-text">{@html parsedChallengeText}</p>
				</div>

				{#if challenge.gameMode === 'fill-blank' && challenge.hints?.length > 0}
					<div class="challenge-section">
						<h3>Hints:</h3>
						<ul class="hint-list">
							{#each challenge.hints as hint, i}
								<li><span class="hint-number">Blank {i + 1}:</span> {hint.hint}</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="challenge-section">
					<h3>Grammar:</h3>
					<ul class="concept-list">
						{#each challenge.targetedGrammar as grammar}
							<li><span class="concept-type">Grammar</span> {grammar.title}</li>
						{/each}
					</ul>
				</div>

				<form on:submit|preventDefault={submitAnswer} class="answer-form">
					{#if challenge.gameMode === 'fill-blank'}
						<div class="fill-blank-inputs">
							{#each fillBlankAnswers as _, i}
								<div class="form-group">
									<label for="blank-{i}">Blank {i + 1}{challenge.hints?.[i] ? ` (${challenge.hints[i].hint})` : ''}</label>
									<input
										id="blank-{i}"
										type="text"
										bind:value={fillBlankAnswers[i]}
										disabled={submitting || feedback !== null || isStreaming}
										placeholder="Type the missing German word..."
										class="blank-input"
									/>
								</div>
							{/each}
						</div>
					{:else if challenge.gameMode === 'multiple-choice'}
						<div class="mc-choices">
							{#each shuffledChoices as choice}
								<button
									type="button"
									class="mc-choice-btn"
									class:selected={selectedChoice === choice}
									class:correct={(feedback || hasSubmittedMc) && choice === challenge.targetSentence}
									class:incorrect={(feedback || hasSubmittedMc) && selectedChoice === choice && choice !== challenge.targetSentence}
									disabled={submitting || feedback !== null || isStreaming || hasSubmittedMc}
									on:click={() => { selectedChoice = choice; submitAnswer(); }}
								>
									{choice}
								</button>
							{/each}
						</div>
					{:else}
						<div class="form-group">
							<label for="answer">Your Translation</label>
							<textarea
								id="answer"
								bind:value={userInput}
								disabled={submitting || feedback || isStreaming}
								rows="3"
								placeholder={isStreaming ? "Generating challenge..." : (challenge?.gameMode === 'de-to-en' ? "Type your English translation here..." : "Type your German translation here... (Or ask for help / translation in English)")}
							></textarea>
						</div>
					{/if}
					
					{#if !feedback}
						{#if challenge.gameMode !== 'multiple-choice'}
							<button 
								type="submit" 
								disabled={submitting || isStreaming || !challenge?.targetSentence || (challenge.gameMode === 'fill-blank' ? fillBlankAnswers.some(a => !a.trim()) : !userInput.trim())}
								class="btn btn-success submit-btn"
							>
								{submitting ? 'Evaluating...' : (isStreaming ? 'Generating...' : 'Submit Answer')}
							</button>
						{/if}
					{/if}
				</form>
			</div>
		{/if}

		{#if submitting}
			<div class="card loading-state">
				<div class="spinner"></div>
				<p>Evaluating your answer...</p>
			</div>
		{/if}

		{#if feedback}
			<div class="card feedback-card">
				<div class="feedback-header">
					<h2>Feedback</h2>
					{#if feedback.feedbackEnglish}
					<label class="toggle-container">
						<input type="checkbox" bind:checked={showEnglishFeedback}>
						<span class="toggle-label">Translate to English</span>
					</label>
					{/if}
					<div class="score-display">
						<span class="score-label">Score:</span>
						{#if feedback.globalScore === null}
							<div class="score-spinner"></div>
						{:else}
						<span class="score-value" class:excellent={feedback.globalScore > 0.8} class:good={feedback.globalScore <= 0.8 && feedback.globalScore > 0.5} class:needs-work={feedback.globalScore <= 0.5}>
							{Math.round(feedback.globalScore * 100)}%
						</span>
						{/if}
					</div>
				</div>

				<div class="feedback-message">
					<p>{showEnglishFeedback && feedback.feedbackEnglish ? feedback.feedbackEnglish : feedback.feedback}</p>
				</div>

				<div class="feedback-section">
					<h3>Expected Answer:</h3>
					<div class="expected-answer">
						<p>{@html parsedTargetSentence}</p>
					</div>
				</div>

				<div class="feedback-grid">
					{#if feedback.vocabularyUpdates?.length > 0}
						<div class="feedback-list-section">
							<h3>Vocabulary Used</h3>
							<ul>
								{#each feedback.vocabularyUpdates as update}
									{@const v = challenge.targetedVocabulary.find((v: any) => v.id === update.id)}
									<li>
										<span class="icon">{(update.score ?? 0) >= 0.5 ? '✅' : '❌'}</span>
										{#if v}
											{#if v.gender}{v.gender} {/if}{v.lemma}{#if v.plural} (pl: {v.plural}){/if}
										{:else}
											{update.id}
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if feedback.grammarUpdates?.length > 0}
						<div class="feedback-list-section">
							<h3>Grammar Rules Followed</h3>
							<ul>
								{#each feedback.grammarUpdates as update}
									<li>
										<span class="icon">{(update.score ?? 0) >= 0.5 ? '✅' : '❌'}</span>
										{challenge.targetedGrammar.find((g: any) => g.id === update.id)?.title || update.id}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				<button on:click={generateChallenge} class="btn btn-primary next-btn">
					Next Challenge
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		background-color: #f8fafc;
		color: #334155;
	}

	.page-container {
		display: flex;
		justify-content: center;
		padding: 2rem 1rem;
		min-height: calc(100vh - 4rem);
		-webkit-user-select: none;
		user-select: none;
	}

	.page-container input,
	.page-container textarea {
		-webkit-user-select: text;
		user-select: text;
	}

	.content-wrapper {
		width: 100%;
		max-width: 800px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		font-size: 2.5rem;
		color: #0f172a;
		margin: 0 0 0.5rem 0;
	}

	.page-header p {
		color: #64748b;
		font-size: 1.1rem;
		margin: 0;
	}

	.card {
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		padding: 2rem;
		border: 1px solid #e2e8f0;
		margin-bottom: 1.5rem;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: #f8fafc;
		border: 1px dashed #cbd5e1;
	}

	.empty-state h2 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #1e293b;
		font-size: 1.5rem;
	}

	.loading-state {
		text-align: center;
		padding: 4rem 2rem;
	}

	.spinner {
		display: inline-block;
		width: 2rem;
		height: 2rem;
		border: 4px solid #e2e8f0;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	.score-spinner {
		display: inline-block;
		width: 1.2rem;
		height: 1.2rem;
		border: 3px solid #e2e8f0;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-state p {
		color: #64748b;
		margin: 0;
	}

	.challenge-section {
		margin-bottom: 1.5rem;
	}

	.challenge-section h3, .feedback-section h3, .feedback-list-section h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 0.5rem 0;
	}

	.challenge-text {
		font-size: 1.5rem;
		font-weight: 500;
		color: #0f172a;
		margin: 0;
	}

	/* Tooltip trigger (shared by vocab-highlight and word-hover) */
	:global(.tooltip-trigger) {
		position: relative;
		cursor: help;
	}

	:global(.word-tooltip) {
		visibility: hidden;
		opacity: 0;
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 8px;
		background-color: #1e293b;
		color: #f8fafc;
		text-align: left;
		padding: 0.625rem 0.75rem;
		border-radius: 6px;
		width: max-content;
		min-width: 140px;
		max-width: 240px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		transition: opacity 0.15s, visibility 0.15s;
		z-index: 100;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	:global(.word-tooltip::after) {
		content: "";
		position: absolute;
		top: 100%;
		left: 50%;
		margin-left: -5px;
		border-width: 5px;
		border-style: solid;
		border-color: #1e293b transparent transparent transparent;
	}

	:global(.tooltip-trigger:hover > .word-tooltip) {
		visibility: visible;
		opacity: 1;
	}

	:global(.word-tooltip-header) {
		font-weight: bold;
		font-size: 0.95rem;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid #475569;
		margin-bottom: 0.125rem;
		display: block;
	}

	:global(.word-tooltip-body) {
		font-size: 0.8rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	:global(.word-tooltip-row) {
		display: block;
	}

	/* Targeted vocab words: yellow highlight */
	:global(.vocab-highlight) {
		background-color: #fef08a;
		border-radius: 4px;
		padding: 0 4px;
		border-bottom: 2px dashed #ca8a04;
		transition: background-color 0.2s;
	}

	:global(.vocab-highlight:hover) {
		background-color: #fde047;
	}

	/* Non-targeted words: subtle underline on hover */
	:global(.word-hover) {
		border-bottom: 1px solid transparent;
		transition: border-color 0.15s;
		border-radius: 2px;
	}

	:global(.word-hover:hover) {
		border-bottom-color: #94a3b8;
	}

	:global(.word-hover.has-info) {
		cursor: help;
	}

	:global(.word-hover.has-info:hover) {
		border-bottom-color: #3b82f6;
	}

	.help-text p {
		font-size: 0.9rem;
		color: #64748b;
		background: #f1f5f9;
		padding: 0.75rem;
		border-radius: 6px;
		margin: 0;
	}

	.concept-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.concept-list li {
		color: #475569;
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.concept-type {
		background: #e2e8f0;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569;
	}

	.answer-form {
		margin-top: 2rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #334155;
		margin-bottom: 0.5rem;
	}

	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-family: inherit;
		font-size: 1rem;
		color: #0f172a;
		box-sizing: border-box;
		resize: vertical;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.form-group textarea:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-group textarea:disabled {
		background-color: #f1f5f9;
		color: #94a3b8;
		cursor: not-allowed;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		text-decoration: none;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: #2563eb;
		color: #ffffff;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #1d4ed8;
	}

	.btn-success {
		background-color: #16a34a;
		color: #ffffff;
	}

	.btn-success:hover:not(:disabled) {
		background-color: #15803d;
	}

	.submit-btn {
		width: 100%;
	}

	.next-btn {
		width: 100%;
		margin-top: 1rem;
	}

	.feedback-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.feedback-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #0f172a;
	}

	.score-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.toggle-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
		font-size: 0.875rem;
		color: #64748b;
	}

	.toggle-container input[type="checkbox"] {
		cursor: pointer;
		width: 1rem;
		height: 1rem;
	}

	.score-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #64748b;
	}

	.score-value {
		font-size: 1.25rem;
		font-weight: 700;
	}

	.score-value.excellent { color: #16a34a; }
	.score-value.good { color: #ca8a04; }
	.score-value.needs-work { color: #dc2626; }

	.feedback-message {
		background-color: #eff6ff;
		border-left: 4px solid #3b82f6;
		padding: 1rem;
		border-radius: 0 8px 8px 0;
		margin-bottom: 1.5rem;
		color: #1e3a8a;
		line-height: 1.5;
	}

	.feedback-message p { margin: 0; }

	.expected-answer {
		background-color: #f0fdf4;
		border: 1px solid #bbf7d0;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
	}

	.expected-answer p {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 500;
		color: #166534;
	}

	.feedback-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	@media (min-width: 640px) {
		.feedback-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.feedback-list-section ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.feedback-list-section li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		color: #334155;
		font-size: 0.95rem;
	}

	.feedback-list-section .icon {
		flex-shrink: 0;
	}

	.mode-selector {
		margin-bottom: 1.5rem;
	}

	.mode-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.75rem;
	}

	.mode-buttons {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.mode-btn {
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		border: 2px solid #e2e8f0;
		background: #ffffff;
		color: #475569;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.mode-btn:hover {
		border-color: #93c5fd;
		background: #eff6ff;
	}

	.mode-btn.active {
		border-color: #2563eb;
		background: #eff6ff;
		color: #1d4ed8;
		font-weight: 600;
	}

	/* Fill in the Blank styles */
	.fill-blank-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.blank-input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-family: inherit;
		font-size: 1rem;
		color: #0f172a;
		box-sizing: border-box;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.blank-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.blank-input:disabled {
		background-color: #f1f5f9;
		color: #94a3b8;
		cursor: not-allowed;
	}

	.hint-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.hint-list li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #475569;
		font-size: 0.95rem;
		background: #f8fafc;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		border: 1px solid #e2e8f0;
	}

	.hint-number {
		font-weight: 600;
		color: #2563eb;
		white-space: nowrap;
	}

	/* Multiple Choice styles */
	.mc-choices {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.mc-choice-btn {
		width: 100%;
		padding: 1rem 1.25rem;
		border: 2px solid #e2e8f0;
		border-radius: 10px;
		background: #ffffff;
		color: #1e293b;
		font-size: 1.05rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s;
	}

	.mc-choice-btn:hover:not(:disabled) {
		border-color: #93c5fd;
		background: #eff6ff;
	}

	.mc-choice-btn.selected {
		border-color: #2563eb;
		background: #eff6ff;
		color: #1d4ed8;
		font-weight: 600;
	}

	.mc-choice-btn.correct {
		border-color: #16a34a;
		background: #f0fdf4;
		color: #166534;
	}

	.mc-choice-btn.incorrect {
		border-color: #dc2626;
		background: #fef2f2;
		color: #991b1b;
	}

	.mc-choice-btn:disabled {
		cursor: default;
		opacity: 0.85;
	}

	/* Beginner guidance styles */
	.beginner-tip {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
		border: 1px solid #bbf7d0;
		border-radius: 12px;
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
		font-size: 0.95rem;
		line-height: 1.5;
		color: #166534;
	}

	.tip-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.mode-difficulty {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.1rem 0.5rem;
		border-radius: 9999px;
	}

	.mode-difficulty.easy {
		background-color: #dcfce7;
		color: #166534;
	}

	.mode-difficulty.medium {
		background-color: #fef9c3;
		color: #854d0e;
	}

	.mode-difficulty.hard {
		background-color: #fee2e2;
		color: #991b1b;
	}
</style>
