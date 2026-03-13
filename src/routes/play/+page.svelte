<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import toast from 'svelte-french-toast';
	import { marked } from 'marked';
	import { modal } from '$lib/modal.svelte';
	import type { PageData } from './$types';

	import FillInBlankView from '$lib/components/play/FillInBlankView.svelte';
	import MultipleChoiceView from '$lib/components/play/MultipleChoiceView.svelte';
	import TranslationView from '$lib/components/play/TranslationView.svelte';
	import ImmersionView from '$lib/components/play/ImmersionView.svelte';

	export let data: PageData;

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	let activeTab: 'learn' | 'games' | 'immerse' = 'learn';

	$: {
		const tabParam = $page.url.searchParams.get('tab');
		if (tabParam === 'games') {
			activeTab = 'games';
		} else if (tabParam === 'learn') {
			activeTab = 'learn';
		} else if (tabParam === 'immerse') {
			activeTab = 'immerse';
		}
	}
	let myGames = data.myGames;
	let communityGames = data.communityGames;
	let totalCommunityGames = data.totalCommunityGames || 0;
	let teacherClasses = data.teacherClasses;

	let currentCategory = 'All';
	const categories = ['All', 'Vocabulary', 'Grammar', 'Culture', 'Conversation', 'General'];
	let currentPage = 1;
	let loadingMore = false;

	async function loadGames(page = 1, append = false) {
		loadingMore = true;
		try {
			const res = await fetch(`/api/games?page=${page}&limit=10&category=${currentCategory}`);
			if (res.ok) {
				const json = await res.json();
				if (append) {
					communityGames = [...communityGames, ...json.games];
				} else {
					communityGames = json.games;
				}
				totalCommunityGames = json.pagination.total;
				currentPage = page;
			}
		} catch (error) {
			console.error("Failed to load games", error);
		} finally {
			loadingMore = false;
		}
	}

	function handleCategoryChange(category: string) {
		currentCategory = category;
		loadGames(1, false);
	}

	function loadMore() {
		loadGames(currentPage + 1, true);
	}

	// Modal state for selecting a class
	let showClassModal = false;
	let selectedGameIdForLive: string | null = null;

	// No longer dependent on classId in the URL
	$: canPlayLive = data.userRole === 'ADMIN' || data.userRole === 'TEACHER';

	async function startLiveSession(gameId: string, targetClassId: string) {
		try {
			const res = await fetch(`/api/classes/${targetClassId}/live-session`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start', gameId })
			});
			if (res.ok) {
				toast.success('Live session started! Students can now join.');
				window.location.href = `/classes/${targetClassId}/live/teacher`;
			} else {
				const err = await res.json();
				toast.error(err.error || 'Failed to start live session');
			}
		} catch (e) {
			toast.error('An error occurred');
		}
	}

	function handlePlayLive(gameId: string) {
		const urlClassId = $page.url.searchParams.get('classId');
		if (urlClassId) {
			startLiveSession(gameId, urlClassId);
			return;
		}

		if (teacherClasses.length === 0) {
			toast.error('You need to create a class first.');
			return;
		}

		if (teacherClasses.length === 1) {
			startLiveSession(gameId, teacherClasses[0].id);
		} else {
			selectedGameIdForLive = gameId;
			showClassModal = true;
		}
	}

	$: {
		myGames = data.myGames;
		communityGames = data.communityGames;
	}

	function getFlagEmoji(language: string) {
		if (!language) return '🌍';
		const lang = language.toLowerCase();
		if (lang === 'german' || lang === 'de') return '🇩🇪';
		if (lang === 'french' || lang === 'fr') return '🇫🇷';
		if (lang === 'spanish' || lang === 'es') return '🇪🇸';
		if (lang === 'english' || lang === 'en') return '🇺🇸';
		if (lang === 'italian' || lang === 'it') return '🇮🇹';
		if (lang === 'portuguese' || lang === 'pt') return '🇵🇹';
		if (lang === 'russian' || lang === 'ru') return '🇷🇺';
		if (lang === 'japanese' || lang === 'ja') return '🇯🇵';
		if (lang === 'korean' || lang === 'ko') return '🇰🇷';
		if (lang === 'chinese' || lang === 'zh') return '🇨🇳';
		return '🌍';
	}

	type GameMode = 'native-to-target' | 'target-to-native' | 'fill-blank' | 'multiple-choice' | 'chat';

	let englishFlag = '🇬🇧';

	onMount(async () => {
		try {
			if (
				'keyboard' in navigator &&
				typeof (navigator as any).keyboard?.getLayoutMap === 'function'
			) {
				const layoutMap = await (navigator as any).keyboard.getLayoutMap();
				// Keyboard Layout Map doesn't directly expose locale, but we can check navigator.language as primary signal
			}
		} catch {}
		// Fall back to navigator.language / navigator.languages
		const langs = [...(navigator.languages || []), navigator.language].map((l) => l.toLowerCase());
		if (langs.some((l) => l === 'en-us' || l.startsWith('en-us'))) {
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
	let gameMode: GameMode = data.cefrLevel === 'A1' ? 'multiple-choice' : 'native-to-target';
	let fillBlankAnswers: string[] = [];
	let selectedChoice: string | null = null;
	let shuffledChoices: string[] = [];
	let hasSubmittedMc = false;
	
	let currentLessonLanguage: any = null;
	$: lessonLanguage = currentLessonLanguage || data.language;

	// Assignment context
	const assignment = data.assignment ?? null;
	let assignmentProgress = data.assignmentScore
		? {
				score: data.assignmentScore.score,
				targetScore: assignment?.targetScore ?? 0,
				passed: data.assignmentScore.passed
			}
		: assignment
			? { score: 0, targetScore: assignment.targetScore, passed: false }
			: null;
	// Lock game mode to assignment's required mode when in assignment context
	if (assignment) {
		if (assignment.gamemode === 'immerse') {
			activeTab = 'immerse';
		} else {
			gameMode = (assignment.gamemode as GameMode) ?? gameMode;
		}
	}

	// Loading progress & cycling tips
	let loadProgressPct = 0;
	let loadTipIndex = 0;
	let estimatedLoadMs = 9000;
	let isLocalMode = false;
	let _loadProgressInterval: ReturnType<typeof setInterval> | null = null;
	let _loadTipInterval: ReturnType<typeof setInterval> | null = null;
	let expandedGrammarId: string | null = null;
	let showGrammarRef = false;

	function toggleGrammar(id: string) {
		expandedGrammarId = expandedGrammarId === id ? null : id;
	}

	const GENERAL_TIPS = [
		"Originally, LingoLearn was called 'LernenDeutsch' — but we let the other languages stick around!",
		'Spaced repetition (SRS) is proven to make vocabulary stick up to 3× faster.',
		'Reading just 15 minutes a day in your target language dramatically speeds up fluency.',
		'Context beats memorization — learning words in sentences helps retention by ~40%.',
		'The i+1 principle: you learn best when input is just slightly above your current level.',
		'Mistakes are part of the process — every error is your brain recalibrating.',
		'Listening to music in your target language is a fun way to absorb natural phrasing.',
		'Most polyglots agree: speaking on day one — even badly — accelerates learning.',
		'Thinking in your target language (even simple thoughts) builds fluency faster than translation.',
		'The forgetting curve shows you lose ~70% of new info in 24 hours without review.',
		'Writing by hand activates more brain regions than typing, boosting word retention.',
		"Immersion doesn't require travel — change your phone's language for instant practice.",
		'You need roughly 3,000 words to understand ~95% of everyday conversation in most languages.'
	];

	const LANG_TIPS: Record<string, string[]> = {
		German: [
			'All nouns in German are capitalized — even in the middle of a sentence.',
			"The word 'Schadenfreude' has no direct English equivalent: joy at others' misfortune.",
			"German compound nouns can be infinitely long — 'Donaudampfschifffahrtsgesellschaft' is a real word.",
			"'Fingerspitzengefühl' means 'fingertip feeling' — a delicate touch or sensitivity.",
			'German has formal (Sie) and informal (du) ways of addressing people.',
			'In German main clauses, the conjugated verb always sits in the second position.',
			"'Weltschmerz' meaning world-weariness was coined by Jean Paul, a German author.",
			'German and English share about 60% of their vocabulary roots.',
			'The German alphabet adds 4 extra letters: ä, ö, ü, and ß.',
			"'Doch' can contradict a negative question — like 'Oh yes it is!' in English.",
			'Modal verbs (können, müssen, dürfen…) push the main verb to the very end of the clause.',
			'German has 4 grammatical cases: Nominative, Accusative, Dative, and Genitive.',
			'German word order in subordinate clauses sends the verb to the very end.',
			"'Gemütlichkeit' describes a feeling of warmth, coziness, and belonging — untranslatable in English.",
			"The longest German word in everyday use is 'Rechtsschutzversicherungsgesellschaften' (legal insurance companies).",
			"German separable verbs split apart in main clauses — 'anfangen' becomes 'Ich fange an.'",
			"The German 'ch' sound doesn't exist in English — it's like a soft hiss from the roof of your mouth.",
			'In German, adjective endings change based on case, gender, and whether an article is present.',
			"'Kummerspeck' literally means 'grief bacon' — weight gained from emotional eating.",
			'German uses three genders: der (masculine), die (feminine), and das (neuter).',
			'The Dative case is used after prepositions like mit, bei, nach, seit, von, zu, and aus.'
		],
		Spanish: [
			'Spanish is the 2nd most spoken native language in the world with ~500 million speakers.',
			"Spanish has two verbs for 'to be': ser (permanent) and estar (temporary).",
			'In Spanish, nouns have grammatical gender — either masculine or feminine.',
			'The ¡ and ¿ marks at the start of sentences are unique to Spanish.',
			'Spanish is spoken in over 20 countries across 4 continents.',
			"The subjunctive mood in Spanish expresses doubt, wishes, and hypotheticals — and it's used constantly.",
			"'Sobremesa' is the time spent chatting at the table after a meal — there's no English word for it.",
			"Spanish 'll' and 'y' sound the same in most dialects — a phenomenon called yeísmo.",
			'The letter ñ is unique to Spanish and represents a palatal nasal sound.',
			"In Spanish, adjectives usually come after the noun: 'casa blanca' not 'blanca casa.'",
			"'Empalagar' means to feel sick from eating too much of something sweet.",
			'The Spanish Royal Academy (RAE) officially regulates the language since 1713.',
			'Spanish has about 10 million words, but you only need ~2,000 for everyday conversation.',
			"The word 'ojalá' comes from Arabic (inshallah) and means 'hopefully' or 'God willing.'",
			"Ser vs. estar: 'Estoy aburrido' = I am bored, but 'Soy aburrido' = I am boring!",
			"Spanish uses the personal 'a' before direct objects that are people: 'Veo a María.'",
			"'Madrugada' refers to the wee hours between midnight and dawn — a single word English lacks."
		],
		French: [
			'French has two genders for nouns: masculine and feminine.',
			'Adjectives in French usually come after the noun they describe.',
			'The letter "h" is usually silent in French.',
			'French is an official language in 29 countries across multiple continents.',
			'The cedilla (ç) changes the "c" sound from a hard "k" to a soft "s" before a, o, or u.',
			'Liaisons connect the final consonant of one word to the initial vowel of the next.',
			'Many English words end in -tion because they were borrowed directly from French.',
			'The word "voilà" means "there it is" or "here you go" and is widely used.',
			'French has distinct formal (vous) and informal (tu) pronouns for "you".',
			'Numbers from 70 to 99 are counted in a unique way in French (e.g., 80 is quatre-vingts, or four twenties).'
		]
	};

	let loadingTips: string[] = [];

	$: {
		const langName = lessonLanguage?.name;
		const specificTips = langName && LANG_TIPS[langName] ? LANG_TIPS[langName] : [];
		loadingTips = [...specificTips, ...GENERAL_TIPS];
	}

	// User level tracking (populated from page data and updated from lesson metadata)
	let userLevel = data.cefrLevel || 'A1';
	let isAbsoluteBeginner = data.cefrLevel === 'A1';

	// AbortControllers for in-flight API requests
	let generateController: AbortController | null = null;
	let submitController: AbortController | null = null;

	function stopLoadingIntervals() {
		if (_loadProgressInterval) {
			clearInterval(_loadProgressInterval);
			_loadProgressInterval = null;
		}
		if (_loadTipInterval) {
			clearInterval(_loadTipInterval);
			_loadTipInterval = null;
		}
	}

	function cancelAllRequests() {
		if (generateController) {
			generateController.abort();
			generateController = null;
		}
		if (submitController) {
			submitController.abort();
			submitController = null;
		}
		stopLoadingIntervals();
	}

	onDestroy(() => {
		cancelAllRequests();
	});

	// Map of common German inflected/contracted forms → { lemma, note }
	// This enables tooltips on conjugated verbs, contractions, etc.
	const GERMAN_INFLECTION_MAP: Record<string, { lemma: string; note: string }> = {
		// sein (to be) conjugations
		bin: { lemma: 'sein', note: 'ich bin (I am)' },
		bist: { lemma: 'sein', note: 'du bist (you are)' },
		ist: { lemma: 'sein', note: 'er/sie/es ist (he/she/it is)' },
		sind: { lemma: 'sein', note: 'wir/sie/Sie sind (we/they are)' },
		seid: { lemma: 'sein', note: 'ihr seid (you all are)' },
		war: { lemma: 'sein', note: 'ich/er war (I/he was)' },
		warst: { lemma: 'sein', note: 'du warst (you were)' },
		waren: { lemma: 'sein', note: 'wir/sie waren (we/they were)' },
		wart: { lemma: 'sein', note: 'ihr wart (you all were)' },
		gewesen: { lemma: 'sein', note: 'past participle of sein' },
		// haben (to have) conjugations
		habe: { lemma: 'haben', note: 'ich habe (I have)' },
		hast: { lemma: 'haben', note: 'du hast (you have)' },
		hat: { lemma: 'haben', note: 'er/sie/es hat (he/she/it has)' },
		habt: { lemma: 'haben', note: 'ihr habt (you all have)' },
		hatte: { lemma: 'haben', note: 'ich/er hatte (I/he had)' },
		hattest: { lemma: 'haben', note: 'du hattest (you had)' },
		hatten: { lemma: 'haben', note: 'wir/sie hatten (we/they had)' },
		hattet: { lemma: 'haben', note: 'ihr hattet (you all had)' },
		gehabt: { lemma: 'haben', note: 'past participle of haben' },
		// werden (to become) conjugations
		werde: { lemma: 'werden', note: 'ich werde (I become/will)' },
		wirst: { lemma: 'werden', note: 'du wirst (you become/will)' },
		wird: { lemma: 'werden', note: 'er/sie/es wird (becomes/will)' },
		werdet: { lemma: 'werden', note: 'ihr werdet (you all become/will)' },
		wurde: { lemma: 'werden', note: 'ich/er wurde (became/was)' },
		wurdest: { lemma: 'werden', note: 'du wurdest (you became)' },
		wurden: { lemma: 'werden', note: 'wir/sie wurden (became/were)' },
		geworden: { lemma: 'werden', note: 'past participle of werden' },
		// können (can) conjugations
		kann: { lemma: 'können', note: 'ich/er kann (I/he can)' },
		kannst: { lemma: 'können', note: 'du kannst (you can)' },
		könnt: { lemma: 'können', note: 'ihr könnt (you all can)' },
		konnte: { lemma: 'können', note: 'ich/er konnte (could)' },
		konntest: { lemma: 'können', note: 'du konntest (you could)' },
		konnten: { lemma: 'können', note: 'wir/sie konnten (could)' },
		gekonnt: { lemma: 'können', note: 'past participle of können' },
		// müssen (must) conjugations
		muss: { lemma: 'müssen', note: 'ich/er muss (I/he must)' },
		musst: { lemma: 'müssen', note: 'du musst (you must)' },
		müsst: { lemma: 'müssen', note: 'ihr müsst (you all must)' },
		musste: { lemma: 'müssen', note: 'ich/er musste (had to)' },
		musstest: { lemma: 'müssen', note: 'du musstest (you had to)' },
		mussten: { lemma: 'müssen', note: 'wir/sie mussten (had to)' },
		gemusst: { lemma: 'müssen', note: 'past participle of müssen' },
		// wollen (to want) conjugations
		will: { lemma: 'wollen', note: 'ich/er will (I/he want(s))' },
		willst: { lemma: 'wollen', note: 'du willst (you want)' },
		wollt: { lemma: 'wollen', note: 'ihr wollt (you all want)' },
		wollte: { lemma: 'wollen', note: 'ich/er wollte (wanted)' },
		wolltest: { lemma: 'wollen', note: 'du wolltest (you wanted)' },
		wollten: { lemma: 'wollen', note: 'wir/sie wollten (wanted)' },
		gewollt: { lemma: 'wollen', note: 'past participle of wollen' },
		// sollen (should) conjugations
		soll: { lemma: 'sollen', note: 'ich/er soll (I/he should)' },
		sollst: { lemma: 'sollen', note: 'du sollst (you should)' },
		sollt: { lemma: 'sollen', note: 'ihr sollt (you all should)' },
		sollte: { lemma: 'sollen', note: 'ich/er sollte (should)' },
		solltest: { lemma: 'sollen', note: 'du solltest (you should)' },
		sollten: { lemma: 'sollen', note: 'wir/sie sollten (should)' },
		gesollt: { lemma: 'sollen', note: 'past participle of sollen' },
		// dürfen (may) conjugations
		darf: { lemma: 'dürfen', note: 'ich/er darf (I/he may)' },
		darfst: { lemma: 'dürfen', note: 'du darfst (you may)' },
		dürft: { lemma: 'dürfen', note: 'ihr dürft (you all may)' },
		durfte: { lemma: 'dürfen', note: 'ich/er durfte (was allowed)' },
		durftest: { lemma: 'dürfen', note: 'du durftest (you were allowed)' },
		durften: { lemma: 'dürfen', note: 'wir/sie durften (were allowed)' },
		gedurft: { lemma: 'dürfen', note: 'past participle of dürfen' },
		// mögen/möchten
		mag: { lemma: 'mögen', note: 'ich/er mag (I/he like(s))' },
		magst: { lemma: 'mögen', note: 'du magst (you like)' },
		mögt: { lemma: 'mögen', note: 'ihr mögt (you all like)' },
		mochte: { lemma: 'mögen', note: 'ich/er mochte (liked)' },
		möchte: { lemma: 'mögen', note: 'ich/er möchte (would like)' },
		möchtest: { lemma: 'mögen', note: 'du möchtest (you would like)' },
		möchten: { lemma: 'mögen', note: 'wir/sie möchten (would like)' },
		möchtet: { lemma: 'mögen', note: 'ihr möchtet (you all would like)' },
		// wissen (to know)
		weiß: { lemma: 'wissen', note: 'ich/er weiß (I/he know(s))' },
		weißt: { lemma: 'wissen', note: 'du weißt (you know)' },
		wisst: { lemma: 'wissen', note: 'ihr wisst (you all know)' },
		wusste: { lemma: 'wissen', note: 'ich/er wusste (knew)' },
		wusstest: { lemma: 'wissen', note: 'du wusstest (you knew)' },
		wussten: { lemma: 'wissen', note: 'wir/sie wussten (knew)' },
		gewusst: { lemma: 'wissen', note: 'past participle of wissen' },
		// geben (to give)
		gibt: { lemma: 'geben', note: 'er/sie/es gibt (gives); es gibt (there is/are)' },
		gab: { lemma: 'geben', note: 'ich/er gab (gave)' },
		gabst: { lemma: 'geben', note: 'du gabst (you gave)' },
		gaben: { lemma: 'geben', note: 'wir/sie gaben (gave)' },
		gegeben: { lemma: 'geben', note: 'past participle of geben' },
		// fahren (to drive/go)
		fährt: { lemma: 'fahren', note: 'er/sie/es fährt (drives)' },
		fährst: { lemma: 'fahren', note: 'du fährst (you drive)' },
		fuhr: { lemma: 'fahren', note: 'ich/er fuhr (drove)' },
		gefahren: { lemma: 'fahren', note: 'past participle of fahren' },
		// sprechen (to speak)
		spricht: { lemma: 'sprechen', note: 'er/sie/es spricht (speaks)' },
		sprichst: { lemma: 'sprechen', note: 'du sprichst (you speak)' },
		sprach: { lemma: 'sprechen', note: 'ich/er sprach (spoke)' },
		gesprochen: { lemma: 'sprechen', note: 'past participle of sprechen' },
		// sehen (to see)
		sieht: { lemma: 'sehen', note: 'er/sie/es sieht (sees)' },
		siehst: { lemma: 'sehen', note: 'du siehst (you see)' },
		sah: { lemma: 'sehen', note: 'ich/er sah (saw)' },
		gesehen: { lemma: 'sehen', note: 'past participle of sehen' },
		// lesen (to read)
		liest: { lemma: 'lesen', note: 'er/sie/du liest (reads/you read)' },
		las: { lemma: 'lesen', note: 'ich/er las (read)' },
		gelesen: { lemma: 'lesen', note: 'past participle of lesen' },
		// essen (to eat)
		isst: { lemma: 'essen', note: 'er/sie/du isst (eats/you eat)' },
		aß: { lemma: 'essen', note: 'ich/er aß (ate)' },
		gegessen: { lemma: 'essen', note: 'past participle of essen' },
		// nehmen (to take)
		nimmt: { lemma: 'nehmen', note: 'er/sie/es nimmt (takes)' },
		nimmst: { lemma: 'nehmen', note: 'du nimmst (you take)' },
		nahm: { lemma: 'nehmen', note: 'ich/er nahm (took)' },
		genommen: { lemma: 'nehmen', note: 'past participle of nehmen' },
		// kommen (to come)
		kommt: { lemma: 'kommen', note: 'er/sie/es kommt (comes)' },
		kam: { lemma: 'kommen', note: 'ich/er kam (came)' },
		gekommen: { lemma: 'kommen', note: 'past participle of kommen' },
		// gehen (to go)
		geht: { lemma: 'gehen', note: 'er/sie/es geht (goes)' },
		ging: { lemma: 'gehen', note: 'ich/er ging (went)' },
		gegangen: { lemma: 'gehen', note: 'past participle of gehen' },
		// stehen (to stand)
		steht: { lemma: 'stehen', note: 'er/sie/es steht (stands)' },
		stand: { lemma: 'stehen', note: 'ich/er stand (stood)' },
		gestanden: { lemma: 'stehen', note: 'past participle of stehen' },
		// finden (to find)
		findet: { lemma: 'finden', note: 'er/sie/es findet (finds)' },
		fand: { lemma: 'finden', note: 'ich/er fand (found)' },
		gefunden: { lemma: 'finden', note: 'past participle of finden' },
		// tun (to do)
		tut: { lemma: 'tun', note: 'er/sie/es tut (does)' },
		tat: { lemma: 'tun', note: 'ich/er tat (did)' },
		getan: { lemma: 'tun', note: 'past participle of tun' },
		// laufen (to run)
		läuft: { lemma: 'laufen', note: 'er/sie/es läuft (runs)' },
		läufst: { lemma: 'laufen', note: 'du läufst (you run)' },
		lief: { lemma: 'laufen', note: 'ich/er lief (ran)' },
		gelaufen: { lemma: 'laufen', note: 'past participle of laufen' },
		// schlafen (to sleep)
		schläft: { lemma: 'schlafen', note: 'er/sie/es schläft (sleeps)' },
		schläfst: { lemma: 'schlafen', note: 'du schläfst (you sleep)' },
		schlief: { lemma: 'schlafen', note: 'ich/er schlief (slept)' },
		geschlafen: { lemma: 'schlafen', note: 'past participle of schlafen' },
		// tragen (to carry/wear)
		trägt: { lemma: 'tragen', note: 'er/sie/es trägt (carries/wears)' },
		trägst: { lemma: 'tragen', note: 'du trägst (you carry/wear)' },
		// heißen (to be called)
		heiße: { lemma: 'heißen', note: 'ich heiße (I am called)' },
		heißt: { lemma: 'heißen', note: 'du/er heißt (you are/is called)' },

		// Preposition + article contractions
		am: { lemma: 'an', note: 'am = an + dem (at/on the)' },
		ans: { lemma: 'an', note: 'ans = an + das (to/onto the)' },
		im: { lemma: 'in', note: 'im = in + dem (in the)' },
		ins: { lemma: 'in', note: 'ins = in + das (into the)' },
		zum: { lemma: 'zu', note: 'zum = zu + dem (to the, masc./neut.)' },
		zur: { lemma: 'zu', note: 'zur = zu + der (to the, fem.)' },
		vom: { lemma: 'von', note: 'vom = von + dem (from the)' },
		beim: { lemma: 'bei', note: 'beim = bei + dem (at/by the)' },
		aufs: { lemma: 'auf', note: 'aufs = auf + das (onto the)' },
		fürs: { lemma: 'für', note: 'fürs = für + das (for the)' },
		durchs: { lemma: 'durch', note: 'durchs = durch + das (through the)' },
		ums: { lemma: 'um', note: 'ums = um + das (around the)' },
		übers: { lemma: 'über', note: 'übers = über + das (over the)' },
		unters: { lemma: 'unter', note: 'unters = unter + das (under the)' },
		hinters: { lemma: 'hinter', note: 'hinters = hinter + das (behind the)' },
		vors: { lemma: 'vor', note: 'vors = vor + das (in front of the)' }
	};

	// Map of common French inflected/contracted forms
	const FRENCH_INFLECTION_MAP: Record<string, { lemma: string; note: string }> = {
		// être (to be)
		suis: { lemma: 'être', note: 'je suis (I am)' },
		es: { lemma: 'être', note: 'tu es (you are)' },
		est: { lemma: 'être', note: 'il/elle/on est (he/she/it is)' },
		sommes: { lemma: 'être', note: 'nous sommes (we are)' },
		êtes: { lemma: 'être', note: 'vous êtes (you all are)' },
		sont: { lemma: 'être', note: 'ils/elles sont (they are)' },
		étais: { lemma: 'être', note: "j'/tu étais (I/you was/were)" },
		était: { lemma: 'être', note: 'il/elle était (was)' },
		étions: { lemma: 'être', note: 'nous étions (we were)' },
		étiez: { lemma: 'être', note: 'vous étiez (you all were)' },
		étaient: { lemma: 'être', note: 'ils/elles étaient (they were)' },
		serai: { lemma: 'être', note: 'je serai (I will be)' },
		seras: { lemma: 'être', note: 'tu seras (you will be)' },
		sera: { lemma: 'être', note: 'il/elle sera (will be)' },
		serons: { lemma: 'être', note: 'nous serons (we will be)' },
		serez: { lemma: 'être', note: 'vous serez (you all will be)' },
		seront: { lemma: 'être', note: 'ils/elles seront (they will be)' },
		sois: { lemma: 'être', note: 'je/tu sois (subjunctive)' },
		soit: { lemma: 'être', note: 'il/elle soit (subjunctive)' },
		soyons: { lemma: 'être', note: 'nous soyons (subjunctive)' },
		soyez: { lemma: 'être', note: 'vous soyez (subjunctive)' },
		soient: { lemma: 'être', note: 'ils/elles soient (subjunctive)' },
		été: { lemma: 'être', note: 'past participle of être' },

		// avoir (to have)
		ai: { lemma: 'avoir', note: "j'ai (I have)" },
		as: { lemma: 'avoir', note: 'tu as (you have)' },
		a: { lemma: 'avoir', note: 'il/elle a (he/she/it has)' },
		avons: { lemma: 'avoir', note: 'nous avons (we have)' },
		avez: { lemma: 'avoir', note: 'vous avez (you all have)' },
		ont: { lemma: 'avoir', note: 'ils/elles ont (they have)' },
		avais: { lemma: 'avoir', note: "j'/tu avais (I/you had)" },
		avait: { lemma: 'avoir', note: 'il/elle avait (had)' },
		avions: { lemma: 'avoir', note: 'nous avions (we had)' },
		aviez: { lemma: 'avoir', note: 'vous aviez (you all had)' },
		avaient: { lemma: 'avoir', note: 'ils/elles avaient (they had)' },
		aurai: { lemma: 'avoir', note: "j'aurai (I will have)" },
		auras: { lemma: 'avoir', note: 'tu auras (you will have)' },
		aura: { lemma: 'avoir', note: 'il/elle aura (will have)' },
		aurons: { lemma: 'avoir', note: 'nous aurons (we will have)' },
		aurez: { lemma: 'avoir', note: 'vous aurez (you all will have)' },
		auront: { lemma: 'avoir', note: 'ils/elles auront (they will have)' },
		aie: { lemma: 'avoir', note: "j'/tu aie (subjunctive)" },
		ait: { lemma: 'avoir', note: 'il/elle ait (subjunctive)' },
		ayons: { lemma: 'avoir', note: 'nous ayons (subjunctive)' },
		ayez: { lemma: 'avoir', note: 'vous ayez (subjunctive)' },
		aient: { lemma: 'avoir', note: 'ils/elles aient (subjunctive)' },
		eu: { lemma: 'avoir', note: 'past participle of avoir' },

		// aller (to go)
		vais: { lemma: 'aller', note: 'je vais (I go/am going)' },
		vas: { lemma: 'aller', note: 'tu vas (you go)' },
		va: { lemma: 'aller', note: 'il/elle va (goes)' },
		allons: { lemma: 'aller', note: 'nous allons (we go)' },
		allez: { lemma: 'aller', note: 'vous allez (you all go)' },
		vont: { lemma: 'aller', note: 'ils/elles vont (they go)' },
		allais: { lemma: 'aller', note: "j'/tu allais (went/was going)" },
		allait: { lemma: 'aller', note: 'il/elle allait (went/was going)' },
		allions: { lemma: 'aller', note: 'nous allions (went/were going)' },
		alliez: { lemma: 'aller', note: 'vous alliez (went/were going)' },
		allaient: { lemma: 'aller', note: 'ils/elles allaient (went/were going)' },
		irai: { lemma: 'aller', note: "j'irai (I will go)" },
		iras: { lemma: 'aller', note: 'tu iras (you will go)' },
		ira: { lemma: 'aller', note: 'il/elle ira (will go)' },
		irons: { lemma: 'aller', note: 'nous irons (we will go)' },
		irez: { lemma: 'aller', note: 'vous irez (you all will go)' },
		iront: { lemma: 'aller', note: 'ils/elles iront (they will go)' },
		allé: { lemma: 'aller', note: 'past participle of aller' },

		// faire (to do/make)
		fais: { lemma: 'faire', note: 'je/tu fais (do/make)' },
		fait: { lemma: 'faire', note: 'il/elle fait (does/makes)' },
		faisons: { lemma: 'faire', note: 'nous faisons (we do/make)' },
		faites: { lemma: 'faire', note: 'vous faites (you all do/make)' },
		font: { lemma: 'faire', note: 'ils/elles font (they do/make)' },
		faisais: { lemma: 'faire', note: 'je/tu faisais (did/was doing)' },
		faisait: { lemma: 'faire', note: 'il/elle faisait (did/was doing)' },
		faisions: { lemma: 'faire', note: 'nous faisions (did/were doing)' },
		faisiez: { lemma: 'faire', note: 'vous faisiez (did/were doing)' },
		faisaient: { lemma: 'faire', note: 'ils/elles faisaient (did/were doing)' },
		ferai: { lemma: 'faire', note: 'je ferai (I will do)' },
		feras: { lemma: 'faire', note: 'tu feras (you will do)' },
		fera: { lemma: 'faire', note: 'il/elle fera (will do)' },
		ferons: { lemma: 'faire', note: 'nous ferons (we will do)' },
		ferez: { lemma: 'faire', note: 'vous ferez (you all will do)' },
		feront: { lemma: 'faire', note: 'ils/elles feront (they will do)' },
		faite: { lemma: 'faire', note: 'past participle of faire (feminine)' },

		// pouvoir (can/be able to)
		peux: { lemma: 'pouvoir', note: 'je/tu peux (can)' },
		peut: { lemma: 'pouvoir', note: 'il/elle peut (can)' },
		pouvons: { lemma: 'pouvoir', note: 'nous pouvons (we can)' },
		pouvez: { lemma: 'pouvoir', note: 'vous pouvez (you all can)' },
		peuvent: { lemma: 'pouvoir', note: 'ils/elles peuvent (they can)' },
		pouvais: { lemma: 'pouvoir', note: 'je/tu pouvais (could/was able)' },
		pouvait: { lemma: 'pouvoir', note: 'il/elle pouvait (could/was able)' },
		pouvions: { lemma: 'pouvoir', note: 'nous pouvions (could/were able)' },
		pouviez: { lemma: 'pouvoir', note: 'vous pouviez (could/were able)' },
		pouvaient: { lemma: 'pouvoir', note: 'ils/elles pouvaient (could/were able)' },
		pourrai: { lemma: 'pouvoir', note: 'je pourrai (I will be able)' },
		pourras: { lemma: 'pouvoir', note: 'tu pourras (you will be able)' },
		pourra: { lemma: 'pouvoir', note: 'il/elle pourra (will be able)' },
		pourrons: { lemma: 'pouvoir', note: 'nous pourrons (we will be able)' },
		pourrez: { lemma: 'pouvoir', note: 'vous pourrez (you all will be able)' },
		pourront: { lemma: 'pouvoir', note: 'ils/elles pourront (they will be able)' },
		pu: { lemma: 'pouvoir', note: 'past participle of pouvoir' },

		// vouloir (to want)
		veux: { lemma: 'vouloir', note: 'je/tu veux (want)' },
		veut: { lemma: 'vouloir', note: 'il/elle veut (wants)' },
		voulons: { lemma: 'vouloir', note: 'nous voulons (we want)' },
		voulez: { lemma: 'vouloir', note: 'vous voulez (you all want)' },
		veulent: { lemma: 'vouloir', note: 'ils/elles veulent (they want)' },
		voulais: { lemma: 'vouloir', note: 'je/tu voulais (wanted/was wanting)' },
		voulait: { lemma: 'vouloir', note: 'il/elle voulait (wanted/was wanting)' },
		voulions: { lemma: 'vouloir', note: 'nous voulions (wanted/were wanting)' },
		vouliez: { lemma: 'vouloir', note: 'vous vouliez (wanted/were wanting)' },
		voulaient: { lemma: 'vouloir', note: 'ils/elles voulaient (wanted/were wanting)' },
		voudrai: { lemma: 'vouloir', note: 'je voudrai (I will want)' },
		voudras: { lemma: 'vouloir', note: 'tu voudras (you will want)' },
		voudra: { lemma: 'vouloir', note: 'il/elle voudra (will want)' },
		voudrons: { lemma: 'vouloir', note: 'nous voudrons (we will want)' },
		voudrez: { lemma: 'vouloir', note: 'vous voudrez (you all will want)' },
		voudront: { lemma: 'vouloir', note: 'ils/elles voudront (they will want)' },
		voulu: { lemma: 'vouloir', note: 'past participle of vouloir' },

		// Contractions
		au: { lemma: 'à', note: 'au = à + le (to the / at the)' },
		aux: { lemma: 'à', note: 'aux = à + les (to the / at the, plural)' },
		du: { lemma: 'de', note: 'du = de + le (of the / from the)' },
		des: { lemma: 'de', note: 'des = de + les (of the / from the, plural)' }
	};

	// Map of common French article forms
	const FRENCH_ARTICLE_MAP: Record<string, { definite: boolean; forms: ArticleForm[] }> = {
		le: { definite: true, forms: [{ caseLabel: 'Masc. Sing.', nomArticle: 'le' }] },
		la: { definite: true, forms: [{ caseLabel: 'Fem. Sing.', nomArticle: 'la' }] },
		les: { definite: true, forms: [{ caseLabel: 'Plural', nomArticle: 'les' }] },
		un: { definite: false, forms: [{ caseLabel: 'Masc. Sing.', nomArticle: 'un' }] },
		une: { definite: false, forms: [{ caseLabel: 'Fem. Sing.', nomArticle: 'une' }] },
		des: { definite: false, forms: [{ caseLabel: 'Plural', nomArticle: 'des' }] }
	};

	// Maps Prisma Gender enum values to German/French article strings
	function genderToArticle(
		gender: string | null | undefined,
		lang: string = 'German'
	): string | null {
		if (!gender) return null;
		const g = gender.toUpperCase();
		if (lang === 'French') {
			if (g === 'MASCULINE' || g === 'LE') return 'le';
			if (g === 'FEMININE' || g === 'LA') return 'la';
			return null;
		} else {
			// default to German logic
			if (g === 'MASCULINE' || g === 'DER') return 'der';
			if (g === 'FEMININE' || g === 'DIE') return 'die';
			if (g === 'NEUTER' || g === 'DAS') return 'das';
			return null;
		}
	}

	// German article forms → case + gender info for building smart tooltips
	// Each entry has: definite/indefinite flag, an array of possible {caseLabel, nominativeArticle} combos
	type ArticleForm = { caseLabel: string; nomArticle: string };
	const GERMAN_ARTICLE_MAP: Record<string, { definite: boolean; forms: ArticleForm[] }> = {
		// Definite articles
		der: {
			definite: true,
			forms: [
				{ caseLabel: 'Nom. Masc.', nomArticle: 'der' },
				{ caseLabel: 'Dat. Fem.', nomArticle: 'die' },
				{ caseLabel: 'Gen. Fem.', nomArticle: 'die' }
			]
		},
		die: {
			definite: true,
			forms: [
				{ caseLabel: 'Nom./Acc. Fem.', nomArticle: 'die' },
				{ caseLabel: 'Nom./Acc. Plural', nomArticle: 'die' }
			]
		},
		das: { definite: true, forms: [{ caseLabel: 'Nom./Acc. Neut.', nomArticle: 'das' }] },
		den: {
			definite: true,
			forms: [
				{ caseLabel: 'Acc. Masc.', nomArticle: 'der' },
				{ caseLabel: 'Dat. Plural', nomArticle: 'die' }
			]
		},
		dem: {
			definite: true,
			forms: [
				{ caseLabel: 'Dat. Masc.', nomArticle: 'der' },
				{ caseLabel: 'Dat. Neut.', nomArticle: 'das' }
			]
		},
		des: {
			definite: true,
			forms: [
				{ caseLabel: 'Gen. Masc.', nomArticle: 'der' },
				{ caseLabel: 'Gen. Neut.', nomArticle: 'das' }
			]
		},
		// Indefinite articles
		ein: {
			definite: false,
			forms: [
				{ caseLabel: 'Nom. Masc.', nomArticle: 'der' },
				{ caseLabel: 'Nom./Acc. Neut.', nomArticle: 'das' }
			]
		},
		eine: { definite: false, forms: [{ caseLabel: 'Nom./Acc. Fem.', nomArticle: 'die' }] },
		einen: { definite: false, forms: [{ caseLabel: 'Acc. Masc.', nomArticle: 'der' }] },
		einem: { definite: false, forms: [{ caseLabel: 'Dat. Masc./Neut.', nomArticle: 'der' }] },
		einer: {
			definite: false,
			forms: [
				{ caseLabel: 'Dat./Gen. Fem.', nomArticle: 'die' },
				{ caseLabel: 'Gen. Masc./Neut.', nomArticle: 'der' }
			]
		},
		eines: { definite: false, forms: [{ caseLabel: 'Gen. Masc./Neut.', nomArticle: 'der' }] },
		// Negative articles (kein/keine/...)
		kein: {
			definite: false,
			forms: [
				{ caseLabel: 'Nom. Masc.', nomArticle: 'der' },
				{ caseLabel: 'Nom./Acc. Neut.', nomArticle: 'das' }
			]
		},
		keine: { definite: false, forms: [{ caseLabel: 'Nom./Acc. Fem./Pl.', nomArticle: 'die' }] },
		keinen: { definite: false, forms: [{ caseLabel: 'Acc. Masc.', nomArticle: 'der' }] },
		keinem: { definite: false, forms: [{ caseLabel: 'Dat. Masc./Neut.', nomArticle: 'der' }] },
		keiner: { definite: false, forms: [{ caseLabel: 'Dat./Gen. Fem.', nomArticle: 'die' }] },
		keines: { definite: false, forms: [{ caseLabel: 'Gen. Masc./Neut.', nomArticle: 'der' }] }
	};

	function buildTooltipHtml(vocab: any, overrideArticle?: string, inflectionNote?: string): string {
		const isNoun = vocab.partOfSpeech?.toLowerCase() === 'noun';
		const lemmaDisplay = isNoun
			? vocab.lemma.charAt(0).toUpperCase() + vocab.lemma.slice(1)
			: vocab.lemma;

		const activeLanguageName = lessonLanguage?.name || 'German';
		const genderDisplay = genderToArticle(vocab.gender, activeLanguageName);
		const isAiGenerated = typeof vocab.id === 'string' && vocab.id.startsWith('ai_');
		let html = `<span class="word-tooltip">`;
		html += `<span class="word-tooltip-header">${overrideArticle ?? lemmaDisplay}${isAiGenerated ? '<span class="word-tooltip-ai-badge">AI</span>' : ''}</span>`;
		html += `<span class="word-tooltip-body">`;

		if (inflectionNote) {
			html += `<span class="word-tooltip-row"><strong>Form:</strong> ${inflectionNote}</span>`;
		}
		if (overrideArticle) {
			html += `<span class="word-tooltip-row"><strong>Noun:</strong> ${lemmaDisplay}</span>`;
			if (genderDisplay)
				html += `<span class="word-tooltip-row"><strong>Gender:</strong> ${genderDisplay}</span>`;
		} else {
			if (vocab.partOfSpeech)
				html += `<span class="word-tooltip-row"><strong>POS:</strong> ${vocab.partOfSpeech}</span>`;
			if (isNoun && genderDisplay)
				html += `<span class="word-tooltip-row"><strong>Gender:</strong> ${genderDisplay}</span>`;
		}
		if (vocab.plural)
			html += `<span class="word-tooltip-row"><strong>Plural:</strong> ${vocab.plural}</span>`;
		
		const displayMeaning = vocab.meaning || vocab.meanings?.[0]?.value;
		if (displayMeaning)
			html += `<span class="word-tooltip-row"><strong>Meaning:</strong> ${displayMeaning}</span>`;
		html += `</span></span>`;
		return html;
	}

	function getBasicStems(word: string): string[] {
		const stems: string[] = [];
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
			if (word.length >= suffix.length + 2 && word.endsWith(suffix)) {
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
		if (word.endsWith('ves') && word.length > 4)
			stems.push(word.slice(0, -3) + 'f', word.slice(0, -3) + 'fe');
		if (
			word.endsWith('ses') ||
			word.endsWith('xes') ||
			word.endsWith('zes') ||
			word.endsWith('ches') ||
			word.endsWith('shes')
		) {
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

	function levenshteinDistance(a: string, b: string): number {
		const s1 = a;
		const s2 = b;
		if (s1.length === 0) return s2.length;
		if (s2.length === 0) return s1.length;
		const matrix: (number | null)[][] = Array(s2.length + 1)
			.fill(null)
			.map(() => Array(s1.length + 1).fill(null));
		for (let i = 0; i <= s1.length; i += 1) matrix[0][i] = i;
		for (let j = 0; j <= s2.length; j += 1) matrix[j][0] = j;
		for (let j = 1; j <= s2.length; j += 1) {
			for (let i = 1; i <= s1.length; i += 1) {
				const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
				matrix[j][i] = Math.min(
					(matrix[j][i - 1] as number) + 1,
					(matrix[j - 1][i] as number) + 1,
					(matrix[j - 1][i - 1] as number) + indicator
				);
			}
		}
		return matrix[s2.length][s1.length] as number;
	}

	function buildVocabMap(): Map<string, any[]> {
		const map = new Map<string, any[]>();
		const isEnToDe = challenge?.gameMode === 'native-to-target';

		const add = (key: string, v: any) => {
			if (!key) return;
			if (!map.has(key)) map.set(key, []);
			// Avoid duplicate entries
			if (!map.get(key)!.some((existing) => existing.id === v.id)) {
				map.get(key)!.push(v);
			}
		};

		for (const v of challenge?.allVocabulary || []) {
			add(v.lemma.toLowerCase(), v);
			const meaningsStr = v.meaning || v.meanings?.[0]?.value;
			if (isEnToDe && meaningsStr) {
				for (const m of meaningsStr.split(',')) {
					add(m.trim().toLowerCase(), v);
				}
			}
		}
		for (const v of challenge?.targetedVocabulary || []) {
			add(v.lemma.toLowerCase(), v);
			const meaningsStr = v.meaning || v.meanings?.[0]?.value;
			if (isEnToDe && meaningsStr) {
				for (const m of meaningsStr.split(',')) {
					add(m.trim().toLowerCase(), v);
				}
			}
		}
		return map;
	}

	function parseTextWithTooltips(
		text: string,
		isTargetedVocab: boolean,
		stillStreaming: boolean = false
	): string {
		const vocabMap = buildVocabMap();
		const isDeToEn = challenge.gameMode === 'target-to-native';
		// Whether this text is German (to enable article case tooltips)
		const mode = challenge.gameMode as string;
		const isGermanText =
			mode === 'fill-blank'
				? true
				: mode === 'target-to-native'
					? isTargetedVocab
					: mode === 'native-to-target'
						? !isTargetedVocab
						: mode === 'multiple-choice'
							? isTargetedVocab
							: false;

		// Step 1: Replace <vocab> tags with placeholders to protect them
		const vocabReplacements: string[] = [];
		text = text.replace(
			/<vocab(?:\s+[^>]*)?id="([^"]+)"(?:[^>]*)?>([^<]*)<\/vocab>/g,
			(_match: string, id: string, word: string) => {
				const vocab = challenge.targetedVocabulary?.find((v: any) => v.id === id) 
					|| challenge.allVocabulary?.find((v: any) => v.id === id);
				const tooltipHtml = vocab ? buildTooltipHtml(vocab) : '';
				const replacement = `<span class="vocab-highlight tooltip-trigger">${word}${tooltipHtml}</span>`;
				vocabReplacements.push(replacement);
				return `\x00VOCAB_${vocabReplacements.length - 1}\x00`;
			}
		);

		// Clean up incomplete tags from streaming
		text = text.replace(/<vocab[^>]*>|<\/vocab>|<vocab[^>]*$/g, '');

		const isEnToDe = challenge.gameMode === 'native-to-target';
		const englishArticles = new Set(['the', 'a', 'an']);

		// Helper: find vocab entry for a cleaned word
		// Returns { vocab, inflectionNote? } or null
		function findVocab(
			cleanWord: string,
			originalToken: string = ''
		): { vocab: any; inflectionNote?: string } | null {
			const pickBest = (list: any[] | undefined) => {
				if (!list || list.length === 0) return null;
				if (list.length === 1) return list[0];

				// In German, nouns are always capitalized.
				// For other languages (or English), we shouldn't use capitalization to heavily bias towards nouns,
				// except maybe to deprioritize nouns if lowercase (but wait, in French/Spanish, nouns are lowercase!).
				// So ONLY apply this capitalization logic if the text we are parsing is German.
				const activeLanguageName = lessonLanguage?.name || 'German';
				const parsingGerman = isGermanText && activeLanguageName === 'German';

				if (parsingGerman) {
					const isCapitalized = /^[A-ZÄÖÜ]/.test(originalToken.replace(/^[¿¡"'({\[]+/, ''));
					if (isCapitalized) {
						const noun = list.find((v) => v.partOfSpeech?.toLowerCase() === 'noun');
						if (noun) return noun;
					} else {
						const nonNoun = list.find((v) => v.partOfSpeech?.toLowerCase() !== 'noun');
						if (nonNoun) return nonNoun;
					}
				}

				return list[0]; // fallback
			};

			let vocab = pickBest(vocabMap.get(cleanWord));
			if (vocab) return { vocab };

			// Check the inflection map for conjugations/contractions
			if (!isEnToDe) {
				const activeLanguageName = lessonLanguage?.name || 'German';
				const mapToUse =
					activeLanguageName === 'French' ? FRENCH_INFLECTION_MAP : GERMAN_INFLECTION_MAP;

				const inflection = mapToUse[cleanWord];
				if (inflection) {
					vocab = pickBest(vocabMap.get(inflection.lemma.toLowerCase()));
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
				vocab = pickBest(vocabMap.get(stem));
				if (vocab) return { vocab };
			}

			// Fallback: Fuzzy search over all keys in vocabMap
			if (cleanWord.length > 3) {
				const maxDistance = cleanWord.length <= 5 ? 1 : 2;
				let bestMatch: { vocab: any; distance: number } | null = null;
				
		for (const [key, vList] of (vocabMap.entries() as IterableIterator<[string, any[]]>)) {
					// Quick length filter to avoid calculating Levenshtein on vastly different strings
					if (Math.abs(key.length - cleanWord.length) > maxDistance) continue;
					
					const distance = levenshteinDistance(cleanWord, key);
					if (distance <= maxDistance) {
						if (!bestMatch || distance < bestMatch.distance) {
							bestMatch = { vocab: pickBest(vList), distance };
						}
					}
				}
				
				if (bestMatch && bestMatch.vocab) {
					return { vocab: bestMatch.vocab };
				}
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
				const result = findVocab(clean, w);
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
				const list = vocabMap.get(singular);
				if (list && list.some((v) => v.partOfSpeech?.toLowerCase() === 'noun')) return true;
			}
			if (cleanWord.endsWith('ies') && cleanWord.length > 4) {
				const singular = cleanWord.slice(0, -3) + 'y';
				const list = vocabMap.get(singular);
				if (list && list.some((v) => v.partOfSpeech?.toLowerCase() === 'noun')) return true;
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

			// Handle English articles in native-to-target mode
			if (isEnToDe && englishArticles.has(cleanWord)) {
				// Get only non-whitespace tokens ahead
				const upcomingWords = tokens.slice(i + 1).filter((t: string) => !/^\s+$/.test(t));
				const nounVocab = findNextNoun(upcomingWords, 0);
				const activeLanguageName = lessonLanguage?.name || 'German';

				if (nounVocab) {
					const isPlural =
						upcomingWords.length > 0 &&
						isLikelyPlural(
							upcomingWords[0].replace(/[.,!?;:'"|()\[\]{}\-\u2014\u2013]/g, '').toLowerCase()
						);
					let article: string;

					if (activeLanguageName === 'French') {
						if (cleanWord === 'the') {
							const nomArt = genderToArticle(nounVocab.gender, activeLanguageName);
							article = isPlural ? 'les' : nomArt || 'le/la';
						} else {
							// "a" / "an" — indefinite
							const genderMap: Record<string, string> = { le: 'un', la: 'une' };
							const nomArt = genderToArticle(nounVocab.gender, activeLanguageName);
							article = nomArt ? genderMap[nomArt] || 'un/une' : 'un/une';
						}
					} else {
						if (cleanWord === 'the') {
							const nomArt = genderToArticle(nounVocab.gender, activeLanguageName);
							article = isPlural ? 'die' : nomArt || 'der/die/das';
						} else {
							// "a" / "an" — indefinite
							const genderMap: Record<string, string> = { der: 'ein', die: 'eine', das: 'ein' };
							const nomArt = genderToArticle(nounVocab.gender, activeLanguageName);
							article = nomArt ? genderMap[nomArt] || 'ein/eine' : 'ein/eine';
						}
					}

					const tooltip = buildTooltipHtml(nounVocab, article);
					result.push(
						`<span class="word-hover has-info tooltip-trigger">${token}${tooltip}</span>`
					);
					continue;
				}
				// Fallback: show generic article tooltip even when noun not found
				let genericArticle = '';
				if (activeLanguageName === 'French') {
					genericArticle = cleanWord === 'the' ? 'le/la/les' : 'un/une/des';
				} else {
					genericArticle = cleanWord === 'the' ? 'der/die/das' : 'ein/eine';
				}
				const genericTooltip = `<span class="word-tooltip"><span class="word-tooltip-header">${genericArticle}</span><span class="word-tooltip-body"><span class="word-tooltip-row"><strong>Article:</strong> ${cleanWord === 'the' ? 'definite' : 'indefinite'}</span></span></span>`;
				result.push(
					`<span class="word-hover has-info tooltip-trigger">${token}${genericTooltip}</span>`
				);
				continue;
			}

			// Handle German/French article forms — show case + gender tooltip
			if (isGermanText) {
				const activeLanguageName = lessonLanguage?.name || 'German';
				const artMap = activeLanguageName === 'French' ? FRENCH_ARTICLE_MAP : GERMAN_ARTICLE_MAP;

				const artEntry = artMap[cleanWord];
				if (artEntry) {
					const upcomingGerman = tokens.slice(i + 1).filter((t: string) => !/^\s+$/.test(t));
					const nounVocab = findNextNoun(upcomingGerman, 0);
					const nomArt = nounVocab ? genderToArticle(nounVocab.gender, activeLanguageName) : null;
					// Narrow down possible case forms using the noun's gender
					const matchedForms = nomArt
						? artEntry.forms.filter((f) => f.nomArticle === nomArt)
						: artEntry.forms;
					const caseLabel = (matchedForms.length > 0 ? matchedForms : artEntry.forms)
						.map((f) => f.caseLabel)
						.join(' / ');
					const artType = artEntry.definite
						? 'Definite'
						: cleanWord.startsWith('k')
							? 'Negative'
							: 'Indefinite';
					let ttHtml = `<span class="word-tooltip">`;
					ttHtml += `<span class="word-tooltip-header">${token}</span>`;
					ttHtml += `<span class="word-tooltip-body">`;
					ttHtml += `<span class="word-tooltip-row"><strong>Article:</strong> ${artType}</span>`;
					ttHtml += `<span class="word-tooltip-row"><strong>Form:</strong> ${caseLabel}</span>`;
					if (nounVocab) {
						const nDisplay = nounVocab.lemma.charAt(0).toUpperCase() + nounVocab.lemma.slice(1);
						const nGender = genderToArticle(nounVocab.gender, activeLanguageName);
						ttHtml += `<span class="word-tooltip-row"><strong>Noun:</strong> ${nDisplay}</span>`;
						if (nGender)
							ttHtml += `<span class="word-tooltip-row"><strong>Gender:</strong> ${nGender}</span>`;
						const nMeaning = nounVocab.meaning || nounVocab.meanings?.[0]?.value;
						if (nMeaning)
							ttHtml += `<span class="word-tooltip-row"><strong>Meaning:</strong> ${nMeaning}</span>`;
					}
					ttHtml += `</span></span>`;
					result.push(`<span class="word-hover has-info tooltip-trigger">${token}${ttHtml}</span>`);
					continue;
				}
			}

			// Try multi-word English matches (e.g. "television program" → Fernsehprogramm)
			// This handles cases where a German compound word has a multi-word English meaning
			if (isEnToDe) {
				let multiWordVocab: any = null;
				let multiWordEnd = i;
				for (let len = 5; len >= 2 && !multiWordVocab; len--) {
					const wordIndices: number[] = [i];
					for (let j = i + 1; j < tokens.length && wordIndices.length < len; j++) {
						if (!/^\s+$/.test(tokens[j]) && !tokens[j].match(/\x00VOCAB_\d+\x00/)) {
							wordIndices.push(j);
						}
					}
					if (wordIndices.length < len) continue;
					const phrase = wordIndices
						.map((idx) =>
							tokens[idx].replace(/[.,!?;:'"|()\[\]{}\-\u2014\u2013]/g, '').toLowerCase()
						)
						.join(' ');
					const vList = vocabMap.get(phrase);
					if (vList && vList.length > 0) {
						multiWordVocab = vList[0];
						multiWordEnd = wordIndices[len - 1];
					}
				}
				if (multiWordVocab) {
					const combinedText = tokens.slice(i, multiWordEnd + 1).join('');
					result.push(
						`<span class="word-hover has-info tooltip-trigger">${combinedText}${buildTooltipHtml(multiWordVocab)}</span>`
					);
					i = multiWordEnd;
					continue;
				}
			}

			const vocabResult = findVocab(cleanWord, token);
			if (vocabResult) {
				result.push(
					`<span class="word-hover has-info tooltip-trigger">${token}${buildTooltipHtml(vocabResult.vocab, undefined, vocabResult.inflectionNote)}</span>`
				);
			} else if (stillStreaming) {
				const loadingTooltip = `<span class="word-tooltip"><span class="word-tooltip-header">${token}</span><span class="word-tooltip-body"><span class="word-tooltip-row ai-magic-text"><span class="sparkle">✨</span> AI analyzing...</span></span></span>`;
				result.push(
					`<span class="word-hover has-info tooltip-trigger">${token}${loadingTooltip}</span>`
				);
			} else {
				result.push(`<span class="word-hover">${token}</span>`);
			}
		}
		text = result.join('');

		// Step 3: Restore vocab placeholders
		text = text.replace(
			/\x00VOCAB_(\d+)\x00/g,
			(_: string, idx: string) => vocabReplacements[parseInt(idx)]
		);

		return text;
	}

	$: parsedChallengeText = (() => {
		console.log('challengeText is:', challenge?.challengeText);
		if (!challenge?.challengeText) return '';
		try {
			return parseTextWithTooltips(challenge.challengeText, true, isStreaming);
		} catch (e) {
			console.error('Error in parseTextWithTooltips for challengeText:', e);
			return challenge.challengeText;
		}
	})();

	$: parsedTargetSentence = (() => {
		console.log('targetSentence is:', challenge?.targetSentence);
		if (!challenge?.targetSentence) return '';
		try {
			return parseTextWithTooltips(challenge.targetSentence, false, isStreaming);
		} catch (e) {
			console.error('Error in parseTextWithTooltips for targetSentence:', e);
			return challenge.targetSentence;
		}
	})();

	let showAfterElo = false;

	function calculateEloProgress(elo: number) {
		const level = elo < 1050 ? 'LEARNING' : elo < 1150 ? 'KNOWN' : 'MASTERED';
		return Math.max(
			0,
			Math.min(
				100,
				level === 'LEARNING'
					? ((elo - 1000) / 50) * 100
					: level === 'KNOWN'
						? ((elo - 1050) / 100) * 100
						: 100
			)
		);
	}

	function getEloLevelClass(elo: number): string {
		const levels: Record<string, string> = { LOCKED: 'locked', UNSEEN: 'unseen', LEARNING: 'learning', KNOWN: 'known', MASTERED: 'mastered' };
		const e = Number(elo);
		if (e < 1050) return levels['LEARNING'] || 'learning';
		if (e < 1150) return levels['KNOWN'] || 'known';
		return levels['MASTERED'] || 'mastered';
	}

	$: if (feedback) {
		// Delay to start animation after feedback is displayed
		setTimeout(() => {
			showAfterElo = true;
		}, 100);
	} else {
		showAfterElo = false;
	}

	async function generateChallenge() {
		// Cancel any in-flight requests before starting a new one
		cancelAllRequests();

		currentLessonLanguage = data.language;
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

		// Fetch average load time for accurate progress bar
		try {
			const statRes = await fetch('/api/load-time-stat');
			if (statRes.ok) {
				const statData = await statRes.json();
				estimatedLoadMs = statData.averageMs || 9000;
				isLocalMode = statData.isLocalMode || false;
			}
		} catch {
			/* use default */
		}

		// Start progress bar
		loadProgressPct = 0;
		const progressStart = Date.now();
		_loadProgressInterval = setInterval(() => {
			const elapsed = Date.now() - progressStart;
			if (elapsed < estimatedLoadMs) {
				loadProgressPct = Math.min(88, (elapsed / estimatedLoadMs) * 88);
			} else {
				// Logarithmic crawl toward 99% once past the estimate
				const extra = elapsed - estimatedLoadMs;
				loadProgressPct = Math.min(99, 88 + 11 * (1 - Math.exp(-extra / 6000)));
			}
		}, 80);

		// Start cycling tips
		loadTipIndex = Math.floor(Math.random() * loadingTips.length);
		_loadTipInterval = setInterval(() => {
			loadTipIndex = (loadTipIndex + 1) % loadingTips.length;
		}, 3500);

		generateController = new AbortController();

		try {
			const res = await fetch('/api/generate-lesson', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					gameMode,
					assignmentId: assignment?.id ?? undefined
				}),
				signal: generateController.signal
			});

			if (!res.ok) {
				const error = await res.json();
				toast.error(`Error: ${error.error}`);
				return;
			}

			const reader = res.body?.getReader();
			if (!reader) throw new Error('No readable stream available');
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
							if (msg.status === 'searching') {
								toast.success('AI generating vocabulary... 🤖');
							}
							const existingIds = new Set((challenge.allVocabulary || []).map((v: any) => v.id));
							const newVocab = (msg.data || []).filter((v: any) => !existingIds.has(v.id));
							challenge.allVocabulary = [...(challenge.allVocabulary || []), ...newVocab];
						} else if (msg.type === 'chunk') {
							accumulatedJson += msg.content;

							// Try to extract challengeText for progressive display
							const challengeMatch = accumulatedJson.match(
								/"challengeText"\s*:\s*"((?:[^"\\]|\\.)*)/
							);
							if (challengeMatch && challengeMatch[1]) {
								let extractedText = challengeMatch[1]
									.replace(/\\n/g, '\n')
									.replace(/\\"/g, '"')
									.replace(/\\\\/g, '\\');
								// Remap short vocab IDs (v0, v1, ...) to real UUIDs so tooltips work during streaming
								if (idMap && Object.keys(idMap).length > 0) {
									extractedText = extractedText.replace(
										/<vocab\s+id="([^"]+)">/g,
										(_m: string, shortId: string) => `<vocab id="${idMap[shortId] || shortId}">`
									);
								}
								challenge.challengeText = extractedText;

								if (challenge.gameMode === 'fill-blank') {
									const blanksCount = (extractedText.match(/___/g) || []).length;
									if (blanksCount > fillBlankAnswers.length) {
										const newAnswers = [...fillBlankAnswers];
										while (newAnswers.length < blanksCount) {
											newAnswers.push('');
										}
										fillBlankAnswers = newAnswers;
									}
								}

								// Only stop loading once we have actual text to show
								if (loading) {
									loading = false;
									tick().then(() => {
										fetch('/api/load-time-stat', {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify({ loadTimeMs: Date.now() - progressStart })
										}).catch(() => {});
									});
								}
							}

							// Progressive extraction of other fields to allow early submission
							const targetMatch = accumulatedJson.match(
								/"targetSentence"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/
							);
							if (targetMatch && targetMatch[1] !== undefined) {
								challenge.targetSentence = targetMatch[1]
									.replace(/\\n/g, '\n')
									.replace(/\\"/g, '"')
									.replace(/\\\\/g, '\\');
							}

							const vocabIdsMatch = accumulatedJson.match(
								/"targetedVocabularyIds"\s*:\s*\[([^\]]*)\]/
							);
							if (vocabIdsMatch && vocabIdsMatch[1]) {
								const rawIds = vocabIdsMatch[1]
									.split(',')
									.map((s) => s.trim().replace(/^"|"$/g, ''))
									.filter(Boolean);
								if (rawIds.length > 0) {
									challenge.targetedVocabularyIds = rawIds.map((id) => idMap[id] || id);

									// Immediate filtering of vocabulary
									if (
										challenge.targetedVocabularyIds.length > 0 &&
										challenge.targetedVocabulary?.length > 0
									) {
										const usedIds = new Set(challenge.targetedVocabularyIds);
										// Store the original metadata-sourced list if we haven't yet, so we can re-filter if needed
										if (!challenge._allMetadataVocab)
											challenge._allMetadataVocab = [...challenge.targetedVocabulary];
										challenge.targetedVocabulary = challenge._allMetadataVocab.filter((v: any) =>
											usedIds.has(v.id)
										);
									}
								}
							}

							const grammarIdsMatch = accumulatedJson.match(
								/"targetedGrammarIds"\s*:\s*\[([^\]]*)\]/
							);
							if (grammarIdsMatch && grammarIdsMatch[1]) {
								const rawIds = grammarIdsMatch[1]
									.split(',')
									.map((s) => s.trim().replace(/^"|"$/g, ''))
									.filter(Boolean);
								if (rawIds.length > 0) {
									challenge.targetedGrammarIds = rawIds.map((id) => idMap[id] || id);

									// Immediate filtering of grammar
									if (
										challenge.targetedGrammarIds.length > 0 &&
										challenge.targetedGrammar?.length > 0
									) {
										const usedIds = new Set(challenge.targetedGrammarIds);
										// Store original
										if (!challenge._allMetadataGrammar)
											challenge._allMetadataGrammar = [...challenge.targetedGrammar];
										challenge.targetedGrammar = challenge._allMetadataGrammar.filter((g: any) =>
											usedIds.has(g.id)
										);
									}
								}
							}

							// Progressive extraction of distractors for multiple-choice
							const distractorsMatch = accumulatedJson.match(/"distractors"\s*:\s*\[([^\]]*)\]/);
							if (distractorsMatch && distractorsMatch[1] && challenge.targetSentence) {
								const distractors = distractorsMatch[1]
									.split(',')
									.map((s) => s.trim().replace(/^"|"$/g, ''))
									.filter(Boolean);
								if (distractors.length > 0 && (!shuffledChoices || shuffledChoices.length === 0)) {
									const allChoices = [...distractors, challenge.targetSentence];
									shuffledChoices = allChoices.sort(() => Math.random() - 0.5);
								}
							}

							// Progressive extraction of hints for fill-blank
							const hintsMatch = accumulatedJson.match(/"hints"\s*:\s*\[(.*?)\]\s*(?:,|$)/);
							if (hintsMatch && hintsMatch[1]) {
								try {
									// Try to parse the partial hints array
									const hints = JSON.parse(`[${hintsMatch[1]}]`);
									if (hints.length > 0 && fillBlankAnswers.length === 0) {
										challenge.hints = hints.map((h: any) => ({
											...h,
											vocabId: idMap[h.vocabId] || h.vocabId
										}));
										fillBlankAnswers = challenge.hints.map(() => '');
									}
								} catch (e) {
									// Partial hints array might not be valid JSON yet, ignore
								}
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
						if (msg.status === 'searching') {
							toast.success('AI generating vocabulary... 🤖');
						}
						const existingIds = new Set((challenge.allVocabulary || []).map((v: any) => v.id));
						const newVocab = (msg.data || []).filter((v: any) => !existingIds.has(v.id));
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
					parsed.targetedVocabularyIds = parsed.targetedVocabularyIds.map(
						(id: string) => idMap[id] || id
					);
					challenge.targetedVocabularyIds = parsed.targetedVocabularyIds;
				}
				if (parsed.targetedGrammarIds && Array.isArray(parsed.targetedGrammarIds)) {
					parsed.targetedGrammarIds = parsed.targetedGrammarIds.map(
						(id: string) => idMap[id] || id
					);
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
					challenge.targetedVocabulary = (challenge._allMetadataVocab || challenge.targetedVocabulary || []).filter((v: any) =>
						usedVocabIds.has(v.id)
					);
				}
				if (parsed.targetedGrammarIds && Array.isArray(parsed.targetedGrammarIds)) {
					const usedGrammarIds = new Set(parsed.targetedGrammarIds);
					challenge.targetedGrammar = (challenge._allMetadataGrammar || challenge.targetedGrammar || []).filter((g: any) =>
						usedGrammarIds.has(g.id)
					);
				}

				// Initialize fill-blank answers array
				if (challenge.gameMode === 'fill-blank' && challenge.hints) {
					fillBlankAnswers = challenge.hints.map(() => '');
				}

				// Shuffle multiple-choice options
				if (
					challenge.gameMode === 'multiple-choice' &&
					challenge.distractors &&
					challenge.targetSentence
				) {
					const allChoices = [...challenge.distractors, challenge.targetSentence];
					shuffledChoices = allChoices.sort(() => Math.random() - 0.5);
				}
			} catch (e) {
				console.error('Failed to parse final JSON', e);
				throw new Error('Incomplete response from AI.');
			}

			if (!challenge.challengeText || !challenge.targetSentence) {
				throw new Error('AI failed to generate a complete challenge.');
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				// Request was intentionally cancelled — don't show an error
				return;
			}
			console.error(error);
			toast.error(
				`Failed to generate challenge: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			challenge = null;
		} finally {
			generateController = null;
			// Complete progress bar then clean up
			stopLoadingIntervals();
			loadProgressPct = 100;
			setTimeout(() => {
				loadProgressPct = 0;
			}, 500);
			loading = false;
			isStreaming = false;
		}
	}

	async function submitAnswer() {
		if (submitting) return;
		const mode = challenge?.gameMode || 'native-to-target';

		// Build userInput based on mode
		let effectiveInput = userInput;
		if (mode === 'fill-blank') {
			if (fillBlankAnswers.some((a) => !a.trim())) return;
			effectiveInput = fillBlankAnswers.join(', ');
		} else if (mode === 'multiple-choice') {
			if (!selectedChoice) return;
			effectiveInput = selectedChoice;
		} else {
			if (!userInput.trim()) return;
		}

		if (isStreaming) {
			// Removed restriction to allow early submission
			console.warn('Challenge is still generating, but submission is allowed.');
		}
		if (!challenge?.targetSentence) {
			toast.error(
				'Challenge was not properly generated (missing target sentence). Please generate a new challenge.'
			);
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
					gameMode: challenge.gameMode || 'native-to-target',
					assignmentId: assignment?.id ?? null,
					activeLanguageName: lessonLanguage?.name || 'German'
				}),
				signal: submitController.signal
			});

			if (!res.ok) {
				const error = await res.json();
				toast.error(`Error: ${error.error}`);
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
				// For streaming responses, the server appends \n\nJSON_PAYLOAD:{...} at the end
				const payloadMarker = '\n\nJSON_PAYLOAD:';
				const payloadIdx = responseText.indexOf(payloadMarker);
				const jsonToParse =
					payloadIdx >= 0 ? responseText.slice(payloadIdx + payloadMarker.length) : responseText;
				const data = JSON.parse(jsonToParse);
				// Build grader idMap from the order of IDs we sent (same order the grader used)
				const graderIdMap: Record<string, string> = {};
				(challenge.targetedVocabulary || []).forEach((v: any, i: number) => {
					graderIdMap[`v${i}`] = v.id;
				});
				(challenge.targetedGrammar || []).forEach((g: any, i: number) => {
					graderIdMap[`g${i}`] = g.id;
				});
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
				// Update assignment progress if we got it back
				if (data.assignmentProgress && assignmentProgress) {
					assignmentProgress = data.assignmentProgress;
				}
				// Auto-show English feedback for beginners
				if (isAbsoluteBeginner && feedback.feedbackEnglish) {
					showEnglishFeedback = true;
				}

				// Level Up Celebration
				if (data.levelUp) {
					userLevel = data.levelUp.newLevel;
					isAbsoluteBeginner = userLevel === 'A1';
					modal.alert(
						`Congratulations! You've leveled up from ${data.levelUp.oldLevel} to ${data.levelUp.newLevel}!`,
						'🎉 Level Up!'
					);
				}
			} catch (e) {
				console.error('Failed to parse full feedback response', e, responseText);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}
			console.error(error);
			toast.error(
				`Failed to submit answer: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			feedback = null;
			hasSubmittedMc = false;
		} finally {
			submitController = null;
			submitting = false;
		}
	}
</script>

r<svelte:head>
	<title>Play - LingoLearn</title>
</svelte:head>

<div class="page-container">
	<div class="content-wrapper" class:games-active={activeTab === 'games'}>
		<header class="page-header" in:fly={{ y: 20, duration: 400 }}>
			<h1 class="dark:text-white">Play Mode</h1>
			<p class="dark:text-slate-400">Test your skills with personalized challenges.</p>
		</header>

		<div class="tabs-container" in:fly={{ y: 20, duration: 400 }}>
			<div class="tabs">
				<button
					class="tab-btn"
					class:active={activeTab === 'learn'}
					on:click={() => (activeTab = 'learn')}
				>
					Learn
				</button>
				<button
					class="tab-btn"
					class:active={activeTab === 'games'}
					on:click={() => (activeTab = 'games')}
				>
					Games
				</button>
				<button
					class="tab-btn"
					class:active={activeTab === 'immerse'}
					on:click={() => (activeTab = 'immerse')}
				>
					Immerse
				</button>
			</div>
		</div>

		{#if activeTab === 'learn'}
			<div class="learn-container">
			<!-- Assignment context banner -->
			{#if assignment && assignmentProgress}
				<div
					class="card card-duo assignment-banner {assignmentProgress.passed ? 'passed' : 'active'}"
					in:fly={{ y: 20, duration: 400, delay: 100 }}
				>
					<div class="assignment-info">
						<div class="assignment-icon">
							{assignmentProgress.passed ? '🏆' : '📋'}
						</div>
						<div class="assignment-details">
							<h2 class="assignment-title">{assignment.title}</h2>
							<div class="assignment-meta">
								<span class="meta-badge">{assignment.class?.name ?? 'Class'}</span>
								<span class="meta-badge gamemode">{assignment.gamemode.replace(/-/g, ' ')}</span>
								<span class="meta-badge language">
									{assignment.language === 'international'
										? '🌍 International'
										: `${lessonLanguage?.flag || '🏁'} ${lessonLanguage?.name || 'Target'}`}
								</span>
							</div>
						</div>
					</div>
					<div class="assignment-actions">
						<div class="progress-box">
							<p class="progress-label">Progress</p>
							<p class="progress-value {assignmentProgress.passed ? 'passed' : 'active'}">
								{assignmentProgress.score}<span class="progress-target"
									>/{assignmentProgress.targetScore}</span
								>
							</p>
						</div>
						<a href="/classes/{assignment.classId}" class="btn-duo btn-secondary back-btn">
							Back to Class
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg
							>
						</a>
					</div>
				</div>
			{/if}

			{#if !challenge && !loading}
				<div
					class="card card-duo empty-state dark:bg-slate-800 dark:border-slate-700 shadow-none"
					in:fly={{ y: 20, duration: 400 }}
				>
					<h2 class="dark:text-white">Ready to test your skills?</h2>

					{#if isAbsoluteBeginner}
						<div class="beginner-tip dark:bg-slate-900 dark:border-slate-700 dark:text-emerald-400">
							<span class="tip-icon">💡</span>
							<div>
								<strong class="dark:text-emerald-300">Tip for beginners:</strong> Start with
								<strong>Multiple Choice</strong>
								or <strong>{lessonLanguage?.name || 'Target'} to English</strong> — these let you
								recognize words before producing them. Once you feel confident, try
								<strong>Fill in the Blank</strong>
								and <strong>English to {lessonLanguage?.name || 'Target'}</strong>!
							</div>
						</div>
					{/if}

					<div class="mode-selector">
						<span class="mode-label dark:text-slate-400">Game Mode:</span>
						{#if assignment}
							<p class="font-bold text-blue-600 dark:text-blue-400 capitalize">
								{assignment.gamemode.replace(/-/g, ' ')}
								<span class="text-gray-400 dark:text-gray-500 font-normal text-sm"
									>(set by assignment)</span
								>
							</p>
						{:else}
							<div class="mode-buttons">
								<!-- Easiest first -->
								<button
									class="mode-btn dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
									class:active={gameMode === 'multiple-choice'}
									on:click={() => (gameMode = 'multiple-choice')}
								>
									🔘 Multiple Choice
									<span class="mode-difficulty easy">Easiest</span>
								</button>
								<button
									class="mode-btn dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
									class:active={gameMode === 'target-to-native'}
									on:click={() => (gameMode = 'target-to-native')}
								>
									{lessonLanguage?.flag || '🏁'} → {englishFlag}
									{lessonLanguage?.name || 'Target'} to English
									<span class="mode-difficulty easy">Easy</span>
								</button>
								<button
									class="mode-btn dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
									class:active={gameMode === 'fill-blank'}
									on:click={() => (gameMode = 'fill-blank')}
								>
									✏️ Fill in the Blank
									<span class="mode-difficulty medium">Medium</span>
								</button>
								<button
									class="mode-btn dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
									class:active={gameMode === 'native-to-target'}
									on:click={() => (gameMode = 'native-to-target')}
								>
									{englishFlag} → {lessonLanguage?.flag || '🏁'} English to {lessonLanguage?.name ||
										'Target'}
									<span class="mode-difficulty hard">Hardest</span>
								</button>
							</div>

							<div class="chat-separator dark:text-slate-500">
								<span class="separator-line dark:bg-slate-700"></span>
								<span class="separator-text">or</span>
								<span class="separator-line dark:bg-slate-700"></span>
							</div>

							<button
								class="chat-cta-btn dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
								class:active={gameMode === 'chat'}
								on:click={() => (gameMode = 'chat')}
							>
								💬 AI Chat Practice
								<span class="chat-cta-subtitle dark:text-slate-400">Practice conversation with an AI tutor</span>
							</button>
						{/if}
					</div>
					<button
						on:click={() => gameMode === 'chat' ? goto('/play/chat') : generateChallenge()}
						class="btn-duo btn-primary"
						style="margin-top: 1.5rem; width: 100%;"
					>
						{gameMode === 'chat' ? 'Start Chat Session' : 'Generate Next Challenge'}
					</button>
				</div>
			{/if}

			{#if loading}
				<div
					class="card card-duo loading-state dark:bg-slate-800 dark:border-slate-700"
					in:fade={{ duration: 300 }}
				>
					<div class="spinner"></div>
					<div class="load-progress-track dark:bg-slate-700">
						<div class="load-progress-fill {isLocalMode ? 'local-mode-fill' : ''}" style="width: {loadProgressPct}%"></div>
					</div>
					<div class="load-tip-container">
						{#key loadTipIndex}
							<p
								class="load-tip dark:text-slate-400"
								in:fade={{ duration: 350, delay: 50 }}
								out:fade={{ duration: 300 }}
							>
								{loadingTips[loadTipIndex]}
							</p>
						{/key}
					</div>
				</div>
			{/if}

			{#if challenge && !loading}
				<div
					class="card card-duo challenge-card dark:bg-slate-800 dark:border-slate-700"
					in:fly={{ y: 20, duration: 400 }}
				>
					<button
						type="button"
						class="change-mode-link dark:text-slate-400 dark:hover:text-slate-200"
						on:click={() => { challenge = null; feedback = null; showGrammarRef = false; }}
					>
						&larr; Change Mode
					</button>
					<div class="challenge-section">
						{#if challenge.gameMode === 'fill-blank'}
							<h3 class="dark:text-slate-400">Fill in the blanks:</h3>
						{:else if challenge.gameMode === 'multiple-choice'}
							<h3 class="dark:text-slate-400">Choose the correct English translation:</h3>
						{:else if challenge.gameMode === 'target-to-native'}
							<h3 class="dark:text-slate-400">Translate this to English:</h3>
						{:else}
							<h3 class="dark:text-slate-400">
								Translate this to {lessonLanguage?.name || 'Target'}:
							</h3>
						{/if}
						<p class="challenge-text dark:text-white">{@html parsedChallengeText}</p>
					</div>

					{#if challenge.gameMode === 'fill-blank' && challenge.hints?.length > 0}
						<div class="challenge-section">
							<h3 class="dark:text-slate-400">Hints:</h3>
							<ul class="hint-list">
								{#each challenge.hints as hint, i}
									<li class="dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
										<span class="hint-number">Blank {i + 1}:</span>
										{hint.hint}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div class="challenge-section grammar-ref-section">
						{#if isStreaming}
							<div class="ai-magic-loader">
								<span class="sparkle">✨</span>
								<span class="dark:text-slate-400 italic"
									>AI is analyzing grammar & generating tooltips...</span
								>
							</div>
						{:else}
						<button
							type="button"
							class="grammar-ref-toggle dark:text-slate-400 dark:hover:text-slate-200 dark:border-slate-700"
							on:click={() => (showGrammarRef = !showGrammarRef)}
						>
							{showGrammarRef ? 'Hide help' : 'Need help?'}
							<span class="grammar-ref-chevron" class:expanded={showGrammarRef}>&#9662;</span>
						</button>
						{#if showGrammarRef}
							<div transition:fly={{ y: -5, duration: 200 }}>
								<h3 class="dark:text-slate-400" style="margin-top: 0.75rem;">Grammar Reference:</h3>
								{#if challenge.targetedGrammar?.length > 0}
									<ul class="concept-list">
										{#each challenge.targetedGrammar as grammar}
									<li class="dark:text-slate-300 grammar-item">
										<div class="grammar-header">
											<span class="concept-type dark:bg-slate-700 dark:text-slate-300">Grammar</span
											>
											<span class="grammar-title">{grammar.title}</span>
											{#if grammar.guide}
												<button
													type="button"
													class="guide-toggle-btn dark:text-slate-400 dark:hover:text-slate-200"
													on:click={() => toggleGrammar(grammar.id)}
												>
													{expandedGrammarId === grammar.id ? 'Hide Guide' : 'Show Guide'}
												</button>
											{/if}
										</div>
										{#if grammar.guide && expandedGrammarId === grammar.id}
											<div
												class="grammar-guide markdown-body dark:bg-slate-900 dark:border-slate-700"
												transition:fly={{ y: -5, duration: 200 }}
											>
												{@html marked(grammar.guide)}
											</div>
										{/if}
									</li>
								{/each}
									</ul>
								{:else}
									<p class="dark:text-slate-400 italic">None found</p>
								{/if}
							</div>
						{/if}
					{/if}
					</div>

					<form on:submit|preventDefault={submitAnswer} class="answer-form">
						{#if challenge.gameMode === 'fill-blank'}
							<FillInBlankView
								{challenge}
								{submitting}
								{feedback}
								{loading}
								bind:fillBlankAnswers
								{lessonLanguage}
								{submitAnswer}
							/>
						{:else if challenge.gameMode === 'multiple-choice'}
							<MultipleChoiceView
								{challenge}
								{submitting}
								{feedback}
								{loading}
								{shuffledChoices}
								bind:selectedChoice
								{hasSubmittedMc}
								{submitAnswer}
							/>
						{:else}
							<TranslationView
								{challenge}
								{submitting}
								{feedback}
								{loading}
								bind:userInput
								{lessonLanguage}
							/>
						{/if}

						{#if !feedback}
							{#if challenge.gameMode !== 'multiple-choice'}
								<button
									type="submit"
									disabled={submitting ||
										!challenge?.targetSentence ||
										(challenge.gameMode === 'fill-blank'
											? fillBlankAnswers.length === 0 || fillBlankAnswers.some((a) => !a.trim())
											: challenge.gameMode === 'multiple-choice'
												? !selectedChoice
												: !userInput.trim())}
									class="btn-duo btn-primary submit-btn"
									style="margin-top: 1.5rem; width: 100%;"
								>
									{submitting ? 'Evaluating...' : 'Submit Answer'}
								</button>
							{/if}
						{/if}
					</form>
				</div>
			{/if}

			{#if submitting}
				<div class="card card-duo loading-state" in:fly={{ y: 20, duration: 400 }}>
					<div class="spinner"></div>
					<p>Evaluating your answer...</p>
				</div>
			{/if}

			{#if feedback}
				<div
					class="card card-duo feedback-card dark:bg-slate-800 dark:border-slate-700"
					in:fly={{ y: 20, duration: 400 }}
				>
					<div class="feedback-header">
						<h2 class="dark:text-white">Feedback</h2>
						{#if feedback.feedbackEnglish}
							<label class="toggle-container">
								<input type="checkbox" bind:checked={showEnglishFeedback} />
								<span class="toggle-label dark:text-slate-400">Translate to English</span>
							</label>
						{/if}
						<div class="score-display">
							<span class="score-label dark:text-slate-400">Score:</span>
							{#if feedback.globalScore === null}
								<div class="score-spinner"></div>
							{:else}
								<span
									class="score-value"
									class:excellent={feedback.globalScore > 0.8}
									class:good={feedback.globalScore <= 0.8 && feedback.globalScore > 0.5}
									class:needs-work={feedback.globalScore <= 0.5}
								>
									{Math.round(feedback.globalScore * 100)}%
								</span>
							{/if}
						</div>
					</div>

					<div class="feedback-message dark:bg-slate-900 dark:border-blue-900 dark:text-blue-300">
						<p>
							{showEnglishFeedback && feedback.feedbackEnglish
								? feedback.feedbackEnglish
								: feedback.feedback}
						</p>
					</div>

					<div class="feedback-section">
						<h3 class="dark:text-slate-400">Expected Answer:</h3>
						<div class="expected-answer dark:bg-slate-900 dark:border-emerald-900">
							<p class="dark:text-emerald-400">{@html parsedTargetSentence}</p>
						</div>
					</div>

					<div class="feedback-grid">
						{#if feedback.vocabularyUpdates?.length > 0}
							<div class="feedback-list-section">
								<h3 class="dark:text-slate-400">Vocabulary Used</h3>
								<ul>
									{#each feedback.vocabularyUpdates as update}
										{@const v = challenge.targetedVocabulary.find((v: any) => v.id === update.id)}
										<li class="dark:text-slate-300">
											<span class="icon">{(update.score ?? 0) >= 0.5 ? '✅' : '❌'}</span>
											<div class="item-info">
												<div class="item-row">
													<span class="item-label">
														{#if v}
															{[genderToArticle(v.gender), v.lemma].filter(Boolean).join('\u00A0') +
																(v.plural ? '\u00A0(pl: ' + v.plural + ')' : '')}
														{:else}
															{update.id}
														{/if}
													</span>
													<span class="elo-display dark:bg-slate-900 dark:text-slate-400">
														ELO {Math.round(
															showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)
														)}
														{#if showAfterElo && update.eloAfter !== update.eloBefore}
															{@const delta = Math.round(update.eloAfter - update.eloBefore)}
															<span
																class="elo-delta"
																class:positive={delta > 0}
																class:negative={delta < 0}
															>
																{delta > 0 ? '+' : ''}{delta}
															</span>
														{/if}
													</span>
												</div>
												<div class="progress-bar-container dark:bg-slate-700 dark:border-slate-600">
													<div
														class="progress-bar-fill {getEloLevelClass(
															showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)
														)}"
														style="width: {calculateEloProgress(
															showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)
														)}%"
													></div>
												</div>
											</div>
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if feedback.grammarUpdates?.length > 0}
							<div class="feedback-list-section">
								<h3 class="dark:text-slate-400">Grammar Rules Followed</h3>
								<ul>
									{#each feedback.grammarUpdates as update}
										<li class="dark:text-slate-300">
											<span class="icon">{(update.score ?? 0) >= 0.5 ? '✅' : '❌'}</span>
											<div class="item-info">
												<div class="item-row">
													<span class="item-label">
														{challenge.targetedGrammar.find((g: any) => g.id === update.id)
															?.title || update.id}
													</span>
													<span class="elo-display dark:bg-slate-900 dark:text-slate-400">
														ELO {Math.round(
															showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)
														)}
														{#if showAfterElo && update.eloAfter !== update.eloBefore}
															{@const delta = Math.round(update.eloAfter - update.eloBefore)}
															<span
																class="elo-delta"
																class:positive={delta > 0}
																class:negative={delta < 0}
															>
																{delta > 0 ? '+' : ''}{delta}
															</span>
														{/if}
													</span>
												</div>
												<div class="progress-bar-container dark:bg-slate-700 dark:border-slate-600">
													<div
														class="progress-bar-fill {getEloLevelClass(
															showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)
														)}"
														style="width: {calculateEloProgress(
															showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)
														)}%"
													></div>
												</div>
											</div>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>

					<button
						on:click={generateChallenge}
						class="btn-duo btn-primary next-btn"
						style="margin-top: 1.5rem; width: 100%;"
					>
						Next Challenge
					</button>
				</div>
			{/if}
			</div>
		{:else if activeTab === 'immerse'}
			<div class="immerse-wrapper" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				{#if assignment && assignment.gamemode === 'immerse' && assignmentProgress}
					<div
						class="card card-duo assignment-banner {assignmentProgress.passed ? 'passed' : 'active'}"
						in:fly={{ y: 20, duration: 400, delay: 100 }}
					>
						<div class="assignment-info">
							<div class="assignment-icon">
								{assignmentProgress.passed ? '🏆' : '📋'}
							</div>
							<div class="assignment-details">
								<h2 class="assignment-title">{assignment.title}</h2>
								<div class="assignment-meta">
									<span class="meta-badge">{assignment.class?.name ?? 'Class'}</span>
									<span class="meta-badge gamemode">immerse</span>
									<span class="meta-badge language">
										{assignment.language === 'international'
											? '🌍 International'
											: `${lessonLanguage?.flag || '🏁'} ${lessonLanguage?.name || 'Target'}`}
									</span>
								</div>
							</div>
						</div>
						<div class="assignment-actions">
							<div class="progress-box">
								<p class="progress-label">Progress</p>
								<p class="progress-value {assignmentProgress.passed ? 'passed' : 'active'}">
									{assignmentProgress.score}<span class="progress-target"
										>/{assignmentProgress.targetScore}</span
									>
								</p>
							</div>
							<a href="/classes/{assignment.classId}" class="btn-duo btn-secondary back-btn">
								Back to Class
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg
								>
							</a>
						</div>
					</div>
				{/if}
				<ImmersionView
					language={lessonLanguage}
					cefrLevel={userLevel}
					assignmentId={assignment?.gamemode === 'immerse' ? assignment.id : null}
					bind:assignmentProgress
				/>
			</div>
		{:else}
			<div class="games-wrapper" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				<div class="header-section">
					<h2>Games Gallery</h2>
					<a href="/play/games/create" class="btn-primary create-btn"> + Create Game </a>
				</div>

				<div class="games-section">
					<h2>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
						My Games
					</h2>

					{#if myGames.length === 0}
						<div class="empty-state">
							<p>You haven't created any games yet.</p>
							<a href="/play/games/create" class="link">Create your first game</a>
						</div>
					{:else}
						<div class="games-grid">
							{#each myGames as game}
								<div class="card-duo game-card">
									<div class="game-card-content">
										<div class="game-card-header">
											<h3>{game.title}</h3>
											<span class="language-badge" title={game.language}>
												{getFlagEmoji(game.language)}
											</span>
										</div>
										<p class="game-description">
											{game.description || 'No description provided.'}
										</p>
										<div class="game-meta">
											<span>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
													><path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													/></svg
												>
												{game._count.questions} questions
											</span>
											<span>
												{#if game.isPublished}
													<span class="status-published"
														><span class="status-dot published-dot"></span> Published</span
													>
												{:else}
													<span class="status-draft"
														><span class="status-dot draft-dot"></span> Draft</span
													>
												{/if}
											</span>
										</div>
									</div>
									<div class="game-actions">
										{#if canPlayLive}
											<button
												type="button"
												class="btn-action live-btn"
												on:click={() => handlePlayLive(game.id)}
											>
												Play Live
											</button>
										{/if}
										<a href="/play/games/{game.id}/play" class="btn-action"> Play </a>
										<a href="/play/games/{game.id}/edit" class="btn-action"> Edit </a>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<hr class="games-divider" />

				<div class="games-section community-games-section">
					<h2>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
							/>
						</svg>
						Community Games
					</h2>

					<div class="category-pills">
						{#each categories as category}
							<button
								class="filter-pill"
								class:active={currentCategory === category}
								on:click={() => handleCategoryChange(category)}
							>
								{category}
							</button>
						{/each}
					</div>

					{#if communityGames.length === 0}
						<div class="empty-state">
							<p>No community games available right now.</p>
						</div>
					{:else}
						<div class="games-grid">
					{#each data.communityGames as game}
						<div class="card-duo game-card">
							<div class="game-card-content">
								<div class="game-card-header">
									<h3>{game.title}</h3>
									<span class="language-badge" title={game.language}>
										{getFlagEmoji(game.language)}
									</span>
								</div>
								<p class="game-author">by {game.creator?.username || 'Unknown'}</p>
								<p class="game-description">
									{game.description || 'No description provided.'}
								</p>
								<div class="game-meta" style="justify-content: space-between; align-items: center;">
									<span>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/></svg
										>
										{(game as { _count?: { questions: number } })._count?.questions || 0} questions
									</span>
									{#if game.category && game.category !== 'General'}
										<span class="meta-badge">{game.category}</span>
									{/if}
								</div>
							</div>
							<div class="game-actions">
								{#if canPlayLive}
									<button
										type="button"
										class="btn-action live-btn"
										on:click={() => handlePlayLive(game.id)}
									>
										Play Live
									</button>
								{/if}
								<a href="/play/games/{game.id}/play" class="btn-action"> Play </a>
							</div>
						</div>
					{/each}
						</div>
						
						{#if communityGames.length < totalCommunityGames}
							<div class="load-more-container" style="text-align: center; margin-top: 2rem;">
								<button class="btn-load-more" on:click={loadMore} disabled={loadingMore}>
									{loadingMore ? 'Loading...' : 'Load More'}
								</button>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if showClassModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={() => showClassModal = false}>
		<div class="modal" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Select a Class</h2>
				<button class="close-btn" on:click={() => showClassModal = false}>×</button>
			</div>
			<div class="modal-body">
				<p class="modal-desc">Which class do you want to start this live session for?</p>
				<div class="class-list">
					{#each teacherClasses as c}
						<button class="class-btn" on:click={() => {
							showClassModal = false;
							if (selectedGameIdForLive) startLiveSession(selectedGameIdForLive, c.id);
						}}>
							{c.name}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: var(--card-bg, #ffffff);
		border-radius: 12px;
		padding: 1.5rem;
		width: 90%;
		max-width: 400px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
	}

	:global(html[data-theme='dark']) .modal {
		background: #1e293b;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--text-color, #0f172a);
	}

	:global(html[data-theme='dark']) .modal-header h2 {
		color: #f8fafc;
	}

	.close-btn {
		background: transparent;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #64748b;
	}

	.modal-desc {
		color: #475569;
		margin-top: 0;
		margin-bottom: 1rem;
		font-size: 0.95rem;
	}

	:global(html[data-theme='dark']) .modal-desc {
		color: #94a3b8;
	}

	.class-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.class-btn {
		padding: 0.75rem 1rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		color: #1e293b;
		text-align: left;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s;
	}

	.class-btn:hover {
		border-color: #3b82f6;
		background: #eff6ff;
	}

	:global(html[data-theme='dark']) .class-btn {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(html[data-theme='dark']) .class-btn:hover {
		border-color: #60a5fa;
		background: #334155;
	}

	.tabs-container {
		display: flex;
		justify-content: center;
		margin-bottom: 2rem;
	}

	.tabs {
		display: flex;
		background: #f1f5f9;
		padding: 0.5rem;
		border-radius: 1rem;
		gap: 0.5rem;
	}

	:global(html[data-theme='dark']) .tabs {
		background: #1e293b;
	}

	.tab-btn {
		padding: 0.75rem 2rem;
		border-radius: 0.75rem;
		font-weight: bold;
		font-size: 1rem;
		color: #64748b;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.tab-btn:hover {
		color: #1e293b;
		background: #e2e8f0;
	}

	:global(html[data-theme='dark']) .tab-btn:hover {
		color: #f8fafc;
		background: #334155;
	}

	.tab-btn.active {
		background: white;
		color: #3b82f6;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	:global(html[data-theme='dark']) .tab-btn.active {
		background: #0f172a;
		color: #60a5fa;
	}

	.games-wrapper {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.immerse-wrapper {
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
	}

	.header-section {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	@media (min-width: 768px) {
		.header-section {
			flex-direction: row;
			align-items: center;
		}
	}

	.header-section h2 {
		font-size: 2rem;
		color: var(--text-color, #0f172a);
		margin: 0;
		font-weight: 800;
	}

	.create-btn {
		padding: 0.75rem 1.5rem;
		border-radius: 0.75rem;
		font-weight: bold;
		text-decoration: none;
		display: inline-block;
	}

	.games-section {
		margin-bottom: 1rem;
	}

	.games-section h2 {
		font-size: 1.5rem;
		color: var(--text-color, #1e293b);
		margin: 0 0 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.games-section h2 svg {
		width: 1.5rem;
		height: 1.5rem;
		color: #3b82f6;
	}

	.link {
		color: #3b82f6;
		font-weight: bold;
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.games-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}

	@media (min-width: 640px) {
		.games-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (min-width: 1024px) {
		.games-grid {
			grid-template-columns: 1fr 1fr 1fr;
		}
	}

	.game-card {
		display: flex;
		flex-direction: column;
		height: 100%;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}

	.game-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
	}

	.game-card-content {
		flex: 1;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.game-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.25rem;
	}

	.game-card-header h3 {
		font-size: 1.25rem;
		font-weight: bold;
		margin: 0;
		color: var(--text-color, #1e293b);
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		line-clamp: 1;
		overflow: hidden;
	}

	.language-badge {
		background: transparent;
		font-size: 1.5rem;
		line-height: 1;
		cursor: help;
	}

	:global(html[data-theme='dark']) .language-badge {
		background: transparent;
	}

	.game-author {
		font-size: 0.875rem;
		font-weight: bold;
		color: #3b82f6;
		margin: 0;
	}

	.game-description {
		color: #64748b;
		font-size: 0.875rem;
		margin: 0;
		flex-grow: 1;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		overflow: hidden;
	}

	.game-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		font-weight: bold;
		color: #64748b;
		margin-top: auto;
	}

	.game-meta span {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.game-meta svg {
		width: 1rem;
		height: 1rem;
	}

	.status-published {
		color: #22c55e;
	}

	.status-draft {
		color: #94a3b8;
	}

	.status-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		display: inline-block;
	}

	.published-dot {
		background-color: #22c55e;
	}

	.draft-dot {
		background-color: #94a3b8;
	}

	.game-actions {
		padding: 1rem;
		border-top: 1px solid var(--card-border, #f1f5f9);
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.btn-action {
		flex: 1;
		min-width: calc(50% - 0.75rem);
		background: #eff6ff;
		color: #1d4ed8;
		font-weight: bold;
		padding: 0.5rem 1rem;
		border-radius: 0.75rem;
		border: none;
		text-align: center;
		text-decoration: none;
		transition: background-color 0.2s;
		cursor: pointer;
		font-family: inherit;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.btn-action:hover {
		background: #dbeafe;
	}

	.btn-action.live-btn {
		flex: 1 1 100%;
		background: #f97316;
		color: #ffffff;
	}

	.btn-action.live-btn:hover {
		background: #ea580c;
	}

	:global(html[data-theme='dark']) .btn-action {
		background: #1e3a8a;
		color: #bfdbfe;
	}

	:global(html[data-theme='dark']) .btn-action:hover {
		background: #1e40af;
	}

	:global(html[data-theme='dark']) .btn-action.live-btn {
		background: #ea580c;
		color: #ffffff;
	}

	:global(html[data-theme='dark']) .btn-action.live-btn:hover {
		background: #c2410c;
	}

	:global(body) {
		margin: 0;
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Helvetica,
			Arial,
			sans-serif;
		background-color: var(--bg-color, #f8fafc);
		color: var(--text-color, #334155);
	}

	.page-container {
		display: flex;
		justify-content: center;
		padding: 2rem 1rem;
		min-height: calc(100vh - 4rem);
		-webkit-user-select: none;
		user-select: none;
	}

	.page-container input {
		-webkit-user-select: text;
		user-select: text;
	}

	.content-wrapper {
		width: 100%;
		max-width: 1200px;
		transition: max-width 0.3s ease;
	}

	.learn-container {
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
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
		background: var(--card-bg, #ffffff);
		border-radius: 12px;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		padding: 2rem;
		border: 1px solid var(--card-border, #e2e8f0);
		margin-bottom: 1.5rem;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: #f8fafc;
		border: 2px solid var(--card-border, #e2e8f0);
		border-radius: 12px;
	}

	:global(html[data-theme='dark']) .empty-state {
		background: #1e293b;
	}

	.empty-state h2 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #1e293b;
		font-size: 1.5rem;
	}

	:global(html[data-theme='dark']) .empty-state h2 {
		color: #f1f5f9;
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
		border-top-color: #7c3aed;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	.score-spinner {
		display: inline-block;
		width: 1.2rem;
		height: 1.2rem;
		border: 3px solid #e2e8f0;
		border-top-color: #7c3aed;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-state p {
		color: #64748b;
		margin: 0;
	}

	.load-progress-track {
		width: 80%;
		max-width: 320px;
		height: 5px;
		background: #e2e8f0;
		border-radius: 999px;
		margin: 1.25rem auto 0;
		overflow: hidden;
	}

	.load-progress-fill {
		height: 100%;
		background: linear-gradient(to right, #7c3aed, #6d28d9);
		border-radius: 999px;
		transition: width 0.12s linear;
	}

	.load-progress-fill.local-mode-fill {
		background: linear-gradient(to right, #f59e0b, #d97706);
	}

	.load-tip-container {
		min-height: 3.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		margin-top: 1rem;
		width: 100%;
	}

	.load-tip {
		color: #64748b;
		font-size: 0.85rem;
		margin: 0;
		max-width: 380px;
		text-align: center;
		line-height: 1.5;
		position: absolute;
		padding: 0 1rem;
	}

	.challenge-section {
		margin-bottom: 1.5rem;
	}

	.challenge-section h3,
	.feedback-section h3,
	.feedback-list-section h3 {
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
		transition:
			opacity 0.15s,
			visibility 0.15s;
		z-index: 100;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	:global(.word-tooltip::after) {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		margin-left: -5px;
		border-width: 5px;
		border-style: solid;
		border-color: #1e293b transparent transparent transparent;
	}

	.ai-magic-loader {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	:global(.sparkle) {
		display: inline-block;
		animation: pulse-sparkle 1.5s ease-in-out infinite;
	}

	:global(.ai-magic-text) {
		color: #c084fc; /* purple-400 */
		font-weight: 500;
	}

	@keyframes pulse-sparkle {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.8;
		}
		50% {
			transform: scale(1.2);
			opacity: 1;
			filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.6));
		}
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
	}

	:global(.word-tooltip-ai-badge) {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #c4b5fd;
		background: rgba(124, 58, 237, 0.2);
		border: 1px solid rgba(124, 58, 237, 0.35);
		border-radius: 3px;
		padding: 0 0.3em;
		line-height: 1.6;
		flex-shrink: 0;
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

	.concept-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.concept-list li {
		color: #475569;
		margin-bottom: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.grammar-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.grammar-title {
		font-weight: 500;
	}

	.guide-toggle-btn {
		background: none;
		border: none;
		font-size: 0.8rem;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		margin-left: auto;
	}

	.grammar-guide {
		padding: 1.25rem;
		border-radius: 0.75rem;
		font-size: 1rem;
		line-height: 1.6;
		overflow-x: auto;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		color: #334155;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
	}

	:global(html[data-theme='dark']) .grammar-guide {
		background: #0f172a;
		border-color: #1e293b;
		color: #cbd5e1;
	}

	.grammar-guide :global(h1),
	.grammar-guide :global(h2),
	.grammar-guide :global(h3),
	.grammar-guide :global(h4) {
		color: #0f172a;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		font-weight: 700;
		line-height: 1.3;
	}

	:global(html[data-theme='dark']) .grammar-guide :global(h1),
	:global(html[data-theme='dark']) .grammar-guide :global(h2),
	:global(html[data-theme='dark']) .grammar-guide :global(h3),
	:global(html[data-theme='dark']) .grammar-guide :global(h4) {
		color: #f8fafc;
	}

	.grammar-guide :global(h1:first-child),
	.grammar-guide :global(h2:first-child),
	.grammar-guide :global(h3:first-child) {
		margin-top: 0;
	}

	.grammar-guide :global(h1) {
		font-size: 1.5rem;
		border-bottom: 1px solid #e2e8f0;
		padding-bottom: 0.5rem;
	}
	.grammar-guide :global(h2) {
		font-size: 1.25rem;
		border-bottom: 1px solid #e2e8f0;
		padding-bottom: 0.3rem;
	}
	.grammar-guide :global(h3) {
		font-size: 1.1rem;
	}

	:global(html[data-theme='dark']) .grammar-guide :global(h1),
	:global(html[data-theme='dark']) .grammar-guide :global(h2) {
		border-color: #1e293b;
	}

	.grammar-guide :global(p) {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.grammar-guide :global(p:last-child) {
		margin-bottom: 0;
	}

	.grammar-guide :global(ul),
	.grammar-guide :global(ol) {
		margin-top: 0;
		margin-bottom: 1rem;
		padding-left: 1.5rem;
	}

	.grammar-guide :global(li) {
		margin-bottom: 0.25rem;
	}

	.grammar-guide :global(strong),
	.grammar-guide :global(b) {
		font-weight: 700;
		color: #0f172a;
	}

	:global(html[data-theme='dark']) .grammar-guide :global(strong),
	:global(html[data-theme='dark']) .grammar-guide :global(b) {
		color: #f8fafc;
	}

	.grammar-guide :global(em),
	.grammar-guide :global(i) {
		color: #475569;
	}

	:global(html[data-theme='dark']) .grammar-guide :global(em),
	:global(html[data-theme='dark']) .grammar-guide :global(i) {
		color: #94a3b8;
	}

	.grammar-guide :global(code) {
		background: #e2e8f0;
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.85em;
		color: #db2777;
	}

	:global(html[data-theme='dark']) .grammar-guide :global(code) {
		background: #1e293b;
		color: #f472b6;
	}

	.grammar-guide :global(pre) {
		background: #1e293b;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin-bottom: 1rem;
	}

	.grammar-guide :global(pre code) {
		background: transparent;
		color: #e2e8f0;
		padding: 0;
		font-size: 0.9em;
	}

	.grammar-guide :global(blockquote) {
		border-left: 4px solid #3b82f6;
		padding-left: 1rem;
		margin-left: 0;
		margin-right: 0;
		background: #f1f5f9;
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
		border-radius: 0 0.25rem 0.25rem 0;
		font-style: italic;
	}

	:global(html[data-theme='dark']) .grammar-guide :global(blockquote) {
		background: #1e293b;
		border-left-color: #60a5fa;
	}

	.grammar-guide :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1rem;
	}

	.grammar-guide :global(th),
	.grammar-guide :global(td) {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		text-align: left;
	}

	:global(html[data-theme='dark']) .grammar-guide :global(th),
	:global(html[data-theme='dark']) .grammar-guide :global(td) {
		border-color: #334155;
	}

	.grammar-guide :global(th) {
		background: #f1f5f9;
		font-weight: 600;
	}

	:global(html[data-theme='dark']) .grammar-guide :global(th) {
		background: #1e293b;
	}

	.concept-type {
		background: #e2e8f0;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569;
	}

	:global(html[data-theme='dark']) .concept-type {
		background: #334155;
		color: #cbd5e1;
	}

	.answer-form {
		margin-top: 2rem;
	}

	.form-group {
		margin-bottom: 1rem;
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

	:global(html[data-theme='dark']) .feedback-header h2 {
		color: #f1f5f9;
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

	.toggle-container input[type='checkbox'] {
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

	.score-value.excellent {
		color: #16a34a;
	}
	.score-value.good {
		color: #ca8a04;
	}
	.score-value.needs-work {
		color: #dc2626;
	}

	.feedback-message {
		background-color: #eff6ff;
		border-left: 4px solid #3b82f6;
		padding: 1rem;
		border-radius: 0 8px 8px 0;
		margin-bottom: 1.5rem;
		color: #1e3a8a;
		line-height: 1.5;
	}

	:global(html[data-theme='dark']) .feedback-message {
		background-color: #0c1a3a;
		color: #93c5fd;
	}

	.feedback-message p {
		margin: 0;
	}

	.expected-answer {
		background-color: #f0fdf4;
		border: 1px solid #bbf7d0;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
	}

	:global(html[data-theme='dark']) .expected-answer {
		background-color: #0d1f14;
		border-color: #166534;
	}

	.expected-answer p {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 500;
		color: #166534;
	}

	:global(html[data-theme='dark']) .expected-answer p {
		color: #86efac;
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
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 1rem;
		color: #334155;
		font-size: 0.95rem;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.item-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
	}

	.elo-display {
		font-size: 0.8rem;
		font-weight: 700;
		color: #64748b;
		background: #f1f5f9;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		white-space: nowrap;
	}

	:global(html[data-theme='dark']) .elo-display {
		background: #1e293b;
		color: #94a3b8;
	}

	.elo-delta {
		font-size: 0.75rem;
		font-weight: 800;
		margin-left: 0.25rem;
	}

	.elo-delta.positive {
		color: #16a34a;
	}
	.elo-delta.negative {
		color: #dc2626;
	}

	.progress-bar-container {
		height: 0.75rem;
		background-color: #e2e8f0;
		border-radius: 9999px;
		overflow: hidden;
		border: 1.5px solid #cbd5e1;
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
		margin-top: 0.25rem;
		width: 100%;
	}

	:global(html[data-theme='dark']) .progress-bar-container {
		background-color: #1e293b;
		border-color: #334155;
	}

	.progress-bar-fill {
		height: 100%;
		border-radius: 9999px;
		transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
		animation: progress-stripes 1s linear infinite;
	}

	.progress-bar-fill.learning {
		background-color: #facc15;
		background-image: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.15) 25%,
			transparent 25%,
			transparent 50%,
			rgba(255, 255, 255, 0.15) 50%,
			rgba(255, 255, 255, 0.15) 75%,
			transparent 75%,
			transparent
		);
		background-size: 1rem 1rem;
	}

	.progress-bar-fill.known {
		background-color: #34d399;
		background-image: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.15) 25%,
			transparent 25%,
			transparent 50%,
			rgba(255, 255, 255, 0.15) 50%,
			rgba(255, 255, 255, 0.15) 75%,
			transparent 75%,
			transparent
		);
		background-size: 1rem 1rem;
	}

	.progress-bar-fill.mastered {
		background-color: #10b981;
		background-image: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.15) 25%,
			transparent 25%,
			transparent 50%,
			rgba(255, 255, 255, 0.15) 50%,
			rgba(255, 255, 255, 0.15) 75%,
			transparent 75%,
			transparent
		);
		background-size: 1rem 1rem;
	}

	@keyframes progress-stripes {
		from {
			background-position: 1rem 0;
		}
		to {
			background-position: 0 0;
		}
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
		padding: 0.75rem 1.25rem;
		border-radius: 1rem;
		border: 2px solid var(--card-border, #e2e8f0);
		background: var(--card-bg, #ffffff);
		color: var(--text-color, #475569);
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
	}

	.mode-btn:hover {
		border-color: #93c5fd;
		background: #eff6ff;
		transform: translateY(-2px);
		box-shadow: 0 6px 0 #93c5fd;
	}

	:global(html[data-theme='dark']) .mode-btn:hover {
		border-color: #3b82f6;
		background: #1e293b;
		box-shadow: 0 6px 0 #1e3a5f;
	}

	.mode-btn.active {
		border-color: #1cb0f6;
		background: #ddf4ff;
		color: #1cb0f6;
		transform: translateY(2px);
		box-shadow: 0 2px 0 #1899d6;
	}

	:global(html[data-theme='dark']) .mode-btn.active {
		border-color: #38bdf8;
		background: #0c2340;
		color: #38bdf8;
		box-shadow: 0 2px 0 #0e4166;
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
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
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
		border: 2px solid var(--card-border, #e2e8f0);
		border-radius: 1rem;
		background: var(--card-bg, #ffffff);
		color: var(--text-color, #1e293b);
		font-size: 1.05rem;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
	}

	.mc-choice-btn:hover:not(:disabled) {
		border-color: #93c5fd;
		background: #eff6ff;
		transform: translateY(-2px);
		box-shadow: 0 6px 0 #93c5fd;
	}

	.mc-choice-btn.selected {
		border-color: #1cb0f6;
		background: #ddf4ff;
		color: #1cb0f6;
		transform: translateY(2px);
		box-shadow: 0 2px 0 #1899d6;
	}

	.mc-choice-btn.correct {
		border-color: #16a34a;
		background: #f0fdf4;
		color: #166534;
		box-shadow: 0 2px 0 #15803d;
	}

	.mc-choice-btn.incorrect {
		border-color: #dc2626;
		background: #fef2f2;
		color: #991b1b;
		box-shadow: 0 2px 0 #b91c1c;
	}

	.mc-choice-btn:disabled {
		cursor: default;
		opacity: 0.85;
		transform: translateY(2px);
		box-shadow: 0 2px 0 var(--card-border, #e2e8f0);
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

	:global(html[data-theme='dark']) .beginner-tip {
		background: linear-gradient(135deg, #0d1f14 0%, #0d2218 100%);
		border-color: #166534;
		color: #86efac;
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

	:global(html[data-theme='dark']) .mode-difficulty.easy {
		background-color: rgba(22, 101, 52, 0.3);
		color: #86efac;
	}

	:global(html[data-theme='dark']) .mode-difficulty.medium {
		background-color: rgba(133, 77, 14, 0.3);
		color: #fde68a;
	}

	:global(html[data-theme='dark']) .mode-difficulty.hard {
		background-color: rgba(153, 27, 27, 0.3);
		color: #fca5a5;
	}

	/* Assignment Banner Styles */
	.assignment-banner {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
	}

	@media (min-width: 640px) {
		.assignment-banner {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.assignment-banner.passed {
		background-color: #f0fdf4;
		border-color: #bbf7d0;
	}

	.assignment-banner.active {
		background-color: #eff6ff;
		border-color: #bfdbfe;
	}

	.assignment-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
	}

	.assignment-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.assignment-banner.passed .assignment-icon {
		background-color: #dcfce7;
	}

	.assignment-banner.active .assignment-icon {
		background-color: #dbeafe;
	}

	.assignment-details {
		min-width: 0;
	}

	.assignment-title {
		font-weight: 700;
		font-size: 1.125rem;
		margin: 0;
		color: #1e293b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.assignment-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.meta-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		background-color: rgba(255, 255, 255, 0.6);
		color: #475569;
	}

	.meta-badge.gamemode {
		text-transform: capitalize;
	}

	.assignment-actions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	@media (min-width: 640px) {
		.assignment-actions {
			flex-direction: row;
			align-items: center;
			width: auto;
		}
	}

	.progress-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background-color: rgba(255, 255, 255, 0.5);
		border-radius: 0.75rem;
		padding: 0.5rem 1rem;
	}

	@media (min-width: 640px) {
		.progress-box {
			flex-direction: column;
			align-items: flex-end;
			background-color: transparent;
			padding: 0;
		}
	}

	.progress-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		margin: 0 0 0.125rem 0;
	}

	.progress-value {
		font-size: 1.5rem;
		font-weight: 800;
		line-height: 1;
		margin: 0;
	}

	.progress-value.passed {
		color: #16a34a;
	}
	.progress-value.active {
		color: #2563eb;
	}

	.progress-target {
		font-size: 0.875rem;
		font-weight: 600;
		color: #94a3b8;
		margin-left: 0.125rem;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
	}

	/* Dark mode support for assignment banner if implemented */
	:global(html[data-theme='dark']) .assignment-banner.passed {
		background-color: rgba(6, 78, 59, 0.2);
		border-color: rgba(6, 95, 70, 0.5);
	}

	:global(html[data-theme='dark']) .assignment-banner.active {
		background-color: rgba(30, 58, 138, 0.2);
		border-color: rgba(30, 64, 175, 0.5);
	}

	:global(html[data-theme='dark']) .assignment-banner.passed .assignment-icon {
		background-color: rgba(6, 78, 59, 0.5);
	}

	:global(html[data-theme='dark']) .assignment-banner.active .assignment-icon {
		background-color: rgba(30, 58, 138, 0.5);
	}

	:global(html[data-theme='dark']) .assignment-title {
		color: #f1f5f9;
	}

	:global(html[data-theme='dark']) .meta-badge {
		background-color: rgba(30, 41, 59, 0.6);
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .progress-box {
		background-color: rgba(30, 41, 59, 0.5);
	}

	@media (min-width: 640px) {
		:global(html[data-theme='dark']) .progress-box {
			background-color: transparent;
		}
	}

	:global(html[data-theme='dark']) .progress-value.passed {
		color: #34d399;
	}
	:global(html[data-theme='dark']) .progress-value.active {
		color: #60a5fa;
	}

	@media (max-width: 768px) {
		.page-container {
			padding: 1rem 0.5rem;
		}

		.card {
			padding: 1rem;
		}

		.page-header h1 {
			font-size: 2rem;
		}

		.mode-buttons {
			flex-direction: column;
		}

		.mode-btn {
			width: 100%;
			box-sizing: border-box;
		}

		.btn-duo {
			width: 100%;
			box-sizing: border-box;
		}

		.feedback-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.assignment-banner {
			padding: 1rem;
		}
	}

	/* Fix 1 - Chat CTA separated from mode buttons */
	.chat-separator {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1.25rem 0;
		color: #94a3b8;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.separator-line {
		flex: 1;
		height: 1px;
		background: #e2e8f0;
	}

	.chat-cta-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
		padding: 1rem 1.25rem;
		border-radius: 1rem;
		border: 2px dashed #cbd5e1;
		background: #f8fafc;
		color: #475569;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.chat-cta-btn:hover {
		border-color: #93c5fd;
		background: #eff6ff;
		transform: translateY(-2px);
	}

	:global(html[data-theme='dark']) .chat-cta-btn {
		background: #0f172a;
		border-color: #334155;
		color: #cbd5e1;
	}

	:global(html[data-theme='dark']) .chat-cta-btn:hover {
		border-color: #3b82f6;
		background: #1e293b;
	}

	.chat-cta-btn.active {
		border-color: #1cb0f6;
		border-style: solid;
		background: #ddf4ff;
		color: #1cb0f6;
	}

	:global(html[data-theme='dark']) .chat-cta-btn.active {
		border-color: #38bdf8;
		background: #0c2340;
		color: #38bdf8;
	}

	.chat-cta-subtitle {
		font-size: 0.8rem;
		font-weight: 400;
		color: #94a3b8;
	}

	/* Fix 3 - Collapsible grammar reference */
	.grammar-ref-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: none;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		padding: 0.4rem 0.75rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: #64748b;
		cursor: pointer;
		transition: all 0.2s;
	}

	.grammar-ref-toggle:hover {
		color: #3b82f6;
		border-color: #93c5fd;
		background: #eff6ff;
	}

	:global(html[data-theme='dark']) .grammar-ref-toggle {
		border-color: #334155;
	}

	:global(html[data-theme='dark']) .grammar-ref-toggle:hover {
		color: #60a5fa;
		border-color: #3b82f6;
		background: #1e293b;
	}

	.grammar-ref-chevron {
		display: inline-block;
		transition: transform 0.2s;
		font-size: 0.75rem;
	}

	.grammar-ref-chevron.expanded {
		transform: rotate(180deg);
	}

	/* Fix 4 - Change Mode link */
	.change-mode-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: none;
		font-size: 0.85rem;
		font-weight: 500;
		color: #64748b;
		cursor: pointer;
		padding: 0;
		margin-bottom: 1rem;
		transition: color 0.15s;
	}

	.change-mode-link:hover {
		color: #3b82f6;
	}

	/* Fix 5 - Load More button */
	.btn-load-more {
		padding: 0.625rem 1.75rem;
		border-radius: 0.75rem;
		font-weight: 600;
		font-size: 0.95rem;
		background: transparent;
		color: #3b82f6;
		border: 2px solid #3b82f6;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}

	.btn-load-more:hover {
		background: #eff6ff;
	}

	.btn-load-more:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(html[data-theme='dark']) .btn-load-more {
		color: #60a5fa;
		border-color: #60a5fa;
	}

	:global(html[data-theme='dark']) .btn-load-more:hover {
		background: #1e293b;
	}

	/* Fix 6 - Category filter pills */
	.category-pills {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.filter-pill {
		padding: 0.4rem 1rem;
		border-radius: 9999px;
		font-size: 0.85rem;
		font-weight: 600;
		white-space: nowrap;
		background: #f1f5f9;
		color: #64748b;
		border: 1px solid #e2e8f0;
		cursor: pointer;
		transition: all 0.2s;
	}

	.filter-pill:hover {
		background: #e2e8f0;
		color: #334155;
	}

	.filter-pill.active {
		background: #dbeafe;
		color: #1d4ed8;
		border-color: #93c5fd;
	}

	:global(html[data-theme='dark']) .filter-pill {
		background: #1e293b;
		color: #94a3b8;
		border-color: #334155;
	}

	:global(html[data-theme='dark']) .filter-pill:hover {
		background: #334155;
		color: #f1f5f9;
	}

	:global(html[data-theme='dark']) .filter-pill.active {
		background: #1e3a8a;
		color: #93c5fd;
		border-color: #3b82f6;
	}

	/* Fix 7 - Visual divider between game sections */
	.games-divider {
		border: none;
		border-top: 2px solid #e2e8f0;
		margin: 1rem 0;
	}

	:global(html[data-theme='dark']) .games-divider {
		border-top-color: #334155;
	}

	.community-games-section {
		background: #f8fafc;
		border-radius: 1rem;
		padding: 1.5rem;
		border: 1px solid #e2e8f0;
	}

	:global(html[data-theme='dark']) .community-games-section {
		background: #0f172a;
		border-color: #1e293b;
	}
</style>
