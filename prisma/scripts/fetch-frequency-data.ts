/**
 * Downloads frequency word lists from the hermitdave/FrequencyWords corpus
 * for the specified language codes and saves them to prisma/data/frequency/.
 *
 * Run with: pnpm fetch:frequency <code> [<code> ...]
 * Example:  pnpm fetch:frequency it ja pt
 *
 * After downloading new languages, rebuild the bundled frequency index:
 *   pnpm build:frequency
 *
 * Then commit both the downloaded .txt files and the regenerated
 * src/lib/frequency/index.ts so the data is available in the container
 * without any network access at runtime.
 */

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'prisma/data/frequency';
const BASE_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018';

async function fetchLanguage(code: string): Promise<void> {
	const outPath = join(DATA_DIR, `${code}_50k.txt`);

	if (existsSync(outPath)) {
		console.log(`[skip] ${code}_50k.txt already exists — delete it to re-download`);
		return;
	}

	const url = `${BASE_URL}/${code}/${code}_50k.txt`;
	console.log(`[fetch] ${code} → ${url}`);

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} fetching ${url}`);
	}

	const text = await res.text();
	writeFileSync(outPath, text, 'utf8');

	const lines = text.trim().split('\n').length;
	console.log(`[done]  ${lines} entries saved to ${outPath}`);
}

async function main() {
	const codes = process.argv.slice(2);
	if (codes.length === 0) {
		console.error('Usage: pnpm fetch:frequency <code> [<code> ...]');
		console.error('Example: pnpm fetch:frequency it ja pt');
		console.error('');
		console.error('Language codes match ISO 639-1 (e.g. it=Italian, ja=Japanese, pt=Portuguese).');
		console.error('Make sure the language is registered in src/lib/languages/ before rebuilding.');
		process.exit(1);
	}

	for (const code of codes) {
		await fetchLanguage(code);
	}

	console.log('');
	console.log('Next: rebuild the bundled frequency index and commit everything:');
	console.log('  pnpm build:frequency');
	console.log('  git add prisma/data/frequency/ src/lib/frequency/index.ts');
	console.log('  git commit -m "chore: add frequency data for ' + codes.join(', ') + '"');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
