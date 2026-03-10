export const frenchGrammarRules = [
	// A1 (difficulty: 1) - 12 rules
	{
		id: 'french_gender',
		name: 'Gender of Nouns',
		description:
			'French nouns are either masculine or feminine. The gender of a noun affects the articles, adjectives, and pronouns used with it. While some patterns exist, gender often must be memorized for each noun.',
		difficulty: 1,
		isEnabled: true,
		dependencies: []
	},
	{
		id: 'french_plural',
		name: 'Plural of Nouns',
		description:
			'Most French nouns form the plural by adding -s, but nouns ending in -au, -eau, or -eu add -x instead. Nouns already ending in -s, -x, or -z remain unchanged in the plural.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Gender of Nouns']
	},
	{
		id: 'french_articles',
		name: 'Definite and Indefinite Articles',
		description:
			'French uses definite articles (le, la, les) and indefinite articles (un, une, des) before nouns. Articles must agree with the noun in gender and number, and contractions occur with certain prepositions.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Gender of Nouns', 'Plural of Nouns']
	},
	{
		id: 'french_subject_pronouns',
		name: 'Subject Pronouns',
		description:
			'French subject pronouns (je, tu, il/elle/on, nous, vous, ils/elles) replace noun subjects. The formal "vous" is used for politeness, while "tu" is informal and singular.',
		difficulty: 1,
		isEnabled: true,
		dependencies: []
	},
	{
		id: 'french_present_er',
		name: 'Present Tense (-er verbs)',
		description:
			'Regular -er verbs are the largest group in French. To conjugate, remove -er and add the endings: -e, -es, -e, -ons, -ez, -ent. Common examples include parler, manger, and habiter.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Subject Pronouns']
	},
	{
		id: 'french_present_ir',
		name: 'Present Tense (-ir verbs)',
		description:
			'Regular -ir verbs (like finir, choisir, remplir) follow a specific conjugation pattern. Remove -ir and add -is, -is, -it, -issons, -issez, -issent to form the present tense.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Subject Pronouns']
	},
	{
		id: 'french_present_re',
		name: 'Present Tense (-re verbs)',
		description:
			'Regular -re verbs (like attendre, vendre, perdre) are conjugated by removing -re and adding -s, -s, nothing, -ons, -ez, -ent. The third person singular has no added ending.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Subject Pronouns']
	},
	{
		id: 'french_negation',
		name: 'Negation (ne...pas)',
		description:
			'To make a sentence negative in French, place "ne" before the conjugated verb and "pas" after it. In spoken French, "ne" is often dropped, but it is required in written French.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Present Tense (-er verbs)']
	},
	{
		id: 'french_adjective_agreement',
		name: 'Adjective Agreement',
		description:
			'French adjectives must agree in gender and number with the noun they modify. Most adjectives add -e for feminine and -s for plural. Most adjectives follow the noun, but some common ones precede it.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Gender of Nouns', 'Plural of Nouns']
	},
	{
		id: 'french_possessive_adjectives',
		name: 'Possessive Adjectives',
		description:
			'Possessive adjectives (mon/ma/mes, ton/ta/tes, son/sa/ses, notre/nos, votre/vos, leur/leurs) agree with the possessed noun, not the possessor. Before feminine nouns starting with a vowel, mon/ton/son are used instead of ma/ta/sa.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Gender of Nouns', 'Plural of Nouns']
	},
	{
		id: 'french_yes_no_questions',
		name: 'Yes/No Questions',
		description:
			'French offers three ways to ask yes/no questions: rising intonation, adding "est-ce que" before a statement, or inverting the subject and verb. Inversion is more formal and requires a hyphen between verb and pronoun.',
		difficulty: 1,
		isEnabled: true,
		dependencies: ['Subject Pronouns', 'Present Tense (-er verbs)']
	},
	{
		id: 'french_numbers_time',
		name: 'Numbers and Time',
		description:
			'French numbers have unique forms up to 16, then follow patterns. Telling time uses "il est" followed by the hour, with "et quart," "et demie," and "moins" for quarter, half, and subtraction.',
		difficulty: 1,
		isEnabled: true,
		dependencies: []
	},

	// A2 (difficulty: 2) - 8 rules
	{
		id: 'french_passe_compose_avoir',
		name: 'Passe Compose with avoir',
		description:
			'The passe compose is formed with the present tense of avoir plus the past participle. Most verbs use avoir as the auxiliary. Past participles of regular verbs end in -e (er), -i (ir), or -u (re).',
		difficulty: 2,
		isEnabled: true,
		dependencies: ['Present Tense (-er verbs)', 'Present Tense (-ir verbs)', 'Present Tense (-re verbs)']
	},
	{
		id: 'french_passe_compose_etre',
		name: 'Passe Compose with etre',
		description:
			'Certain verbs of motion and state change use etre as their auxiliary in the passe compose. The past participle must agree in gender and number with the subject. The classic mnemonic "DR MRS VANDERTRAMP" helps remember these verbs.',
		difficulty: 2,
		isEnabled: true,
		dependencies: ['Passe Compose with avoir']
	},
	{
		id: 'french_imparfait',
		name: 'Imparfait',
		description:
			'The imparfait (imperfect tense) describes ongoing or habitual past actions. It is formed from the nous form of the present tense, replacing -ons with -ais, -ais, -ait, -ions, -iez, -aient. Only etre has an irregular stem (et-).',
		difficulty: 2,
		isEnabled: true,
		dependencies: ['Present Tense (-er verbs)', 'Present Tense (-ir verbs)', 'Present Tense (-re verbs)']
	},
	{
		id: 'french_reflexive_verbs',
		name: 'Reflexive Verbs',
		description:
			'Reflexive verbs use a reflexive pronoun (me, te, se, nous, vous, se) that refers back to the subject. They are common in French for daily routines (se lever, se laver). In the passe compose, reflexive verbs always use etre as the auxiliary.',
		difficulty: 2,
		isEnabled: true,
		dependencies: ['Subject Pronouns', 'Present Tense (-er verbs)']
	},
	{
		id: 'french_direct_object_pronouns',
		name: 'Direct Object Pronouns',
		description:
			'Direct object pronouns (me, te, le/la, nous, vous, les) replace direct object nouns and are placed before the conjugated verb. In the passe compose, the past participle agrees with a preceding direct object pronoun.',
		difficulty: 2,
		isEnabled: true,
		dependencies: ['Subject Pronouns', 'Present Tense (-er verbs)']
	},
	{
		id: 'french_indirect_object_pronouns',
		name: 'Indirect Object Pronouns',
		description:
			'Indirect object pronouns (me, te, lui, nous, vous, leur) replace indirect objects introduced by "a." They are placed before the conjugated verb. Unlike direct object pronouns, there is no past participle agreement.',
		difficulty: 2,
		isEnabled: true,
		dependencies: ['Direct Object Pronouns']
	},
	{
		id: 'french_comparative_superlative',
		name: 'Comparative and Superlative',
		description:
			'Comparatives use "plus/moins/aussi + adjective + que" to compare two things. Superlatives use "le/la/les plus/moins + adjective" for the highest degree. "Bon" and "mauvais" have irregular comparative forms (meilleur, pire).',
		difficulty: 2,
		isEnabled: true,
		dependencies: ['Adjective Agreement', 'Definite and Indefinite Articles']
	},
	{
		id: 'french_prepositions_place',
		name: 'Prepositions of Place',
		description:
			'French uses specific prepositions with geographic locations: "en" for feminine countries, "au" for masculine ones, and "aux" for plural. Common spatial prepositions include dans, sur, sous, devant, derriere, entre, and a cote de.',
		difficulty: 2,
		isEnabled: true,
		dependencies: ['Definite and Indefinite Articles']
	},

	// B1 (difficulty: 3) - 8 rules
	{
		id: 'french_passe_compose_vs_imparfait',
		name: 'Passe Compose vs Imparfait',
		description:
			'The passe compose describes completed actions in the past, while the imparfait describes ongoing states, habitual actions, or background descriptions. Choosing between them depends on whether the action is viewed as a finished event or an ongoing situation.',
		difficulty: 3,
		isEnabled: true,
		dependencies: ['Passe Compose with avoir', 'Passe Compose with etre', 'Imparfait']
	},
	{
		id: 'french_futur_simple',
		name: 'Future Tense (Futur Simple)',
		description:
			'The futur simple is formed by adding -ai, -as, -a, -ons, -ez, -ont to the infinitive (or an irregular stem). It expresses actions that will happen in the future and is also used after "quand" in future contexts.',
		difficulty: 3,
		isEnabled: true,
		dependencies: ['Present Tense (-er verbs)', 'Present Tense (-ir verbs)', 'Present Tense (-re verbs)']
	},
	{
		id: 'french_conditional',
		name: 'Conditional Mood',
		description:
			'The conditional is formed with the future stem plus imparfait endings (-ais, -ais, -ait, -ions, -iez, -aient). It expresses polite requests, hypothetical situations, and wishes. It is commonly used with "je voudrais" and "je pourrais."',
		difficulty: 3,
		isEnabled: true,
		dependencies: ['Future Tense (Futur Simple)', 'Imparfait']
	},
	{
		id: 'french_subjunctive_present',
		name: 'Subjunctive (Present)',
		description:
			'The present subjunctive is used after expressions of emotion, doubt, necessity, and desire, typically introduced by "que." It is formed from the ils/elles present stem with endings -e, -es, -e, -ions, -iez, -ent. Common triggers include "il faut que" and "je veux que."',
		difficulty: 3,
		isEnabled: true,
		dependencies: ['Present Tense (-er verbs)', 'Present Tense (-ir verbs)', 'Present Tense (-re verbs)']
	},
	{
		id: 'french_relative_pronouns',
		name: 'Relative Pronouns (qui, que, dont, ou)',
		description:
			'Relative pronouns connect clauses: "qui" replaces the subject, "que" replaces the direct object, "dont" replaces "de + noun," and "ou" refers to places or times. They allow combining two sentences into one complex sentence.',
		difficulty: 3,
		isEnabled: true,
		dependencies: ['Subject Pronouns', 'Direct Object Pronouns']
	},
	{
		id: 'french_plus_que_parfait',
		name: 'Plus-que-parfait',
		description:
			'The plus-que-parfait (pluperfect) describes actions completed before another past action. It is formed with the imparfait of avoir or etre plus the past participle. It is the French equivalent of "had done" in English.',
		difficulty: 3,
		isEnabled: true,
		dependencies: ['Passe Compose with avoir', 'Passe Compose with etre', 'Imparfait']
	},
	{
		id: 'french_adverb_formation',
		name: 'Adverb Formation (-ment)',
		description:
			'Most French adverbs are formed by adding -ment to the feminine form of the adjective. Adjectives ending in a vowel add -ment directly to the masculine form. Some adverbs are irregular, such as bien, mal, and vite.',
		difficulty: 3,
		isEnabled: true,
		dependencies: ['Adjective Agreement']
	},
	{
		id: 'french_imperative',
		name: 'Imperative Mood',
		description:
			'The imperative is used for commands and requests, existing only in tu, nous, and vous forms. For -er verbs, the tu form drops the final -s. Object pronouns follow the verb in affirmative commands but precede it in negative commands.',
		difficulty: 3,
		isEnabled: true,
		dependencies: ['Present Tense (-er verbs)', 'Present Tense (-ir verbs)', 'Present Tense (-re verbs)', 'Negation (ne...pas)']
	},

	// B2 (difficulty: 4) - 5 rules
	{
		id: 'french_subjunctive_advanced',
		name: 'Subjunctive Uses (Advanced)',
		description:
			'Advanced subjunctive usage includes its use after superlatives, certain conjunctions (bien que, pour que, avant que), and in relative clauses expressing doubt or uncertainty. Recognizing when the subjunctive is and is not required is essential for fluency.',
		difficulty: 4,
		isEnabled: true,
		dependencies: ['Subjunctive (Present)', 'Relative Pronouns (qui, que, dont, ou)']
	},
	{
		id: 'french_passive_voice',
		name: 'Passive Voice',
		description:
			'The passive voice is formed with etre plus the past participle, which agrees with the subject. The agent is introduced by "par" or sometimes "de." French often avoids the passive by using "on" or reflexive constructions instead.',
		difficulty: 4,
		isEnabled: true,
		dependencies: ['Passe Compose with etre', 'Adjective Agreement']
	},
	{
		id: 'french_past_conditional',
		name: 'Past Conditional',
		description:
			'The past conditional (conditionnel passe) is formed with the conditional of avoir or etre plus the past participle. It expresses what would have happened and is commonly used in the result clause of past hypothetical si clauses.',
		difficulty: 4,
		isEnabled: true,
		dependencies: ['Conditional Mood', 'Passe Compose with avoir', 'Passe Compose with etre']
	},
	{
		id: 'french_si_clauses',
		name: 'Si Clauses (Conditionals)',
		description:
			'French conditional sentences follow strict tense sequences: si + present / future, si + imparfait / conditional, si + plus-que-parfait / past conditional. The si clause never takes the future or conditional tense.',
		difficulty: 4,
		isEnabled: true,
		dependencies: ['Conditional Mood', 'Imparfait', 'Plus-que-parfait', 'Past Conditional']
	},
	{
		id: 'french_future_perfect',
		name: 'Future Perfect',
		description:
			'The future perfect (futur anterieur) is formed with the future tense of avoir or etre plus the past participle. It describes actions that will have been completed before a future point in time, often used after "quand" and "lorsque."',
		difficulty: 4,
		isEnabled: true,
		dependencies: ['Future Tense (Futur Simple)', 'Passe Compose with avoir', 'Passe Compose with etre']
	},

	// C1 (difficulty: 5) - 3 rules
	{
		id: 'french_passe_simple',
		name: 'Literary Past Tenses (Passe Simple)',
		description:
			'The passe simple is a literary past tense used in formal writing, novels, and historical texts. It replaces the passe compose in written narratives. Each verb group has distinct endings, and many irregular verbs have unique stems.',
		difficulty: 5,
		isEnabled: true,
		dependencies: ['Passe Compose with avoir', 'Passe Compose with etre', 'Passe Compose vs Imparfait']
	},
	{
		id: 'french_subjunctive_imperfect',
		name: 'Subjunctive Imperfect',
		description:
			'The imperfect subjunctive (subjonctif imparfait) is a literary tense formed from the passe simple stem. It replaces the present subjunctive in formal writing when the main clause is in a past tense, following the rule of tense concordance.',
		difficulty: 5,
		isEnabled: true,
		dependencies: ['Subjunctive (Present)', 'Literary Past Tenses (Passe Simple)', 'Imparfait']
	},
	{
		id: 'french_advanced_pronoun_placement',
		name: 'Advanced Pronoun Placement',
		description:
			'When multiple object pronouns appear together, they follow a strict order: me/te/se/nous/vous, then le/la/les, then lui/leur, then y, then en. In affirmative imperatives, the order changes and pronouns follow the verb connected by hyphens.',
		difficulty: 5,
		isEnabled: true,
		dependencies: ['Direct Object Pronouns', 'Indirect Object Pronouns', 'Reflexive Verbs', 'Imperative Mood']
	}
];
