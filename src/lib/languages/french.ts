import type { LanguageConfig } from './types';

const french: LanguageConfig = {
	name: 'French',
	code: 'fr',
	flag: '🇫🇷',

	specialChars: ['à', 'â', 'æ', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'œ', 'ù', 'û', 'ü', 'ÿ'],

	asciiReplacements: [],

	articleMap: {
		le: { definite: true, forms: [{ caseLabel: 'Masc. Sing.', nomArticle: 'le' }] },
		la: { definite: true, forms: [{ caseLabel: 'Fem. Sing.', nomArticle: 'la' }] },
		les: { definite: true, forms: [{ caseLabel: 'Plural', nomArticle: 'les' }] },
		un: { definite: false, forms: [{ caseLabel: 'Masc. Sing.', nomArticle: 'un' }] },
		une: { definite: false, forms: [{ caseLabel: 'Fem. Sing.', nomArticle: 'une' }] },
		des: { definite: false, forms: [{ caseLabel: 'Plural', nomArticle: 'des' }] }
	},

	inflectionMap: {
		// être (to be)
		suis: { lemma: 'être', note: 'je suis (I am)' },
		es: { lemma: 'être', note: 'tu es (you are)' },
		est: { lemma: 'être', note: 'il/elle/on est (he/she/it is)' },
		sommes: { lemma: 'être', note: 'nous sommes (we are)' },
		êtes: { lemma: 'être', note: 'vous êtes (you all are)' },
		sont: { lemma: 'être', note: 'ils/elles sont (they are)' },
		étais: { lemma: 'être', note: 'je/tu étais (was/were)' },
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
		été: { lemma: 'être', note: 'past participle of être' },

		// avoir (to have)
		ai: { lemma: 'avoir', note: "j'ai (I have)" },
		as: { lemma: 'avoir', note: 'tu as (you have)' },
		a: { lemma: 'avoir', note: 'il/elle a (has)' },
		avons: { lemma: 'avoir', note: 'nous avons (we have)' },
		avez: { lemma: 'avoir', note: 'vous avez (you all have)' },
		ont: { lemma: 'avoir', note: 'ils/elles ont (they have)' },
		avais: { lemma: 'avoir', note: 'je/tu avais (had)' },
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
		eu: { lemma: 'avoir', note: 'past participle of avoir' },

		// aller (to go)
		vais: { lemma: 'aller', note: 'je vais (I go)' },
		vas: { lemma: 'aller', note: 'tu vas (you go)' },
		va: { lemma: 'aller', note: 'il/elle va (goes)' },
		allons: { lemma: 'aller', note: 'nous allons (we go)' },
		allez: { lemma: 'aller', note: 'vous allez (you all go)' },
		vont: { lemma: 'aller', note: 'ils/elles vont (they go)' },
		allais: { lemma: 'aller', note: 'je/tu allais (was going)' },
		allait: { lemma: 'aller', note: 'il/elle allait (was going)' },
		allé: { lemma: 'aller', note: 'past participle of aller (masc.)' },
		allée: { lemma: 'aller', note: 'past participle of aller (fem.)' },

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
		du: { lemma: 'de', note: 'du = de + le (of the / from the)' }
		// Note: "des" is in articleMap as indefinite plural — the contraction
		// de+les is the same surface form, handled there.
	},

	genderToArticle(gender: string): string | null {
		const g = gender.toUpperCase();
		if (g === 'MASCULINE' || g === 'LE') return 'le';
		if (g === 'FEMININE' || g === 'LA') return 'la';
		return null;
	},

	defaultDefiniteArticle: 'le/la/les',
	defaultIndefiniteArticle: 'un/une/des',
	pluralDefiniteArticle: 'les',
	definiteToIndefinite: { le: 'un', la: 'une' },

	hasGender: true,
	capitalizeNouns: false,
	onboardingGreeting:
		'Bonjour ! (Hello!) Je suis ravi de découvrir votre niveau de français. Comment vous appelez-vous ? (What is your name?)',
	stemSuffixes: [
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
	],
	stemWithSnowball: false,

	llmConstraintPrompt:
		"Agissez en tant que relecteur français expérimenté. Écrivez le texte dans un français impeccable (conforme à l'Académie française) et évitez les anglicismes ou les orthographes anglaises pour les termes apparentés. Veillez particulièrement à ne pas utiliser l'orthographe anglaise pour les mots français.",

	destinations: [
		{
			city: 'Paris',
			country: 'France',
			emoji: '🇫🇷',
			description: 'The City of Light — fashion, cuisine, and the Eiffel Tower'
		},
		{
			city: 'Lyon',
			country: 'France',
			emoji: '🇫🇷',
			description: "France's gastronomic capital and UNESCO heritage city"
		},
		{
			city: 'Marseille',
			country: 'France',
			emoji: '🇫🇷',
			description: 'Sun-drenched port city of bouillabaisse and calanques'
		},
		{
			city: 'Montreal',
			country: 'Canada',
			emoji: '🇨🇦',
			description: "North America's French heart — festivals and poutine"
		},
		{
			city: 'Quebec City',
			country: 'Canada',
			emoji: '🇨🇦',
			description: 'Fortified old town with a distinctly European feel'
		},
		{
			city: 'Brussels',
			country: 'Belgium',
			emoji: '🇧🇪',
			description: "Chocolate, waffles, and the EU's administrative capital"
		},
		{
			city: 'Geneva',
			country: 'Switzerland',
			emoji: '🇨🇭',
			description: 'International diplomacy on the shores of Lake Leman'
		},
		{
			city: 'Dakar',
			country: 'Senegal',
			emoji: '🇸🇳',
			description: "West Africa's vibrant gateway to the Francophone world"
		},
		{
			city: 'Abidjan',
			country: "Cote d'Ivoire",
			emoji: '🇨🇮',
			description: "Cote d'Ivoire's dynamic economic powerhouse"
		},
		{
			city: 'Casablanca',
			country: 'Morocco',
			emoji: '🇲🇦',
			description: 'Atlantic port city where French and Arabic cultures meet'
		}
	]
};

export default french;
