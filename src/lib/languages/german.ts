import type { LanguageConfig } from './types';

const german: LanguageConfig = {
	name: 'German',
	code: 'de',
	flag: '🇩🇪',

	specialChars: ['ä', 'ö', 'ü', 'ß'],

	asciiReplacements: [
		{ from: /ae/g, to: 'ä' },
		{ from: /oe/g, to: 'ö' },
		{ from: /ue/g, to: 'ü' },
		{ from: /Ae/g, to: 'Ä' },
		{ from: /Oe/g, to: 'Ö' },
		{ from: /Ue/g, to: 'Ü' }
	],

	articleMap: {
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
	},

	inflectionMap: {
		// sein (to be)
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
		// haben (to have)
		habe: { lemma: 'haben', note: 'ich habe (I have)' },
		hast: { lemma: 'haben', note: 'du hast (you have)' },
		hat: { lemma: 'haben', note: 'er/sie/es hat (he/she/it has)' },
		habt: { lemma: 'haben', note: 'ihr habt (you all have)' },
		hatte: { lemma: 'haben', note: 'ich/er hatte (I/he had)' },
		hattest: { lemma: 'haben', note: 'du hattest (you had)' },
		hatten: { lemma: 'haben', note: 'wir/sie hatten (we/they had)' },
		hattet: { lemma: 'haben', note: 'ihr hattet (you all had)' },
		gehabt: { lemma: 'haben', note: 'past participle of haben' },
		// werden (to become)
		werde: { lemma: 'werden', note: 'ich werde (I become/will)' },
		wirst: { lemma: 'werden', note: 'du wirst (you become/will)' },
		wird: { lemma: 'werden', note: 'er/sie/es wird (becomes/will)' },
		werdet: { lemma: 'werden', note: 'ihr werdet (you all become/will)' },
		wurde: { lemma: 'werden', note: 'ich/er wurde (became/was)' },
		wurdest: { lemma: 'werden', note: 'du wurdest (you became)' },
		wurden: { lemma: 'werden', note: 'wir/sie wurden (became/were)' },
		geworden: { lemma: 'werden', note: 'past participle of werden' },
		// können (can)
		kann: { lemma: 'können', note: 'ich/er kann (I/he can)' },
		kannst: { lemma: 'können', note: 'du kannst (you can)' },
		könnt: { lemma: 'können', note: 'ihr könnt (you all can)' },
		konnte: { lemma: 'können', note: 'ich/er konnte (could)' },
		konntest: { lemma: 'können', note: 'du konntest (you could)' },
		konnten: { lemma: 'können', note: 'wir/sie konnten (could)' },
		gekonnt: { lemma: 'können', note: 'past participle of können' },
		// müssen (must)
		muss: { lemma: 'müssen', note: 'ich/er muss (I/he must)' },
		musst: { lemma: 'müssen', note: 'du musst (you must)' },
		müsst: { lemma: 'müssen', note: 'ihr müsst (you all must)' },
		musste: { lemma: 'müssen', note: 'ich/er musste (had to)' },
		musstest: { lemma: 'müssen', note: 'du musstest (you had to)' },
		mussten: { lemma: 'müssen', note: 'wir/sie mussten (had to)' },
		gemusst: { lemma: 'müssen', note: 'past participle of müssen' },
		// wollen (to want)
		will: { lemma: 'wollen', note: 'ich/er will (I/he want(s))' },
		willst: { lemma: 'wollen', note: 'du willst (you want)' },
		wollt: { lemma: 'wollen', note: 'ihr wollt (you all want)' },
		wollte: { lemma: 'wollen', note: 'ich/er wollte (wanted)' },
		wolltest: { lemma: 'wollen', note: 'du wolltest (you wanted)' },
		wollten: { lemma: 'wollen', note: 'wir/sie wollten (wanted)' },
		gewollt: { lemma: 'wollen', note: 'past participle of wollen' },
		// sollen (should)
		soll: { lemma: 'sollen', note: 'ich/er soll (I/he should)' },
		sollst: { lemma: 'sollen', note: 'du sollst (you should)' },
		sollt: { lemma: 'sollen', note: 'ihr sollt (you all should)' },
		sollte: { lemma: 'sollen', note: 'ich/er sollte (should)' },
		solltest: { lemma: 'sollen', note: 'du solltest (you should)' },
		sollten: { lemma: 'sollen', note: 'wir/sie sollten (should)' },
		gesollt: { lemma: 'sollen', note: 'past participle of sollen' },
		// dürfen (may)
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
	},

	genderToArticle(gender: string): string | null {
		const g = gender.toUpperCase();
		if (g === 'MASCULINE' || g === 'DER') return 'der';
		if (g === 'FEMININE' || g === 'DIE') return 'die';
		if (g === 'NEUTER' || g === 'DAS') return 'das';
		return null;
	},

	defaultDefiniteArticle: 'der/die/das',
	defaultIndefiniteArticle: 'ein/eine',
	pluralDefiniteArticle: 'die',
	definiteToIndefinite: { der: 'ein', die: 'eine', das: 'ein' },

	hasGender: true,
	capitalizeNouns: true,
	onboardingGreeting:
		'Hallo! (Hello!) Ich freue mich darauf, herauszufinden, wie gut dein Deutsch bereits ist. Wie heißt du? (What is your name?)',
	stemSuffixes: ['en', 'em', 'st', 't', 'e', 's'],
	stemWithSnowball: true,

	llmConstraintPrompt:
		"Agieren Sie als erfahrener deutscher Lektor. Schreiben Sie den Text in fehlerfreiem Hochdeutsch (Duden-Konform) und vermeiden Sie Anglizismen oder englische Schreibweisen bei verwandten Begriffen. Achten Sie besonders darauf, keine englischen Schreibweisen für deutsche Wörter zu verwenden (z.B. 'oft' statt 'often', 'kollektiv' statt 'collective')."
};

export default german;
