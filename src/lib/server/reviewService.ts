import { gradeWithLlm } from './gradingService';

export interface GradeResult {
  correct: boolean;
  score: number;
}

export async function gradeReviewAnswer(
  userId: string,
  userAnswer: string,
  lemma: string,
  correctMeaning: string,
  useLocalLlm: boolean
): Promise<GradeResult> {
  const result = await gradeWithLlm(
    userId,
    'vocab',
    { userAnswer, lemma, correctMeaning },
    { useLocalLlm, fastPathAnswer: correctMeaning }
  );

  return {
    correct: result.correct,
    score: result.score
  };
}
