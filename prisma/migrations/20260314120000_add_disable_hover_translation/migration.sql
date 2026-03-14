-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "disableHoverTranslation" BOOLEAN NOT NULL DEFAULT false;
