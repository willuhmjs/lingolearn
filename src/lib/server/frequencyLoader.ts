/**
 * Frequency rank lookup for all supported languages.
 *
 * All frequency data is statically bundled in src/lib/frequency/index.ts,
 * which is pre-built from the hermitdave/FrequencyWords corpus by running:
 *
 *   pnpm fetch:frequency <code>   # download raw data for a new language
 *   pnpm build:frequency          # regenerate index.ts, then commit both
 *
 * No network access or disk I/O happens at runtime.
 */

import { FREQUENCY_MAPS, estimateFrequencyRank } from '$lib/frequency/index';

/**
 * No-op kept for call-site compatibility. All frequency data is now bundled
 * statically — nothing needs to be initialised at runtime.
 */
export function initFrequencyForLanguage(langName: string, _langCode: string): Promise<void> {
  if (!FREQUENCY_MAPS[langName]) {
    console.warn(
      `[frequency] No bundled data for "${langName}". ` +
        `Run: pnpm fetch:frequency <code> && pnpm build:frequency`
    );
  }
  return Promise.resolve();
}

/**
 * Returns the frequency rank of a lemma (1 = most common in corpus).
 * Returns null if the language has no bundled data or the word is absent.
 */
export function getFrequencyRankDynamic(lemma: string, langName: string): number | null {
  const map = FREQUENCY_MAPS[langName];
  if (!map) return null;
  return map[lemma.toLowerCase()] ?? null;
}

export { estimateFrequencyRank };
