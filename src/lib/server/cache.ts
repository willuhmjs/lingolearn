import { prisma } from './prisma';
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

export async function getCachedLanguages(): Promise<Language[]> {
    let languages = cache.get<Language[]>('all_languages');
    if (!languages) {
        languages = await prisma.language.findMany({ orderBy: { name: 'asc' } });
        cache.set('all_languages', languages, 3600);
    }
    return languages;
}

export async function getCachedLanguageByCode(code: string): Promise<Language | null> {
    const languages = await getCachedLanguages();
    return languages.find(l => l.code === code) || null;
}

export async function getCachedLanguageById(id: string): Promise<Language | null> {
    const languages = await getCachedLanguages();
    return languages.find(l => l.id === id) || null;
}

export async function getCachedLanguageByName(name: string): Promise<Language | null> {
    const languages = await getCachedLanguages();
    const lowerName = name.toLowerCase();
    return languages.find(l => l.name.toLowerCase() === lowerName) || null;
}
