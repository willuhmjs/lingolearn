-- DropForeignKey
ALTER TABLE "LiveSession" DROP CONSTRAINT "LiveSession_gameId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "useLocalLlm" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vocabulary" ADD COLUMN     "cefrLevel" TEXT NOT NULL DEFAULT 'A1';

-- CreateIndex
CREATE INDEX "AssignmentScore_assignmentId_idx" ON "AssignmentScore"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentScore_userId_idx" ON "AssignmentScore"("userId");

-- CreateIndex
CREATE INDEX "ClassMember_classId_idx" ON "ClassMember"("classId");

-- CreateIndex
CREATE INDEX "ClassMember_userId_idx" ON "ClassMember"("userId");

-- CreateIndex
CREATE INDEX "GameQuestion_gameId_idx" ON "GameQuestion"("gameId");

-- CreateIndex
CREATE INDEX "LiveSession_classId_idx" ON "LiveSession"("classId");

-- CreateIndex
CREATE INDEX "LiveSession_gameId_idx" ON "LiveSession"("gameId");

-- CreateIndex
CREATE INDEX "LiveSessionParticipant_sessionId_idx" ON "LiveSessionParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "LiveSessionParticipant_userId_idx" ON "LiveSessionParticipant"("userId");

-- CreateIndex
CREATE INDEX "UserGrammarRule_userId_srsState_nextReviewDate_idx" ON "UserGrammarRule"("userId", "srsState", "nextReviewDate");

-- CreateIndex
CREATE INDEX "UserProgress_userId_idx" ON "UserProgress"("userId");

-- CreateIndex
CREATE INDEX "UserVocabulary_userId_srsState_nextReviewDate_idx" ON "UserVocabulary"("userId", "srsState", "nextReviewDate");

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;