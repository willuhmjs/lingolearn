import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting CEFR data migration...');

  // 1. Update Vocabulary: isBeginner: true -> cefrLevel: 'A1'
  const vocabA1 = await prisma.vocabulary.updateMany({
    where: {
      isBeginner: true,
      cefrLevel: 'A1' // Default is A1 anyway, but let's be explicit if it was different
    },
    data: {
      cefrLevel: 'A1'
    }
  });
  console.log(`Updated ${vocabA1.count} vocabulary items to A1 (isBeginner: true)`);

  // 2. Update Vocabulary: isBeginner: false -> cefrLevel: 'A1' (default)
  // Actually, they are already A1 by default in schema.
  // If we had a way to know which ones are A2+, we'd do it here.
  // For now, mapping all non-beginner to A1 as well, or leaving them as is.
  // The spec says "mapping isBeginner: true to A1".

  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
