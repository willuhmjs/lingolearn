-- AlterTable: add overrideCount to UserVocabularyProgress to audit self-grade overrides
ALTER TABLE "UserVocabularyProgress" ADD COLUMN "overrideCount" INTEGER NOT NULL DEFAULT 0;
