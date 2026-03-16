import type { LanguageConfig } from './types';

const italian: LanguageConfig = {
	name: 'Italian',
	code: 'it',
	flag: '🇮🇹',

	specialChars: ['à', 'è', 'é', 'ì', 'í', 'î', 'ò', 'ó', 'ù', 'ú'],

	asciiReplacements: [],

	articleMap: {
		// Definite articles
		il: { definite: true, forms: [{ caseLabel: 'Masc. Sing.', nomArticle: 'il' }] },
		lo: {
			definite: true,
			forms: [{ caseLabel: 'Masc. Sing. (before z/s+cons.)', nomArticle: 'lo' }]
		},
		la: { definite: true, forms: [{ caseLabel: 'Fem. Sing.', nomArticle: 'la' }] },
		"l'": {
			definite: true,
			forms: [{ caseLabel: 'Masc./Fem. Sing. (before vowel)', nomArticle: "l'" }]
		},
		i: { definite: true, forms: [{ caseLabel: 'Masc. Pl.', nomArticle: 'i' }] },
		gli: {
			definite: true,
			forms: [{ caseLabel: 'Masc. Pl. (before vowel/z/s+cons.)', nomArticle: 'gli' }]
		},
		le: { definite: true, forms: [{ caseLabel: 'Fem. Pl.', nomArticle: 'le' }] },
		// Indefinite articles
		un: { definite: false, forms: [{ caseLabel: 'Masc. Sing.', nomArticle: 'un' }] },
		uno: {
			definite: false,
			forms: [{ caseLabel: 'Masc. Sing. (before z/s+cons.)', nomArticle: 'uno' }]
		},
		una: { definite: false, forms: [{ caseLabel: 'Fem. Sing.', nomArticle: 'una' }] },
		"un'": {
			definite: false,
			forms: [{ caseLabel: 'Fem. Sing. (before vowel)', nomArticle: "un'" }]
		}
	},

	inflectionMap: {
		// essere (to be)
		sono: { lemma: 'essere', note: 'io/loro sono (I am / they are)' },
		sei: { lemma: 'essere', note: 'tu sei (you are)' },
		è: { lemma: 'essere', note: 'lui/lei è (he/she/it is)' },
		siamo: { lemma: 'essere', note: 'noi siamo (we are)' },
		siete: { lemma: 'essere', note: 'voi siete (you all are)' },
		ero: { lemma: 'essere', note: 'io ero (I was)' },
		eri: { lemma: 'essere', note: 'tu eri (you were)' },
		era: { lemma: 'essere', note: 'lui/lei era (was)' },
		eravamo: { lemma: 'essere', note: 'noi eravamo (we were)' },
		eravate: { lemma: 'essere', note: 'voi eravate (you all were)' },
		erano: { lemma: 'essere', note: 'loro erano (they were)' },
		stato: { lemma: 'essere', note: 'past participle of essere (masc.)' },
		stata: { lemma: 'essere', note: 'past participle of essere (fem.)' },
		stati: { lemma: 'essere', note: 'past participle of essere (masc. pl.)' },
		state: { lemma: 'essere', note: 'past participle of essere (fem. pl.)' },

		// avere (to have)
		ho: { lemma: 'avere', note: 'io ho (I have)' },
		hai: { lemma: 'avere', note: 'tu hai (you have)' },
		ha: { lemma: 'avere', note: 'lui/lei ha (has)' },
		abbiamo: { lemma: 'avere', note: 'noi abbiamo (we have)' },
		avete: { lemma: 'avere', note: 'voi avete (you all have)' },
		hanno: { lemma: 'avere', note: 'loro hanno (they have)' },
		avevo: { lemma: 'avere', note: 'io avevo (I had)' },
		avevi: { lemma: 'avere', note: 'tu avevi (you had)' },
		aveva: { lemma: 'avere', note: 'lui/lei aveva (had)' },
		avevamo: { lemma: 'avere', note: 'noi avevamo (we had)' },
		avevate: { lemma: 'avere', note: 'voi avevate (you all had)' },
		avevano: { lemma: 'avere', note: 'loro avevano (they had)' },
		avuto: { lemma: 'avere', note: 'past participle of avere' },

		// fare (to do/make)
		faccio: { lemma: 'fare', note: 'io faccio (I do/make)' },
		fai: { lemma: 'fare', note: 'tu fai (you do/make)' },
		fa: { lemma: 'fare', note: 'lui/lei fa (does/makes)' },
		facciamo: { lemma: 'fare', note: 'noi facciamo (we do/make)' },
		fate: { lemma: 'fare', note: 'voi fate (you all do/make)' },
		fanno: { lemma: 'fare', note: 'loro fanno (they do/make)' },
		facevo: { lemma: 'fare', note: 'io facevo (I was doing)' },
		faceva: { lemma: 'fare', note: 'lui/lei faceva (was doing)' },
		facevano: { lemma: 'fare', note: 'loro facevano (they were doing)' },
		fatto: { lemma: 'fare', note: 'past participle of fare' },

		// andare (to go)
		vado: { lemma: 'andare', note: 'io vado (I go)' },
		vai: { lemma: 'andare', note: 'tu vai (you go)' },
		va: { lemma: 'andare', note: 'lui/lei va (goes)' },
		andiamo: { lemma: 'andare', note: 'noi andiamo (we go)' },
		andate: { lemma: 'andare', note: 'voi andate (you all go)' },
		vanno: { lemma: 'andare', note: 'loro vanno (they go)' },
		andavo: { lemma: 'andare', note: 'io andavo (I was going)' },
		andava: { lemma: 'andare', note: 'lui/lei andava (was going)' },
		andavano: { lemma: 'andare', note: 'loro andavano (they were going)' },
		andato: { lemma: 'andare', note: 'past participle of andare (masc.)' },
		andata: { lemma: 'andare', note: 'past participle of andare (fem.)' },

		// potere (can/be able to)
		posso: { lemma: 'potere', note: 'io posso (I can)' },
		puoi: { lemma: 'potere', note: 'tu puoi (you can)' },
		può: { lemma: 'potere', note: 'lui/lei può (can)' },
		possiamo: { lemma: 'potere', note: 'noi possiamo (we can)' },
		potete: { lemma: 'potere', note: 'voi potete (you all can)' },
		possono: { lemma: 'potere', note: 'loro possono (they can)' },
		potevo: { lemma: 'potere', note: 'io potevo (I could)' },
		poteva: { lemma: 'potere', note: 'lui/lei poteva (could)' },
		potevano: { lemma: 'potere', note: 'loro potevano (they could)' },
		potuto: { lemma: 'potere', note: 'past participle of potere' },

		// volere (to want)
		voglio: { lemma: 'volere', note: 'io voglio (I want)' },
		vuoi: { lemma: 'volere', note: 'tu vuoi (you want)' },
		vuole: { lemma: 'volere', note: 'lui/lei vuole (wants)' },
		vogliamo: { lemma: 'volere', note: 'noi vogliamo (we want)' },
		volete: { lemma: 'volere', note: 'voi volete (you all want)' },
		vogliono: { lemma: 'volere', note: 'loro vogliono (they want)' },
		volevo: { lemma: 'volere', note: 'io volevo (I wanted)' },
		voleva: { lemma: 'volere', note: 'lui/lei voleva (wanted)' },
		volevano: { lemma: 'volere', note: 'loro volevano (they wanted)' },
		voluto: { lemma: 'volere', note: 'past participle of volere' },

		// dovere (must/have to)
		devo: { lemma: 'dovere', note: 'io devo (I must)' },
		devi: { lemma: 'dovere', note: 'tu devi (you must)' },
		deve: { lemma: 'dovere', note: 'lui/lei deve (must)' },
		dobbiamo: { lemma: 'dovere', note: 'noi dobbiamo (we must)' },
		dovete: { lemma: 'dovere', note: 'voi dovete (you all must)' },
		devono: { lemma: 'dovere', note: 'loro devono (they must)' },
		dovevo: { lemma: 'dovere', note: 'io dovevo (I had to)' },
		doveva: { lemma: 'dovere', note: 'lui/lei doveva (had to)' },
		dovevano: { lemma: 'dovere', note: 'loro dovevano (they had to)' },
		dovuto: { lemma: 'dovere', note: 'past participle of dovere' },

		// sapere (to know)
		so: { lemma: 'sapere', note: 'io so (I know)' },
		sai: { lemma: 'sapere', note: 'tu sai (you know)' },
		sa: { lemma: 'sapere', note: 'lui/lei sa (knows)' },
		sappiamo: { lemma: 'sapere', note: 'noi sappiamo (we know)' },
		sapete: { lemma: 'sapere', note: 'voi sapete (you all know)' },
		sanno: { lemma: 'sapere', note: 'loro sanno (they know)' },
		sapevo: { lemma: 'sapere', note: 'io sapevo (I knew)' },
		sapeva: { lemma: 'sapere', note: 'lui/lei sapeva (knew)' },
		sapevano: { lemma: 'sapere', note: 'loro sapevano (they knew)' },
		saputo: { lemma: 'sapere', note: 'past participle of sapere' },

		// stare (to stay/be — location/state/progressive)
		sto: { lemma: 'stare', note: 'io sto (I am/stay)' },
		stai: { lemma: 'stare', note: 'tu stai (you are/stay)' },
		sta: { lemma: 'stare', note: 'lui/lei sta (is/stays)' },
		stiamo: { lemma: 'stare', note: 'noi stiamo (we are/stay)' },
		// state: already in essere above — not added again
		stanno: { lemma: 'stare', note: 'loro stanno (they are/stay)' },
		stavo: { lemma: 'stare', note: 'io stavo (I was/stayed)' },
		stava: { lemma: 'stare', note: 'lui/lei stava (was/stayed)' },
		stavano: { lemma: 'stare', note: 'loro stavano (they were/stayed)' },

		// venire (to come)
		vengo: { lemma: 'venire', note: 'io vengo (I come)' },
		vieni: { lemma: 'venire', note: 'tu vieni (you come)' },
		viene: { lemma: 'venire', note: 'lui/lei viene (comes)' },
		veniamo: { lemma: 'venire', note: 'noi veniamo (we come)' },
		venite: { lemma: 'venire', note: 'voi venite (you all come)' },
		vengono: { lemma: 'venire', note: 'loro vengono (they come)' },
		venivo: { lemma: 'venire', note: 'io venivo (I was coming)' },
		veniva: { lemma: 'venire', note: 'lui/lei veniva (was coming)' },
		venivano: { lemma: 'venire', note: 'loro venivano (they were coming)' },
		venuto: { lemma: 'venire', note: 'past participle of venire (masc.)' },
		venuta: { lemma: 'venire', note: 'past participle of venire (fem.)' },

		// dire (to say/tell)
		dico: { lemma: 'dire', note: 'io dico (I say)' },
		dici: { lemma: 'dire', note: 'tu dici (you say)' },
		dice: { lemma: 'dire', note: 'lui/lei dice (says)' },
		diciamo: { lemma: 'dire', note: 'noi diciamo (we say)' },
		dite: { lemma: 'dire', note: 'voi dite (you all say)' },
		dicono: { lemma: 'dire', note: 'loro dicono (they say)' },
		dicevo: { lemma: 'dire', note: 'io dicevo (I was saying)' },
		diceva: { lemma: 'dire', note: 'lui/lei diceva (was saying)' },
		dicevano: { lemma: 'dire', note: 'loro dicevano (they were saying)' },
		detto: { lemma: 'dire', note: 'past participle of dire' },

		// dare (to give)
		do: { lemma: 'dare', note: 'io do (I give)' },
		dai: { lemma: 'dare', note: 'tu dai (you give)' },
		dà: { lemma: 'dare', note: 'lui/lei dà (gives)' },
		diamo: { lemma: 'dare', note: 'noi diamo (we give)' },
		danno: { lemma: 'dare', note: 'loro danno (they give)' },
		davo: { lemma: 'dare', note: 'io davo (I was giving)' },
		dava: { lemma: 'dare', note: 'lui/lei dava (was giving)' },
		davano: { lemma: 'dare', note: 'loro davano (they were giving)' },
		dato: { lemma: 'dare', note: 'past participle of dare' },

		// Contractions with prepositions
		al: { lemma: 'a', note: 'al = a + il (to/at the, masc. sing.)' },
		allo: { lemma: 'a', note: 'allo = a + lo (to/at the, masc. sing. before z/s+cons.)' },
		alla: { lemma: 'a', note: 'alla = a + la (to/at the, fem. sing.)' },
		ai: { lemma: 'a', note: 'ai = a + i (to/at the, masc. pl.)' },
		agli: { lemma: 'a', note: 'agli = a + gli (to/at the, masc. pl. before vowel/z/s+cons.)' },
		alle: { lemma: 'a', note: 'alle = a + le (to/at the, fem. pl.)' },
		del: { lemma: 'di', note: 'del = di + il (of/from the, masc. sing.)' },
		dello: { lemma: 'di', note: 'dello = di + lo (of/from the, masc. sing. before z/s+cons.)' },
		della: { lemma: 'di', note: 'della = di + la (of/from the, fem. sing.)' },
		dei: { lemma: 'di', note: 'dei = di + i (of/from the, masc. pl.)' },
		degli: { lemma: 'di', note: 'degli = di + gli (of/from the, masc. pl.)' },
		delle: { lemma: 'di', note: 'delle = di + le (of/from the, fem. pl.)' },
		dal: { lemma: 'da', note: 'dal = da + il (from/by the, masc. sing.)' },
		dalla: { lemma: 'da', note: 'dalla = da + la (from/by the, fem. sing.)' },
		dagli: { lemma: 'da', note: 'dagli = da + gli (from/by the, masc. pl.)' },
		dalle: { lemma: 'da', note: 'dalle = da + le (from/by the, fem. pl.)' },
		nel: { lemma: 'in', note: 'nel = in + il (in the, masc. sing.)' },
		nello: { lemma: 'in', note: 'nello = in + lo (in the, masc. sing. before z/s+cons.)' },
		nella: { lemma: 'in', note: 'nella = in + la (in the, fem. sing.)' },
		nei: { lemma: 'in', note: 'nei = in + i (in the, masc. pl.)' },
		negli: { lemma: 'in', note: 'negli = in + gli (in the, masc. pl.)' },
		nelle: { lemma: 'in', note: 'nelle = in + le (in the, fem. pl.)' },
		sul: { lemma: 'su', note: 'sul = su + il (on the, masc. sing.)' },
		sullo: { lemma: 'su', note: 'sullo = su + lo (on the, masc. sing. before z/s+cons.)' },
		sulla: { lemma: 'su', note: 'sulla = su + la (on the, fem. sing.)' },
		sui: { lemma: 'su', note: 'sui = su + i (on the, masc. pl.)' },
		sugli: { lemma: 'su', note: 'sugli = su + gli (on the, masc. pl.)' },
		sulle: { lemma: 'su', note: 'sulle = su + le (on the, fem. pl.)' }
	},

	genderToArticle(gender: string): string | null {
		const g = gender.toUpperCase();
		if (g === 'MASCULINE' || g === 'IL') return 'il';
		if (g === 'FEMININE' || g === 'LA') return 'la';
		return null;
	},

	defaultDefiniteArticle: 'il/la',
	defaultIndefiniteArticle: 'un/una',
	pluralDefiniteArticle: 'i/le',
	definiteToIndefinite: { il: 'un', lo: 'uno', la: 'una' },

	hasGender: true,
	capitalizeNouns: false,
	onboardingGreeting:
		'Ciao! Sono entusiasta di scoprire il tuo livello di italiano. Come ti chiami? (What is your name?)',
	stemSuffixes: [
		// Present tense endings (-are, -ere, -ire)
		'o',
		'i',
		'a',
		'iamo',
		'ate',
		'ete',
		'ite',
		'ano',
		'ono',
		// Imperfect endings
		'avo',
		'avi',
		'ava',
		'avamo',
		'avate',
		'avano',
		'evo',
		'evi',
		'eva',
		'evamo',
		'evate',
		'evano',
		'ivo',
		'ivi',
		'iva',
		'ivamo',
		'ivate',
		'ivano',
		// Past participles
		'ato',
		'ata',
		'ati',
		'ate',
		'uto',
		'uta',
		'uti',
		'ute',
		'ito',
		'ita',
		'iti',
		'ite',
		// Infinitive endings
		'are',
		'ere',
		'ire',
		// Noun/adjective plurals
		'e',
		's'
	],
	stemWithSnowball: false,

	llmConstraintPrompt:
		"Agite come un revisore italiano esperto. Scrivete il testo in un italiano impeccabile (conforme all'Accademia della Crusca) ed evitate anglicismi o grafie inglesi per i termini correlati. Fate particolare attenzione a non usare la grafia inglese per le parole italiane.",

	destinations: [
		{
			city: 'Rome',
			country: 'Italy',
			emoji: '🇮🇹',
			description: 'The Eternal City — ancient ruins, piazzas, and la dolce vita'
		},
		{
			city: 'Milan',
			country: 'Italy',
			emoji: '🇮🇹',
			description: "Italy's fashion and finance capital with Gothic grandeur"
		},
		{
			city: 'Florence',
			country: 'Italy',
			emoji: '🇮🇹',
			description: "Birthplace of the Renaissance, home to Michelangelo's David"
		},
		{
			city: 'Venice',
			country: 'Italy',
			emoji: '🇮🇹',
			description: 'Floating city of canals, gondolas, and Carnival masks'
		},
		{
			city: 'Naples',
			country: 'Italy',
			emoji: '🇮🇹',
			description: 'Birthplace of pizza, overlooking Vesuvius and the Bay'
		},
		{
			city: 'Bologna',
			country: 'Italy',
			emoji: '🇮🇹',
			description: 'La Grassa — food capital of Italy with arcaded medieval streets'
		},
		{
			city: 'Turin',
			country: 'Italy',
			emoji: '🇮🇹',
			description: "Northern elegance: baroque avenues, chocolate, and Fiat's birthplace"
		},
		{
			city: 'Palermo',
			country: 'Italy',
			emoji: '🇮🇹',
			description:
				"Sicily's chaotic, vibrant capital of street markets and Arab-Norman architecture"
		},
		{
			city: 'Genoa',
			country: 'Italy',
			emoji: '🇮🇹',
			description: 'Maritime republic of caruggi alleys, pesto, and Christopher Columbus'
		},
		{
			city: 'Verona',
			country: 'Italy',
			emoji: '🇮🇹',
			description: "Romeo and Juliet's city — Roman amphitheatre and rose-lined piazzas"
		}
	]
};

export default italian;
