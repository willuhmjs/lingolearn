import type { LanguageConfig } from './types';

const spanish: LanguageConfig = {
	name: 'Spanish',
	code: 'es',
	flag: '🇪🇸',

	specialChars: ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'],

	asciiReplacements: [],

	articleMap: {
		el: { definite: true, forms: [{ caseLabel: 'Masc. Sing.', nomArticle: 'el' }] },
		la: { definite: true, forms: [{ caseLabel: 'Fem. Sing.', nomArticle: 'la' }] },
		los: { definite: true, forms: [{ caseLabel: 'Masc. Pl.', nomArticle: 'los' }] },
		las: { definite: true, forms: [{ caseLabel: 'Fem. Pl.', nomArticle: 'las' }] },
		un: { definite: false, forms: [{ caseLabel: 'Masc. Sing.', nomArticle: 'un' }] },
		una: { definite: false, forms: [{ caseLabel: 'Fem. Sing.', nomArticle: 'una' }] },
		unos: { definite: false, forms: [{ caseLabel: 'Masc. Pl.', nomArticle: 'unos' }] },
		unas: { definite: false, forms: [{ caseLabel: 'Fem. Pl.', nomArticle: 'unas' }] },
		al: { definite: true, forms: [{ caseLabel: 'Masc. Sing. (a + el)', nomArticle: 'el' }] },
		del: { definite: true, forms: [{ caseLabel: 'Masc. Sing. (de + el)', nomArticle: 'el' }] }
	},

	inflectionMap: {
		// ser (to be — permanent)
		soy: { lemma: 'ser', note: 'yo soy (I am)' },
		eres: { lemma: 'ser', note: 'tú eres (you are)' },
		somos: { lemma: 'ser', note: 'nosotros somos (we are)' },
		sois: { lemma: 'ser', note: 'vosotros sois (you all are)' },
		son: { lemma: 'ser', note: 'ellos/ellas son (they are)' },
		era: { lemma: 'ser', note: 'yo/él era (was)' },
		eras: { lemma: 'ser', note: 'tú eras (you were)' },
		fue: { lemma: 'ser', note: 'yo/él fue (was)' },
		sido: { lemma: 'ser', note: 'past participle of ser' },

		// estar (to be — temporary/location)
		estoy: { lemma: 'estar', note: 'yo estoy (I am)' },
		estás: { lemma: 'estar', note: 'tú estás (you are)' },
		está: { lemma: 'estar', note: 'él/ella está (is)' },
		estamos: { lemma: 'estar', note: 'nosotros estamos (we are)' },
		estáis: { lemma: 'estar', note: 'vosotros estáis (you all are)' },
		están: { lemma: 'estar', note: 'ellos/ellas están (they are)' },
		estado: { lemma: 'estar', note: 'past participle of estar' },

		// tener (to have)
		tengo: { lemma: 'tener', note: 'yo tengo (I have)' },
		tienes: { lemma: 'tener', note: 'tú tienes (you have)' },
		tiene: { lemma: 'tener', note: 'él/ella tiene (has)' },
		tenemos: { lemma: 'tener', note: 'nosotros tenemos (we have)' },
		tenéis: { lemma: 'tener', note: 'vosotros tenéis (you all have)' },
		tienen: { lemma: 'tener', note: 'ellos/ellas tienen (they have)' },
		tenido: { lemma: 'tener', note: 'past participle of tener' },

		// hacer (to do/make)
		hago: { lemma: 'hacer', note: 'yo hago (I do/make)' },
		haces: { lemma: 'hacer', note: 'tú haces (you do/make)' },
		hace: { lemma: 'hacer', note: 'él/ella hace (does/makes)' },
		hacemos: { lemma: 'hacer', note: 'nosotros hacemos (we do/make)' },
		hacéis: { lemma: 'hacer', note: 'vosotros hacéis (you all do/make)' },
		hacen: { lemma: 'hacer', note: 'ellos/ellas hacen (they do/make)' },
		hecho: { lemma: 'hacer', note: 'past participle of hacer' },
		hizo: { lemma: 'hacer', note: 'él/ella hizo (did/made)' },

		// ir (to go)
		voy: { lemma: 'ir', note: 'yo voy (I go)' },
		vas: { lemma: 'ir', note: 'tú vas (you go)' },
		va: { lemma: 'ir', note: 'él/ella va (goes)' },
		vamos: { lemma: 'ir', note: 'nosotros vamos (we go)' },
		vais: { lemma: 'ir', note: 'vosotros vais (you all go)' },
		van: { lemma: 'ir', note: 'ellos/ellas van (they go)' },
		ido: { lemma: 'ir', note: 'past participle of ir' },

		// poder (can/be able to)
		puedo: { lemma: 'poder', note: 'yo puedo (I can)' },
		puedes: { lemma: 'poder', note: 'tú puedes (you can)' },
		puede: { lemma: 'poder', note: 'él/ella puede (can)' },
		podemos: { lemma: 'poder', note: 'nosotros podemos (we can)' },
		podéis: { lemma: 'poder', note: 'vosotros podéis (you all can)' },
		pueden: { lemma: 'poder', note: 'ellos/ellas pueden (they can)' },
		podido: { lemma: 'poder', note: 'past participle of poder' },

		// querer (to want)
		quiero: { lemma: 'querer', note: 'yo quiero (I want)' },
		quieres: { lemma: 'querer', note: 'tú quieres (you want)' },
		quiere: { lemma: 'querer', note: 'él/ella quiere (wants)' },
		queremos: { lemma: 'querer', note: 'nosotros queremos (we want)' },
		queréis: { lemma: 'querer', note: 'vosotros queréis (you all want)' },
		quieren: { lemma: 'querer', note: 'ellos/ellas quieren (they want)' },
		querido: { lemma: 'querer', note: 'past participle of querer' },

		// saber (to know)
		sé: { lemma: 'saber', note: 'yo sé (I know)' },
		sabes: { lemma: 'saber', note: 'tú sabes (you know)' },
		sabe: { lemma: 'saber', note: 'él/ella sabe (knows)' },
		sabemos: { lemma: 'saber', note: 'nosotros sabemos (we know)' },
		sabéis: { lemma: 'saber', note: 'vosotros sabéis (you all know)' },
		saben: { lemma: 'saber', note: 'ellos/ellas saben (they know)' },
		sabido: { lemma: 'saber', note: 'past participle of saber' },

		// decir (to say/tell)
		digo: { lemma: 'decir', note: 'yo digo (I say)' },
		dices: { lemma: 'decir', note: 'tú dices (you say)' },
		dice: { lemma: 'decir', note: 'él/ella dice (says)' },
		decimos: { lemma: 'decir', note: 'nosotros decimos (we say)' },
		decís: { lemma: 'decir', note: 'vosotros decís (you all say)' },
		dicen: { lemma: 'decir', note: 'ellos/ellas dicen (they say)' },
		dicho: { lemma: 'decir', note: 'past participle of decir' },
		dijo: { lemma: 'decir', note: 'él/ella dijo (said)' },

		// dar (to give)
		doy: { lemma: 'dar', note: 'yo doy (I give)' },
		das: { lemma: 'dar', note: 'tú das (you give)' },
		da: { lemma: 'dar', note: 'él/ella da (gives)' },
		damos: { lemma: 'dar', note: 'nosotros damos (we give)' },
		dais: { lemma: 'dar', note: 'vosotros dais (you all give)' },
		dan: { lemma: 'dar', note: 'ellos/ellas dan (they give)' },
		dado: { lemma: 'dar', note: 'past participle of dar' },

		// Contractions
		al: { lemma: 'a', note: 'al = a + el (to the)' },
		del: { lemma: 'de', note: 'del = de + el (of the / from the)' }
	},

	genderToArticle(gender: string): string | null {
		const g = gender.toUpperCase();
		if (g === 'MASCULINE' || g === 'EL') return 'el';
		if (g === 'FEMININE' || g === 'LA') return 'la';
		return null;
	},

	defaultDefiniteArticle: 'el/la/los/las',
	defaultIndefiniteArticle: 'un/una',
	pluralDefiniteArticle: 'los/las',
	definiteToIndefinite: { el: 'un', la: 'una' },

	hasGender: true,
	capitalizeNouns: false,
	onboardingGreeting:
		'¡Hola! (Hello!) Estoy emocionado de descubrir en qué nivel estás con tu español. ¿Cómo te llamas? (What is your name?)',
	stemSuffixes: [
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
	],
	stemWithSnowball: false,

	llmConstraintPrompt:
		'Actúe como un revisor de español experimentado. Escriba el texto en un español impecable (conforme a la RAE) y evite los anglicismos o la ortografía inglesa para términos relacionados. Tenga especial cuidado en no utilizar la ortografía inglesa para palabras españolas.'
};

export default spanish;
