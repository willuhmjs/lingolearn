import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set. Please configure the database connection string.');
}
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function migrate() {
  console.log('Starting data migration...');

  // 1. Create Languages
  console.log('Creating languages...');
  const german = await prisma.language.upsert({
    where: { code: 'de' },
    update: {},
    create: { code: 'de', name: 'German', flag: '🇩🇪' },
  });

  const spanish = await prisma.language.upsert({
    where: { code: 'es' },
    update: {},
    create: { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  });

  // 2. Update Vocabulary
  console.log('Updating vocabulary...');
  // Note: Since we reset the database, there might not be records if we haven't seeded yet.
  // But the instructions say "migrate existing data". 
  // If I run the seed now, I should make sure it's aware of the new schema.
  
  // Actually, I should probably update the seed script first and then run it.
  // But let's follow the instructions to create a migration script.
  
  await prisma.vocabulary.updateMany({
    where: { languageId: null },
    data: { languageId: german.id }
  });

  // 3. Update Grammar Rules
  console.log('Updating grammar rules...');
  await prisma.grammarRule.updateMany({
    where: { languageId: null },
    data: { languageId: german.id }
  });

  // 4. Update Users and create UserProgress
  console.log('Updating users and creating progress...');
  const users = await prisma.user.findMany();
  for (const user of users) {
    // German progress
    await prisma.userProgress.upsert({
      where: { userId_languageId: { userId: user.id, languageId: german.id } },
      update: {},
      create: {
        userId: user.id,
        languageId: german.id,
        cefrLevel: user.cefrLevel || 'A1',
        hasOnboarded: user.hasOnboarded || false,
      }
    });

    // Spanish progress (default)
    await prisma.userProgress.upsert({
      where: { userId_languageId: { userId: user.id, languageId: spanish.id } },
      update: {},
      create: {
        userId: user.id,
        languageId: spanish.id,
        cefrLevel: 'A1',
        hasOnboarded: false,
      }
    });

    // Set active language
    await prisma.user.update({
      where: { id: user.id },
      data: { activeLanguageId: german.id }
    });
  }

  console.log('Data migration finished.');
}

migrate()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
