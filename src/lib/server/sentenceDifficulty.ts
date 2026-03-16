/**
 * Sentence Difficulty Estimator
 *
 * A lightweight heuristic CEFR-level checker applied to LLM-generated sentences
 * before they are streamed to the client. Detects when the generated sentence
 * is syntactically more complex than the user's current level, so the client
 * can surface a note ("This sentence uses some advanced structures").
 *
 * This is NOT a full parser. It uses surface-level features that are reliable
 * enough to catch the most common failure mode: the LLM generating B2/C1 syntax
 * for an A1/A2 vocabulary lesson.
 *
 * Features measured:
 *   - Token count (word count): long sentences → harder
 *   - Subordinating conjunctions (dass, weil, obwohl, wenn, als, ob, damit,
 *     sodass, nachdem, bevor, während, seitdem, falls, sofern, since, although,
 *     because, if, que, porque, aunque, quand, puisque, …): each adds complexity
 *   - Relative clause markers (der, die, das, quien, que, qui, dont, où used
 *     mid-sentence as relative pronouns): heuristically detected
 *   - Participial/infinitive clause markers (zu + infinitive clusters, étant, ayant)
 *   - Punctuation complexity: semicolons, em-dashes, parentheses → harder
 *
 * Scoring → estimated CEFR band:
 *   score 0–1  → A1
 *   score 2–3  → A2
 *   score 4–5  → B1
 *   score 6–8  → B2
 *   score 9+   → C1/C2
 *
 * Returns { estimatedLevel, tooComplex, details } where tooComplex = true when
 * the estimated level is more than one band above the user's current level.
 */

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type CefrLevel = (typeof CEFR_ORDER)[number];

// Subordinating conjunctions across German, Spanish, French
const SUBORDINATORS = new Set([
	// German
	'dass',
	'weil',
	'obwohl',
	'obgleich',
	'obschon',
	'wenn',
	'als',
	'ob',
	'damit',
	'sodass',
	'so dass',
	'nachdem',
	'bevor',
	'während',
	'seitdem',
	'falls',
	'sofern',
	'solange',
	'sobald',
	'bis',
	'ehe',
	'indem',
	'inwiefern',
	'wozu',
	'weshalb',
	// Spanish
	'que',
	'porque',
	'aunque',
	'cuando',
	'si',
	'mientras',
	'antes',
	'después',
	'para que',
	'sin que',
	'a menos que',
	'con tal de que',
	'puesto que',
	'dado que',
	'ya que',
	'como',
	'según',
	// French
	'quand',
	'puisque',
	'parce que',
	'bien que',
	'quoique',
	'lorsque',
	'dès que',
	'depuis que',
	'pendant que',
	'afin que',
	'pour que',
	'à moins que',
	'si',
	// English (for target-to-native mode input checking)
	'although',
	'because',
	'since',
	'whereas',
	'whether',
	'unless',
	'until',
	'whenever',
	'wherever',
	'however',
	'despite',
	'notwithstanding'
]);

// Relative pronoun patterns that signal a relative clause (preceded by a comma or noun)
const RELATIVE_PRONOUNS_DE = /,\s*(der|die|das|dem|den|dessen|deren|welcher|welche|welches)\s/gi;
const RELATIVE_PRONOUNS_ES = /,\s*(que|quien|quienes|cuyo|cuya|cuyos|cuyas|donde|cuando)\s/gi;
const RELATIVE_PRONOUNS_FR = /,\s*(qui|que|dont|où|lequel|laquelle|lesquels|lesquelles)\s/gi;

// Participial / infinitive markers
const ZU_INFINITIVE = /\bzu\s+\w+en\b/gi; // German: "zu gehen", "zu lernen"
const ETANT_AYANT = /\b(étant|ayant|siendo|habiendo)\b/gi;

// Punctuation that raises complexity
const COMPLEX_PUNCT = /[;—–()[\]]/g;

export interface DifficultyResult {
	estimatedLevel: string;
	tooComplex: boolean;
	complexityScore: number;
}

export function estimateSentenceDifficulty(sentence: string, userLevel: string): DifficultyResult {
	if (!sentence || sentence.trim().length === 0) {
		return { estimatedLevel: userLevel, tooComplex: false, complexityScore: 0 };
	}

	const lower = sentence.toLowerCase();
	const tokens = sentence.split(/\s+/).filter(Boolean);
	let score = 0;

	// 1. Token count contribution
	if (tokens.length > 20) score += 3;
	else if (tokens.length > 14) score += 2;
	else if (tokens.length > 9) score += 1;

	// 2. Subordinating conjunctions — each one adds 1 point (heavy signal)
	for (const sub of SUBORDINATORS) {
		// Word-boundary check: the conjunction must appear as a whole word
		const re = new RegExp(`\\b${sub}\\b`, 'gi');
		const matches = lower.match(re);
		if (matches) score += matches.length;
	}

	// 3. Relative clause markers (comma + relative pronoun)
	const relDe = sentence.match(RELATIVE_PRONOUNS_DE) ?? [];
	const relEs = sentence.match(RELATIVE_PRONOUNS_ES) ?? [];
	const relFr = sentence.match(RELATIVE_PRONOUNS_FR) ?? [];
	score += relDe.length + relEs.length + relFr.length;

	// 4. Participial / zu-infinitive clusters
	const zuMatches = sentence.match(ZU_INFINITIVE) ?? [];
	const etantMatches = sentence.match(ETANT_AYANT) ?? [];
	score += zuMatches.length + etantMatches.length;

	// 5. Complex punctuation (each occurrence +1, max 2 to avoid double-counting)
	const punctMatches = sentence.match(COMPLEX_PUNCT) ?? [];
	score += Math.min(2, punctMatches.length);

	// Map score → estimated CEFR band
	let estimatedLevel: CefrLevel;
	if (score <= 1) estimatedLevel = 'A1';
	else if (score <= 3) estimatedLevel = 'A2';
	else if (score <= 5) estimatedLevel = 'B1';
	else if (score <= 8) estimatedLevel = 'B2';
	else estimatedLevel = 'C1';

	const userIdx = CEFR_ORDER.indexOf(userLevel as CefrLevel);
	const estIdx = CEFR_ORDER.indexOf(estimatedLevel);
	// Flag if the sentence is more than 1 band above the user's level
	const tooComplex = estIdx > (userIdx >= 0 ? userIdx : 0) + 1;

	return { estimatedLevel, tooComplex, complexityScore: score };
}
