/**
 * Builds src/lib/frequency/index.ts from the hermitdave/FrequencyWords corpus.
 *
 * Source: https://github.com/hermitdave/FrequencyWords (OpenSubtitles 2018, MIT)
 * Format: "<inflected_form> <raw_count>" per line, sorted by count desc.
 *
 * What this script does:
 *   1. Reads all *_50k.txt files present in prisma/data/frequency/.
 *      Download missing languages first with: pnpm fetch:frequency <code>
 *   2. Aggregates inflected forms into lemmas (German only; all other languages
 *      are kept as-is since raw forms are close to lemmas).
 *   3. Assigns rank 1..N (1 = most frequent) to the aggregated lemmas.
 *   4. Writes src/lib/frequency/index.ts with one export per language plus a
 *      unified FREQUENCY_MAPS record used by frequencyLoader.ts at runtime.
 *
 * Run with: pnpm build:frequency
 *
 * To add a new language:
 *   1. Register it in src/lib/languages/ (add a config + add to index.ts)
 *   2. Add its code → display-name mapping to CODE_TO_NAME below
 *   3. Run: pnpm fetch:frequency <code> && pnpm build:frequency
 *   4. Commit prisma/data/frequency/<code>_50k.txt and src/lib/frequency/index.ts
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Code → display name mapping.
// Add a new entry here whenever you register a new language in src/lib/languages/.
// ---------------------------------------------------------------------------
const CODE_TO_NAME: Record<string, string> = {
	de: 'German',
	es: 'Spanish',
	fr: 'French',
	it: 'Italian'
};
import { stemmer as deStemmer } from '@orama/stemmers/german';

// ---------------------------------------------------------------------------
// Strong-verb lookup (inflected form → infinitive lemma)
// Mirrors the table in src/lib/server/vocabProcessor.ts — keep in sync.
// ---------------------------------------------------------------------------
const DE_INFLECTION_LOOKUP: Record<string, string> = {
	hat: 'haben',
	haben: 'haben',
	habe: 'haben',
	hast: 'haben',
	habt: 'haben',
	ist: 'sein',
	sind: 'sein',
	bin: 'sein',
	bist: 'sein',
	seid: 'sein',
	sei: 'sein',
	war: 'sein',
	waren: 'sein',
	warst: 'sein',
	wart: 'sein',
	wird: 'werden',
	werde: 'werden',
	wirst: 'werden',
	werdet: 'werden',
	wurde: 'werden',
	wurden: 'werden',
	ward: 'werden',
	kann: 'können',
	konnte: 'können',
	konntest: 'können',
	könnten: 'können',
	kannst: 'können',
	könnt: 'können',
	muss: 'müssen',
	musste: 'müssen',
	müsste: 'müssen',
	musst: 'müssen',
	darf: 'dürfen',
	durfte: 'dürfen',
	darfst: 'dürfen',
	dürft: 'dürfen',
	soll: 'sollen',
	sollte: 'sollen',
	sollst: 'sollen',
	sollt: 'sollen',
	will: 'wollen',
	wollte: 'wollen',
	willst: 'wollen',
	wollt: 'wollen',
	mag: 'mögen',
	mochte: 'mögen',
	magst: 'mögen',
	mögt: 'mögen',
	geht: 'gehen',
	ging: 'gehen',
	gingen: 'gehen',
	gehst: 'gehen',
	gingt: 'gehen',
	kommt: 'kommen',
	kam: 'kommen',
	kamen: 'kommen',
	kommst: 'kommen',
	sieht: 'sehen',
	sah: 'sehen',
	sahen: 'sehen',
	siehst: 'sehen',
	seht: 'sehen',
	gibt: 'geben',
	gab: 'geben',
	gaben: 'geben',
	gibst: 'geben',
	gebt: 'geben',
	nimmt: 'nehmen',
	nahm: 'nehmen',
	nahmen: 'nehmen',
	nimmst: 'nehmen',
	nehmt: 'nehmen',
	spricht: 'sprechen',
	sprach: 'sprechen',
	sprachen: 'sprechen',
	sprichst: 'sprechen',
	sprecht: 'sprechen',
	fährt: 'fahren',
	fuhr: 'fahren',
	fuhren: 'fahren',
	fährst: 'fahren',
	fahrt: 'fahren',
	lässt: 'lassen',
	ließ: 'lassen',
	ließen: 'lassen',
	lasst: 'lassen',
	hält: 'halten',
	hielt: 'halten',
	hielten: 'halten',
	hältst: 'halten',
	haltet: 'halten',
	fällt: 'fallen',
	fiel: 'fallen',
	fielen: 'fallen',
	fällst: 'fallen',
	fallt: 'fallen',
	weiß: 'wissen',
	wusste: 'wissen',
	wussten: 'wissen',
	weißt: 'wissen',
	wisst: 'wissen',
	heißt: 'heißen',
	hieß: 'heißen',
	hießen: 'heißen',
	steht: 'stehen',
	stand: 'stehen',
	standen: 'stehen',
	stehst: 'stehen',
	findet: 'finden',
	fand: 'finden',
	fanden: 'finden',
	findest: 'finden',
	bleibt: 'bleiben',
	blieb: 'bleiben',
	blieben: 'bleiben',
	bleibst: 'bleiben',
	bringt: 'bringen',
	brachte: 'bringen',
	brachten: 'bringen',
	bringst: 'bringen',
	denkt: 'denken',
	dachte: 'denken',
	dachten: 'denken',
	denkst: 'denken',
	liegt: 'liegen',
	lag: 'liegen',
	lagen: 'liegen',
	liegst: 'liegen',
	tut: 'tun',
	tat: 'tun',
	taten: 'tun',
	tust: 'tun',
	läuft: 'laufen',
	lief: 'laufen',
	liefen: 'laufen',
	läufst: 'laufen',
	lauft: 'laufen',
	trägt: 'tragen',
	trug: 'tragen',
	trugen: 'tragen',
	trägst: 'tragen',
	tragt: 'tragen',
	schläft: 'schlafen',
	schlief: 'schlafen',
	schliefen: 'schlafen',
	schläfst: 'schlafen',
	schlaft: 'schlafen',
	hilft: 'helfen',
	half: 'helfen',
	halfen: 'helfen',
	hilfst: 'helfen',
	helft: 'helfen',
	wirft: 'werfen',
	warf: 'werfen',
	warfen: 'werfen',
	wirfst: 'werfen',
	werft: 'werfen',
	trifft: 'treffen',
	traf: 'treffen',
	trafen: 'treffen',
	triffst: 'treffen',
	trefft: 'treffen',
	liest: 'lesen',
	las: 'lesen',
	lasen: 'lesen',
	lest: 'lesen',
	isst: 'essen',
	aß: 'essen',
	aßen: 'essen',
	ass: 'essen',
	esst: 'essen',
	trinkt: 'trinken',
	trank: 'trinken',
	tranken: 'trinken',
	trinkst: 'trinken',
	schreibt: 'schreiben',
	schrieb: 'schreiben',
	schrieben: 'schreiben',
	schreibst: 'schreiben',
	fliegt: 'fliegen',
	flog: 'fliegen',
	flogen: 'fliegen',
	fliegst: 'fliegen',
	zieht: 'ziehen',
	zog: 'ziehen',
	zogen: 'ziehen',
	ziehst: 'ziehen',
	steigt: 'steigen',
	stieg: 'steigen',
	stiegen: 'steigen',
	steigst: 'steigen',
	greift: 'greifen',
	griff: 'greifen',
	griffen: 'greifen',
	greifst: 'greifen',
	stirbt: 'sterben',
	starb: 'sterben',
	starben: 'sterben',
	stirbst: 'sterben',
	bricht: 'brechen',
	brach: 'brechen',
	brachen: 'brechen',
	brichst: 'brechen',
	vergisst: 'vergessen',
	vergaß: 'vergessen',
	vergaßen: 'vergessen',
	vergass: 'vergessen'
};

const DATA_DIR = 'prisma/data/frequency';

function resolveGermanLemma(form: string): string {
	const lower = form.toLowerCase();
	if (DE_INFLECTION_LOOKUP[lower]) return DE_INFLECTION_LOOKUP[lower];
	return deStemmer(lower);
}

function buildRankMap(rawText: string, resolver: (form: string) => string): Map<string, number> {
	const lines = rawText.trim().split('\n');
	const countMap = new Map<string, number>();
	for (const line of lines) {
		const [form, countStr] = line.split(' ');
		if (!form || !countStr) continue;
		const lemma = resolver(form);
		const count = parseInt(countStr);
		countMap.set(lemma, (countMap.get(lemma) ?? 0) + count);
	}
	const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
	const rankMap = new Map<string, number>();
	sorted.forEach(([lemma], i) => rankMap.set(lemma, i + 1));
	return rankMap;
}

function mapToTsObject(map: Map<string, number>): string {
	return [...map.entries()].map(([k, v]) => `  ${JSON.stringify(k)}:${v}`).join(',\n');
}

/** Returns the resolver function for a given language code. */
function resolverFor(code: string): (form: string) => string {
	if (code === 'de') return resolveGermanLemma;
	return (f) => f.toLowerCase();
}

/** Upper-cases the first letter of a code-derived name (fallback for unknown codes). */
function codeToExportName(code: string): string {
	return code.toUpperCase();
}

async function main() {
	// Auto-discover all *_50k.txt files in the data directory.
	const txtFiles = readdirSync(DATA_DIR)
		.filter((f) => f.endsWith('_50k.txt'))
		.sort();

	if (txtFiles.length === 0) {
		console.error(`No *_50k.txt files found in ${DATA_DIR}.`);
		console.error('Run: pnpm fetch:frequency <code>  (e.g. pnpm fetch:frequency it)');
		process.exit(1);
	}

	console.log(`Found ${txtFiles.length} frequency file(s): ${txtFiles.join(', ')}`);

	const languages: Array<{
		code: string;
		name: string;
		exportName: string;
		map: Map<string, number>;
	}> = [];

	for (const file of txtFiles) {
		const code = file.replace('_50k.txt', '');
		const name = CODE_TO_NAME[code] ?? code;
		const exportName = CODE_TO_NAME[code]
			? code.toUpperCase() + '_FREQUENCY'
			: codeToExportName(code) + '_FREQUENCY';

		console.log(`Building rank map for ${name} (${code})...`);
		const raw = readFileSync(join(DATA_DIR, file), 'utf8');
		const map = buildRankMap(raw, resolverFor(code));
		console.log(`  ${name}: ${map.size} lemmas`);

		languages.push({ code, name, exportName, map });
	}

	mkdirSync('src/lib/frequency', { recursive: true });

	const individualExports = languages
		.map(
			({ exportName, map }) =>
				`export const ${exportName}: Record<string, number> = {\n${mapToTsObject(map)}\n};`
		)
		.join('\n\n');

	const mapsEntries = languages
		.map(({ name, exportName }) => `  ${JSON.stringify(name)}: ${exportName}`)
		.join(',\n');

	const ts = `// Auto-generated — do not edit manually.
// Rebuild with: pnpm build:frequency
// Add a new language: pnpm fetch:frequency <code> && pnpm build:frequency
// Source: hermitdave/FrequencyWords (OpenSubtitles 2018, MIT licence)
// German forms are aggregated to lemmas via strong-verb lookup + Snowball stemmer.
// Format: lowercased lemma → frequency rank (1 = most frequent in corpus).

${individualExports}

/** All bundled frequency maps keyed by language display name. */
export const FREQUENCY_MAPS: Record<string, Record<string, number>> = {
${mapsEntries}
};

/**
 * Returns the corpus frequency rank of a lemma (1 = most common).
 * Returns null if the lemma is not in the frequency database.
 */
export function getFrequencyRank(lemma: string, language: string): number | null {
  const map = FREQUENCY_MAPS[language];
  if (!map) return null;
  return map[lemma.toLowerCase()] ?? null;
}

/**
 * Heuristic rank estimate for words not in the corpus database.
 * Returns a rank in the range [30001, 99999] — past the end of known entries.
 * Longer words (compounds) are assumed rarer.
 */
export function estimateFrequencyRank(lemma: string): number {
  return 30000 + Math.min(lemma.length * 1200, 60000);
}
`;

	writeFileSync('src/lib/frequency/index.ts', ts);
	console.log(`\nWritten src/lib/frequency/index.ts (${(ts.length / 1024).toFixed(0)} KB)`);
	console.log('Commit this file along with any new prisma/data/frequency/*.txt files.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
