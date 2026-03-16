/**
 * Frequency rank lookup for all supported languages.
 *
 * German, Spanish, and French use statically bundled maps (pre-built by
 * prisma/scripts/build-frequency-db.ts from the hermitdave/FrequencyWords
 * corpus). Any other language registered in the config registry is:
 *
 *   1. Looked up from a local disk cache (.cache/frequency/{code}_ranks.json)
 *   2. If absent, downloaded from hermitdave/FrequencyWords on GitHub, parsed,
 *      and saved to disk so subsequent restarts skip the network fetch.
 *
 * URL pattern: https://raw.githubusercontent.com/hermitdave/FrequencyWords/
 *              master/content/2018/{code}/{code}_50k.txt
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DE_FREQUENCY, ES_FREQUENCY, FR_FREQUENCY } from '$lib/frequency/index';
import { estimateFrequencyRank } from '$lib/frequency/index';

// Directory for persisted rank maps (relative to server working directory).
const CACHE_DIR = join(process.cwd(), '.cache', 'frequency');

// Static maps: built at compile time, always available instantly.
const STATIC_MAPS: Record<string, Record<string, number>> = {
	German: DE_FREQUENCY,
	Spanish: ES_FREQUENCY,
	French: FR_FREQUENCY
};

// Runtime maps: loaded from disk or fetched from GitHub on first use.
const dynamicMaps = new Map<string, Record<string, number>>();

// In-flight promises: deduplicate concurrent first requests for the same language.
const inFlight = new Map<string, Promise<void>>();

function parseFrequencyList(text: string): Record<string, number> {
	const countMap = new Map<string, number>();
	for (const line of text.trim().split('\n')) {
		const space = line.indexOf(' ');
		if (space === -1) continue;
		const form = line.slice(0, space).toLowerCase();
		const count = parseInt(line.slice(space + 1));
		if (form && !isNaN(count)) {
			countMap.set(form, (countMap.get(form) ?? 0) + count);
		}
	}
	const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
	const rankMap: Record<string, number> = {};
	sorted.forEach(([lemma], i) => {
		rankMap[lemma] = i + 1;
	});
	return rankMap;
}

function diskCachePath(langCode: string): string {
	return join(CACHE_DIR, `${langCode}_ranks.json`);
}

function loadFromDisk(langCode: string): Record<string, number> | null {
	const path = diskCachePath(langCode);
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		return null;
	}
}

function saveToDisk(langCode: string, map: Record<string, number>): void {
	try {
		mkdirSync(CACHE_DIR, { recursive: true });
		writeFileSync(diskCachePath(langCode), JSON.stringify(map));
	} catch (err) {
		console.warn(`[frequency] Could not save cache for ${langCode}:`, err);
	}
}

/**
 * Pre-fetches (or loads from disk cache) the frequency list for a language
 * that is not statically bundled. Safe to call multiple times — deduplicates
 * in-flight requests and is a no-op if data is already in memory.
 */
export async function initFrequencyForLanguage(langName: string, langCode: string): Promise<void> {
	if (STATIC_MAPS[langName] || dynamicMaps.has(langName)) return;
	if (inFlight.has(langName)) {
		await inFlight.get(langName);
		return;
	}

	const promise = (async () => {
		// 1. Try disk cache first
		const cached = loadFromDisk(langCode);
		if (cached) {
			dynamicMaps.set(langName, cached);
			console.log(
				`[frequency] Loaded ${Object.keys(cached).length} entries for ${langName} (disk cache)`
			);
			inFlight.delete(langName);
			return;
		}

		// 2. Download from GitHub
		const url = `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/${langCode}/${langCode}_50k.txt`;
		try {
			console.log(`[frequency] Downloading frequency list for ${langName}...`);
			const res = await fetch(url);
			if (!res.ok) {
				console.warn(`[frequency] No data for ${langName} (${langCode}): HTTP ${res.status}`);
				return;
			}
			const text = await res.text();
			const map = parseFrequencyList(text);
			dynamicMaps.set(langName, map);
			saveToDisk(langCode, map);
			console.log(
				`[frequency] Downloaded and cached ${Object.keys(map).length} entries for ${langName}`
			);
		} catch (err) {
			console.warn(`[frequency] Failed to load frequency for ${langName}:`, err);
		} finally {
			inFlight.delete(langName);
		}
	})();

	inFlight.set(langName, promise);
	await promise;
}

/**
 * Returns the frequency rank of a lemma (1 = most common in corpus).
 * Checks static maps first, then dynamic maps loaded at runtime.
 * Returns null if the language has no data loaded yet or the word is absent.
 */
export function getFrequencyRankDynamic(lemma: string, langName: string): number | null {
	const map = STATIC_MAPS[langName] ?? dynamicMaps.get(langName);
	if (!map) return null;
	return map[lemma.toLowerCase()] ?? null;
}

export { estimateFrequencyRank };
