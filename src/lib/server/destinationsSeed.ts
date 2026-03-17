/**
 * Seeds ImmersionDestination rows for a language if none exist yet.
 * Destination data lives in each language's config file (src/lib/languages/),
 * so adding destinations for a new language = edit its language file only.
 */

import { getLanguageConfig } from '$lib/languages';

/**
 * Seeds ImmersionDestination rows for the given language if none exist yet.
 * Safe to call on every startup — skips if destinations are already present.
 */
export async function seedDestinationsForLanguage(
  langName: string,
  langId: string,
  prisma: import('@prisma/client').PrismaClient
): Promise<void> {
  const destinations = getLanguageConfig(langName).destinations;
  if (!destinations || destinations.length === 0) return;

  const existing = await prisma.immersionDestination.count({ where: { languageId: langId } });
  if (existing > 0) return;

  await prisma.immersionDestination.createMany({
    data: destinations.map((d) => ({ ...d, languageId: langId }))
  });
  console.log(`[seed] Seeded ${destinations.length} destinations for ${langName}`);
}
