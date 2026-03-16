export type { LanguageConfig, ArticleForm, ArticleMapEntry, InflectionEntry } from './types';

import german from './german';
import french from './french';
import spanish from './spanish';

/** All registered language configs, keyed by display name. */
const LANGUAGES: Record<string, typeof german> = {
	German: german,
	French: french,
	Spanish: spanish
};

/**
 * Look up a language config by display name (e.g. "German").
 * Returns the German config as a safe fallback for unknown names.
 */
export function getLanguageConfig(name: string): typeof german {
	return LANGUAGES[name] ?? german;
}

/** All registered language display names. */
export function getLanguageNames(): string[] {
	return Object.keys(LANGUAGES);
}

// Re-export individual configs for direct imports
export { german, french, spanish };
