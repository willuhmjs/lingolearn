import { prisma } from './prisma';
import { getLanguageNames, getLanguageConfig } from '$lib/languages';
import { initFrequencyForLanguage } from './frequencyLoader';
import { seedDestinationsForLanguage } from './destinationsSeed';
import type { Language } from '@prisma/client';

type CacheEntry<T> = {
  value: T;
  expiry: number;
};

class Cache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, value: T, ttlSeconds: number = 3600): void {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiry });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new Cache();

// Tracks whether the one-time language registry sync has run this process.
let languageSyncDone = false;

/**
 * Ensures every language in the config registry exists in the DB (upsert),
 * then kicks off async frequency pre-loading for any non-statically-bundled
 * languages. Runs at most once per process lifetime.
 */
async function syncLanguagesFromRegistry(): Promise<void> {
  if (languageSyncDone) return;
  languageSyncDone = true;

  for (const name of getLanguageNames()) {
    const config = getLanguageConfig(name);
    const row = await prisma.language.upsert({
      where: { code: config.code },
      update: { name: config.name, flag: config.flag },
      create: { code: config.code, name: config.name, flag: config.flag }
    });
    // Seed immersion destinations if none exist yet for this language.
    await seedDestinationsForLanguage(name, row.id, prisma);
    // Fire-and-forget: load frequency data from disk or GitHub for this language.
    initFrequencyForLanguage(name, config.code).catch(console.error);
  }

  // Invalidate stale cache so the fresh list is fetched next.
  cache.delete('all_languages');
}

export async function getCachedLanguages(): Promise<Language[]> {
  await syncLanguagesFromRegistry();

  let languages = cache.get<Language[]>('all_languages');
  if (!languages) {
    languages = await prisma.language.findMany({ orderBy: { name: 'asc' } });
    cache.set('all_languages', languages, 3600);
  }
  return languages;
}

export async function getCachedLanguageByCode(code: string): Promise<Language | null> {
  const languages = await getCachedLanguages();
  return languages.find((l) => l.code === code) || null;
}

export async function getCachedLanguageById(id: string): Promise<Language | null> {
  const languages = await getCachedLanguages();
  return languages.find((l) => l.id === id) || null;
}

export async function getCachedLanguageByName(name: string): Promise<Language | null> {
  const languages = await getCachedLanguages();
  const lowerName = name.toLowerCase();
  return languages.find((l) => l.name.toLowerCase() === lowerName) || null;
}
