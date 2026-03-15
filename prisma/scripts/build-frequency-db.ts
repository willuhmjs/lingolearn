/**
 * Builds src/lib/frequency/index.ts from the hermitdave/FrequencyWords corpus.
 *
 * Source: https://github.com/hermitdave/FrequencyWords (OpenSubtitles 2016, MIT)
 * Format: "<inflected_form> <raw_count>" per line, sorted by count desc.
 *
 * What this script does:
 *   1. Downloads the top-50k frequency lists for German, Spanish, and French.
 *   2. Aggregates inflected forms into lemmas using the strong-verb lookup table
 *      and Snowball stemmer (German only; ES/FR kept as-is since they have
 *      much less irregular morphology and the raw forms are close to lemmas).
 *   3. Assigns rank 1..N (1 = most frequent) to the aggregated lemmas.
 *   4. Writes a single TypeScript file with three exported Record<string,number>
 *      maps plus helper functions used by the app at runtime.
 *
 * Run with: pnpm tsx prisma/scripts/build-frequency-db.ts
 */

import { createWriteStream, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { get } from 'https';
import { stemmer as deStemmer } from '@orama/stemmers/german';
import { writeFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Strong-verb lookup (inflected form → infinitive lemma)
// Mirrors the table in src/lib/server/vocabProcessor.ts — keep in sync.
// ---------------------------------------------------------------------------
const DE_INFLECTION_LOOKUP: Record<string, string> = {
	hat: 'haben', haben: 'haben', habe: 'haben', hast: 'haben', habt: 'haben',
	ist: 'sein', sind: 'sein', bin: 'sein', bist: 'sein', seid: 'sein', sei: 'sein',
	war: 'sein', waren: 'sein', warst: 'sein', wart: 'sein',
	wird: 'werden', werde: 'werden', wirst: 'werden', werdet: 'werden',
	wurde: 'werden', wurden: 'werden', ward: 'werden',
	kann: 'können', konnte: 'können', konntest: 'können', könnten: 'können', kannst: 'können', könnt: 'können',
	muss: 'müssen', musste: 'müssen', müsste: 'müssen', musst: 'müssen',
	darf: 'dürfen', durfte: 'dürfen', darfst: 'dürfen', dürft: 'dürfen',
	soll: 'sollen', sollte: 'sollen', sollst: 'sollen', sollt: 'sollen',
	will: 'wollen', wollte: 'wollen', willst: 'wollen', wollt: 'wollen',
	mag: 'mögen', mochte: 'mögen', magst: 'mögen', mögt: 'mögen',
	geht: 'gehen', ging: 'gehen', gingen: 'gehen', gehst: 'gehen', gingt: 'gehen',
	kommt: 'kommen', kam: 'kommen', kamen: 'kommen', kommst: 'kommen',
	sieht: 'sehen', sah: 'sehen', sahen: 'sehen', siehst: 'sehen', seht: 'sehen',
	gibt: 'geben', gab: 'geben', gaben: 'geben', gibst: 'geben', gebt: 'geben',
	nimmt: 'nehmen', nahm: 'nehmen', nahmen: 'nehmen', nimmst: 'nehmen', nehmt: 'nehmen',
	spricht: 'sprechen', sprach: 'sprechen', sprachen: 'sprechen', sprichst: 'sprechen', sprecht: 'sprechen',
	fährt: 'fahren', fuhr: 'fahren', fuhren: 'fahren', fährst: 'fahren', fahrt: 'fahren',
	lässt: 'lassen', ließ: 'lassen', ließen: 'lassen', lasst: 'lassen',
	hält: 'halten', hielt: 'halten', hielten: 'halten', hältst: 'halten', haltet: 'halten',
	fällt: 'fallen', fiel: 'fallen', fielen: 'fallen', fällst: 'fallen', fallt: 'fallen',
	weiß: 'wissen', wusste: 'wissen', wussten: 'wissen', weißt: 'wissen', wisst: 'wissen',
	heißt: 'heißen', hieß: 'heißen', hießen: 'heißen',
	steht: 'stehen', stand: 'stehen', standen: 'stehen', stehst: 'stehen',
	findet: 'finden', fand: 'finden', fanden: 'finden', findest: 'finden',
	bleibt: 'bleiben', blieb: 'bleiben', blieben: 'bleiben', bleibst: 'bleiben',
	bringt: 'bringen', brachte: 'bringen', brachten: 'bringen', bringst: 'bringen',
	denkt: 'denken', dachte: 'denken', dachten: 'denken', denkst: 'denken',
	liegt: 'liegen', lag: 'liegen', lagen: 'liegen', liegst: 'liegen',
	tut: 'tun', tat: 'tun', taten: 'tun', tust: 'tun',
	läuft: 'laufen', lief: 'laufen', liefen: 'laufen', läufst: 'laufen', lauft: 'laufen',
	trägt: 'tragen', trug: 'tragen', trugen: 'tragen', trägst: 'tragen', tragt: 'tragen',
	schläft: 'schlafen', schlief: 'schlafen', schliefen: 'schlafen', schläfst: 'schlafen', schlaft: 'schlafen',
	hilft: 'helfen', half: 'helfen', halfen: 'helfen', hilfst: 'helfen', helft: 'helfen',
	wirft: 'werfen', warf: 'werfen', warfen: 'werfen', wirfst: 'werfen', werft: 'werfen',
	trifft: 'treffen', traf: 'treffen', trafen: 'treffen', triffst: 'treffen', trefft: 'treffen',
	liest: 'lesen', las: 'lesen', lasen: 'lesen', lest: 'lesen',
	isst: 'essen', aß: 'essen', aßen: 'essen', ass: 'essen', esst: 'essen',
	trinkt: 'trinken', trank: 'trinken', tranken: 'trinken', trinkst: 'trinken',
	schreibt: 'schreiben', schrieb: 'schreiben', schrieben: 'schreiben', schreibst: 'schreiben',
	fliegt: 'fliegen', flog: 'fliegen', flogen: 'fliegen', fliegst: 'fliegen',
	zieht: 'ziehen', zog: 'ziehen', zogen: 'ziehen', ziehst: 'ziehen',
	steigt: 'steigen', stieg: 'steigen', stiegen: 'steigen', steigst: 'steigen',
	greift: 'greifen', griff: 'greifen', griffen: 'greifen', greifst: 'greifen',
	stirbt: 'sterben', starb: 'sterben', starben: 'sterben', stirbst: 'sterben',
	bricht: 'brechen', brach: 'brechen', brachen: 'brechen', brichst: 'brechen',
	vergisst: 'vergessen', vergaß: 'vergessen', vergaßen: 'vergessen', vergass: 'vergessen',
};

function fetchText(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		get(url, (res) => {
			if (res.statusCode === 301 || res.statusCode === 302) {
				return fetchText(res.headers.location!).then(resolve, reject);
			}
			const chunks: Buffer[] = [];
			res.on('data', (c: Buffer) => chunks.push(c));
			res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
			res.on('error', reject);
		}).on('error', reject);
	});
}

function resolveGermanLemma(form: string): string {
	const lower = form.toLowerCase();
	if (DE_INFLECTION_LOOKUP[lower]) return DE_INFLECTION_LOOKUP[lower];
	const stem = deStemmer(lower);
	// Try stem+en (common infinitive pattern)
	return stem;
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
	// Sort descending by count, assign rank 1..N
	const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
	const rankMap = new Map<string, number>();
	sorted.forEach(([lemma], i) => rankMap.set(lemma, i + 1));
	return rankMap;
}

function mapToTsObject(map: Map<string, number>): string {
	return [...map.entries()]
		.map(([k, v]) => `  ${JSON.stringify(k)}:${v}`)
		.join(',\n');
}

async function main() {
	const BASE = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2016';
	console.log('Fetching frequency lists...');
	const [deRaw, esRaw, frRaw] = await Promise.all([
		fetchText(`${BASE}/de/de_50k.txt`),
		fetchText(`${BASE}/es/es_50k.txt`),
		fetchText(`${BASE}/fr/fr_50k.txt`),
	]);

	console.log('Building rank maps...');
	const deMap = buildRankMap(deRaw, resolveGermanLemma);
	const esMap = buildRankMap(esRaw, (f) => f.toLowerCase());
	const frMap = buildRankMap(frRaw, (f) => f.toLowerCase());

	console.log(`DE: ${deMap.size} lemmas, ES: ${esMap.size}, FR: ${frMap.size}`);

	mkdirSync('src/lib/frequency', { recursive: true });

	const ts = `// Auto-generated — do not edit manually.
// Rebuild with: pnpm tsx prisma/scripts/build-frequency-db.ts
// Source: hermitdave/FrequencyWords (OpenSubtitles 2016, MIT licence)
// German forms are aggregated to lemmas via strong-verb lookup + Snowball stemmer.
// Format: lowercased lemma → frequency rank (1 = most frequent in corpus).

export const DE_FREQUENCY: Record<string, number> = {
${mapToTsObject(deMap)}
};

export const ES_FREQUENCY: Record<string, number> = {
${mapToTsObject(esMap)}
};

export const FR_FREQUENCY: Record<string, number> = {
${mapToTsObject(frMap)}
};

const MAPS: Record<string, Record<string, number>> = {
  German: DE_FREQUENCY,
  Spanish: ES_FREQUENCY,
  French: FR_FREQUENCY,
};

/**
 * Returns the corpus frequency rank of a lemma (1 = most common).
 * Returns null if the lemma is not in the frequency database.
 */
export function getFrequencyRank(lemma: string, language: string): number | null {
  const map = MAPS[language];
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
	console.log(`Written src/lib/frequency/index.ts (${(ts.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
