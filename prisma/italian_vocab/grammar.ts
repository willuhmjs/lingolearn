// ~25 Italian grammar rules (A1–B2)
export const italianGrammarRules = [
	{
		title: 'Subject Pronouns',
		description:
			'Italian subject pronouns (io, tu, lui/lei, noi, voi, loro). They are often omitted since verb endings convey the subject.',
		guide: `# Subject Pronouns

Italian subject pronouns are used to indicate who is performing the action. However, they are often omitted because verb endings usually make the subject clear (pro-drop language).

| Person | Pronoun |
|--------|---------|
| I      | io      |
| you (sing.) | tu |
| he     | lui     |
| she    | lei     |
| we     | noi     |
| you (pl.) | voi  |
| they   | loro    |

**Examples:**
- Io parlo italiano. → Parlo italiano. (I speak Italian.)
- Noi andiamo a scuola. (We go to school.)
- Loro leggono libri. (They read books.)

> **Tip:** Omit the pronoun unless you want to emphasize it.
`,
		ruleType: 'pronoun',
		targetForms: ['io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro'],
		level: 'A1',
		dependencies: []
	},
	{
		title: 'Present Tense (-are verbs)',
		description: 'Regular -are verbs in the present tense (parlare, amare, lavorare).',
		guide: `# Present Tense: -are Verbs

Regular verbs ending in -are follow this pattern in the present tense.

| Person | Ending | Example: parlare (to speak) |
|--------|--------|----------------------------|
| io     | -o     | parlo                      |
| tu     | -i     | parli                      |
| lui/lei| -a     | parla                      |
| noi    | -iamo  | parliamo                   |
| voi    | -ate   | parlate                    |
| loro   | -ano   | parlano                    |

**Examples:**
- Io lavoro a Roma. (I work in Rome.)
- Tu ami la musica. (You love music.)
- Noi parliamo italiano. (We speak Italian.)

> **Tip:** The endings are the same for all regular -are verbs.
`,
		ruleType: 'verb',
		targetForms: ['parlo', 'parli', 'parla', 'parliamo', 'parlate', 'parlano'],
		level: 'A1',
		dependencies: ['Subject Pronouns']
	},
	{
		title: 'Present Tense (-ere verbs)',
		description: 'Regular -ere verbs in the present tense (vedere, leggere, scrivere).',
		guide: `# Present Tense: -ere Verbs

Regular verbs ending in -ere follow this pattern in the present tense.

| Person | Ending | Example: vedere (to see) |
|--------|--------|-------------------------|
| io     | -o     | vedo                    |
| tu     | -i     | vedi                    |
| lui/lei| -e     | vede                    |
| noi    | -iamo  | vediamo                 |
| voi    | -ete   | vedete                  |
| loro   | -ono   | vedono                  |

**Examples:**
- Io leggo un libro. (I read a book.)
- Tu scrivi una lettera. (You write a letter.)
- Noi vediamo il film. (We see the movie.)

> **Tip:** The endings are the same for all regular -ere verbs.
`,
		ruleType: 'verb',
		targetForms: ['vedo', 'vedi', 'vede', 'vediamo', 'vedete', 'vedono'],
		level: 'A1',
		dependencies: ['Subject Pronouns']
	},
	{
		title: 'Present Tense (-ire verbs)',
		description:
			'Regular -ire verbs in the present tense (dormire, sentire) and -isc- group (finire, capire).',
		guide: `# Present Tense: -ire Verbs

There are two types of -ire verbs: regular and those that insert -isc- in some forms.

| Person | Ending | Example: dormire (to sleep) | Example: finire (to finish) |
|--------|--------|----------------------------|-----------------------------|
| io     | -o     | dormo                      | finisco                     |
| tu     | -i     | dormi                      | finisci                     |
| lui/lei| -e     | dorme                      | finisce                     |
| noi    | -iamo  | dormiamo                   | finiamo                     |
| voi    | -ite   | dormite                    | finite                      |
| loro   | -ono/-iscono | dormono              | finiscono                   |

**Examples:**
- Io dormo bene. (I sleep well.)
- Tu finisci il lavoro. (You finish the work.)
- Loro capiscono tutto. (They understand everything.)

> **Tip:** Common -isc- verbs: finire, capire, preferire, pulire, spedire.
`,
		ruleType: 'verb',
		targetForms: [
			'dormo',
			'dormi',
			'dorme',
			'dormiamo',
			'dormite',
			'dormono',
			'finisco',
			'finisci',
			'finisce',
			'finiamo',
			'finite',
			'finiscono'
		],
		level: 'A1',
		dependencies: ['Subject Pronouns']
	}
	// ... (more rules to be added for full coverage) ...
];
