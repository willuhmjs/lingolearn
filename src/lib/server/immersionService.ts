import { generateChatCompletion } from './llm';
import { isClearlyCorrect } from './fuzzyGrade';
import { isQuotaExceeded, recordTokenUsage } from './aiQuota';
import { updateGamification } from './gamification';
import { updateImmersionAssignmentScore } from './assignmentService';
import { updateSrsMetrics } from './grader';

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

  if (!userAnswer?.trim()) {
    return { score: 0, feedback: 'No answer provided.', assignmentProgress: null };
  }

  // Fast path: skip LLM if fuzzy matching is confident the answer is correct
  if (sampleAnswer && isClearlyCorrect(userAnswer, sampleAnswer)) {
    if (!assignmentId && awardXp && typeof awardXp === 'number') {
      await updateGamification(userId, awardXp);
    }
    let assignmentProgress = null;
    if (assignmentId) {
      assignmentProgress = await updateImmersionAssignmentScore(assignmentId, userId, 1);
    }
    if (Array.isArray(vocabIds) && vocabIds.length > 0) {
      await Promise.allSettled(vocabIds.map((id: string) => updateSrsMetrics(userId, id, 1.0)));
    }
    return { score: 1, feedback: '', assignmentProgress };
  }

  const systemPrompt = `You are grading a reading comprehension answer for a language learning app.
The student read an authentic text in their target language and answered a question in English.
Output ONLY valid JSON: {"score": number, "feedback": string}
- score: 0.0 to 1.0 (1.0 = complete and accurate, 0.7 = mostly correct, 0.4 = partially correct, 0.0 = wrong/irrelevant)
- feedback: 1-2 sentences of constructive feedback in English. Mention what was good and what was missing if score < 1.0.
Be lenient with phrasing as long as the core meaning is correct. Accept synonyms and paraphrases.`;

  const userMessage = `Question: ${question}
Sample answer: ${sampleAnswer}
Student's answer: ${userAnswer}`;

  if (!useLocalLlm && (await isQuotaExceeded(userId, false))) {
    throw new Error('Daily AI quota exceeded. Please try again tomorrow.');
  }

  const response = await generateChatCompletion({
    userId,
    messages: [{ role: 'user', content: userMessage }],
    systemPrompt,
    jsonMode: true,
    temperature: 0.1,
    onUsage: useLocalLlm
      ? undefined
      : ({ totalTokens }) => {
          recordTokenUsage(userId, totalTokens);
        }
  });

  const result = JSON.parse(response.choices[0].message.content);
  const score = typeof result.score === 'number' ? Math.max(0, Math.min(1, result.score)) : 0;

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
    await Promise.allSettled(vocabIds.map((id: string) => updateSrsMetrics(userId, id, score)));
  }

  return { score, feedback: result.feedback || '', assignmentProgress };
}
