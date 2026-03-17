import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';
import { getFrequencyRank, estimateFrequencyRank } from '../src/lib/frequency/index.ts';
import { getLanguageNames, getLanguageConfig } from '../src/lib/languages/index.ts';
import type { LanguageSeedData } from './seed-types';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Shared seeding helpers
// ---------------------------------------------------------------------------

async function seedVocabulary(
  client: PrismaClient,
  vocab: LanguageSeedData['vocabulary'],
  langName: string,
  langId: string
) {
  for (const v of vocab) {
    const existing = await client.vocabulary.findFirst({
      where: { lemma: v.lemma, languageId: langId }
    });
    const frequency = getFrequencyRank(v.lemma, langName) ?? estimateFrequencyRank(v.lemma);
    if (existing) {
      await client.vocabulary.update({
        where: { id: existing.id },
        data: {
          partOfSpeech: v.partOfSpeech,
          isBeginner: v.isBeginner,
          gender: v.gender as any,
          plural: v.plural,
          frequency,
          meanings: {
            create: v.meaning ? [{ value: v.meaning, partOfSpeech: v.partOfSpeech }] : []
          }
        }
      });
    } else {
      await client.vocabulary.create({
        data: {
          lemma: v.lemma,
          partOfSpeech: v.partOfSpeech,
          isBeginner: v.isBeginner,
          gender: v.gender as any,
          plural: v.plural,
          frequency,
          languageId: langId,
          meanings: {
            create: v.meaning ? [{ value: v.meaning, partOfSpeech: v.partOfSpeech }] : []
          }
        }
      });
    }
  }
}

async function seedGrammarRules(
  client: PrismaClient,
  rules: LanguageSeedData['grammarRules'],
  langId: string
) {
  // First pass: upsert rules without dependencies
  for (const rule of rules) {
    const existing = await client.grammarRule.findFirst({
      where: { title: rule.title, languageId: langId }
    });
    if (existing) {
      await client.grammarRule.update({
        where: { id: existing.id },
        data: {
          description: rule.description,
          guide: rule.guide,
          level: rule.level,
          ruleType: rule.ruleType ?? null,
          targetForms: rule.targetForms ?? []
        }
      });
    } else {
      await client.grammarRule.create({
        data: {
          title: rule.title,
          description: rule.description,
          guide: rule.guide,
          level: rule.level,
          ruleType: rule.ruleType ?? null,
          targetForms: rule.targetForms ?? [],
          languageId: langId
        }
      });
    }
  }

  // Second pass: connect dependencies
  for (const rule of rules) {
    if (!rule.dependencies || rule.dependencies.length === 0) continue;
    const current = await client.grammarRule.findFirst({
      where: { title: rule.title, languageId: langId }
    });
    const parents = await client.grammarRule.findMany({
      where: { title: { in: rule.dependencies }, languageId: langId }
    });
    if (current && parents.length > 0) {
      await client.grammarRule.update({
        where: { id: current.id },
        data: { dependencies: { connect: parents.map((p) => ({ id: p.id })) } }
      });
    }
  }
}

async function seedDestinations(client: PrismaClient, langName: string, langId: string) {
  const destinations = getLanguageConfig(langName).destinations;
  if (!destinations?.length) return;
  const existing = await client.immersionDestination.count({ where: { languageId: langId } });
  if (existing > 0) return;
  await client.immersionDestination.createMany({
    data: destinations.map((d) => ({ ...d, languageId: langId }))
  });
  console.log(`  Seeded ${destinations.length} destinations for ${langName}.`);
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

export async function runSeed(client: PrismaClient = prisma, override: boolean = false) {
  const count = await client.vocabulary.count();
  if (count > 0 && !override) {
    console.log('Database already seeded. Skipping...');
    return;
  }

  console.log('Start seeding...');

  // 1. Languages — driven entirely by the config registry.
  //    To add a new language: create src/lib/languages/{name}.ts and import
  //    it in src/lib/languages/index.ts. No changes needed here.
  console.log('Creating languages...');
  const languageRows: Record<string, { id: string }> = {};
  for (const langName of getLanguageNames()) {
    const config = getLanguageConfig(langName);
    const row = await client.language.upsert({
      where: { code: config.code },
      update: { name: config.name, flag: config.flag },
      create: { code: config.code, name: config.name, flag: config.flag }
    });
    languageRows[langName] = row;
  }

  // 2. Vocabulary + Grammar — loaded from each language's vocab directory.
  //    Convention: prisma/{name_lowercase}_vocab/index.ts exports { seedData }.
  //    If no directory exists for a language, it is skipped gracefully.
  console.log('Seeding vocabulary and grammar rules...');
  for (const langName of getLanguageNames()) {
    const langId = languageRows[langName]?.id;
    if (!langId) continue;

    let seedData: LanguageSeedData | null = null;
    try {
      const mod = await import(`./${langName.toLowerCase()}_vocab/index.ts`);
      seedData = mod.seedData as LanguageSeedData;
    } catch {
      console.log(`  No seed data found for ${langName} — skipping vocabulary.`);
      continue;
    }

    console.log(
      `  Seeding ${seedData.vocabulary.length} vocab + ${seedData.grammarRules.length} grammar rules for ${langName}...`
    );
    await seedVocabulary(client, seedData.vocabulary, langName, langId);
    await seedGrammarRules(client, seedData.grammarRules, langId);
    console.log(`  Done with ${langName}.`);
  }

  // 3. Apply frequency ranks to all vocabulary in the DB.
  console.log('Applying frequency ranks...');
  const languages = await client.language.findMany({ select: { id: true, name: true } });
  for (const lang of languages) {
    const vocab = await client.vocabulary.findMany({
      where: { languageId: lang.id },
      select: { id: true, lemma: true }
    });
    if (vocab.length === 0) continue;
    console.log(`  Processing ${lang.name} (${vocab.length} words)...`);
    const BATCH = 500;
    let updated = 0;
    for (let i = 0; i < vocab.length; i += BATCH) {
      const batch = vocab.slice(i, i + BATCH);
      await Promise.all(
        batch.map((v) =>
          client.vocabulary.update({
            where: { id: v.id },
            data: {
              frequency: getFrequencyRank(v.lemma, lang.name) ?? estimateFrequencyRank(v.lemma)
            }
          })
        )
      );
      updated += batch.length;
      process.stdout.write(`\r    Updated ${updated}/${vocab.length}`);
    }
    console.log(`\n    Done.`);
  }
  console.log('Frequency ranks applied.');

  // 4. Immersion destinations — from each language's config.destinations field.
  console.log('Seeding immersion destinations...');
  for (const langName of getLanguageNames()) {
    const langId = languageRows[langName]?.id;
    if (langId) await seedDestinations(client, langName, langId);
  }

  console.log('Seeding finished.');
}

async function main() {
  await runSeed(prisma);
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1] === __filename) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
