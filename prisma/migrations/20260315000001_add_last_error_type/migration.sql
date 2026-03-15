-- AlterTable: add lastErrorType to UserVocabularyProgress and UserGrammarRuleProgress
ALTER TABLE "UserVocabularyProgress" ADD COLUMN "lastErrorType" TEXT;
ALTER TABLE "UserGrammarRuleProgress" ADD COLUMN "lastErrorType" TEXT;
