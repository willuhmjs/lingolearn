import { updateGamification } from './gamification';
import { updateImmersionAssignmentScore } from './assignmentService';
import { updateSrsMetricsBatch } from './grader';
import { gradeWithLlm } from './gradingService';

export interface ImmersionGradeResult {
  score: number;
  feedback: string;
  assignmentProgress: any;
}

export async function gradeImmersionAnswer(
  userId: string,
  data: {
    question: string;
    userAnswer: string;
    sampleAnswer: string;
    awardXp?: number;
    directXp?: number;
    assignmentId?: string;
    correctCount?: number;
    vocabIds?: string[];
  },
  useLocalLlm: boolean
): Promise<ImmersionGradeResult> {
  const {
    question,
    userAnswer,
    sampleAnswer,
    awardXp,
    directXp,
    assignmentId,
    correctCount,
    vocabIds
  } = data;

  // directXp: skip LLM grading, just award this XP amount directly (used for MCQ batches)
  if (typeof directXp === 'number' && (directXp > 0 || assignmentId)) {
    if (!assignmentId) {
      await updateGamification(userId, directXp);
    }
    // Update assignment score for MCQ batch if in assignment context
    let assignmentProgress = null;
    if (assignmentId && typeof correctCount === 'number' && correctCount > 0) {
      assignmentProgress = await updateImmersionAssignmentScore(assignmentId, userId, correctCount);
    }
    return { score: 1, feedback: '', assignmentProgress };
  }

  const result = await gradeWithLlm(
    userId,
    'comprehension',
    { question, sampleAnswer, userAnswer },
    { useLocalLlm, sampleAnswer }
  );

  const { score, feedback } = result;

  // Award XP proportional to score (skip XP for assignments)
  if (!assignmentId && awardXp && typeof awardXp === 'number' && score > 0) {
    const xpEarned = Math.round(awardXp * score);
    if (xpEarned > 0) {
      await updateGamification(userId, xpEarned);
    }
  }

  // Track assignment score: count as correct if score >= 0.5
  let assignmentProgress = null;
  if (assignmentId && score >= 0.5) {
    assignmentProgress = await updateImmersionAssignmentScore(assignmentId, userId, 1);
  }

  // Feed immersion comprehension score back into SRS for the vocab seen in this session
  if (Array.isArray(vocabIds) && vocabIds.length > 0) {
    await updateSrsMetricsBatch(userId, vocabIds, score);
  }

  return { score, feedback, assignmentProgress };
}
