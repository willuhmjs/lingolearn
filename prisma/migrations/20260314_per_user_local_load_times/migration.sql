-- Add per-user local LLM load time samples (array of timing measurements)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "localLoadTimeSamples" INTEGER[] NOT NULL DEFAULT '{}';
