import { generateChatCompletion } from './llm';
import { isClearlyCorrect } from './fuzzyGrade';
import { isQuotaExceeded, recordTokenUsage } from './aiQuota';

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
  if (!userAnswer?.trim()) {
    return { correct: false, score: 0 };
  }

  // Fast path: skip LLM if fuzzy matching is confident the answer is correct
  if (correctMeaning && isClearlyCorrect(userAnswer, correctMeaning)) {
    return { correct: true, score: 1.0 };
  }

  const systemPrompt = `You are grading a vocabulary flashcard review. The student was shown a word and typed their translation into English.
You must output ONLY valid JSON with no extra text: {"correct": boolean, "score": number}
- correct: true if the answer demonstrates understanding of the word's meaning (allow minor typos, alternate phrasings, synonyms, partial answers that capture the core meaning)
- score: 0.0 to 1.0 (1.0 = perfect match, 0.8 = correct with minor issues, 0.5 = partially correct, 0.0 = wrong or blank)
Be lenient with spelling variations and accept common synonyms.`;

  const userMessage = `Word: ${lemma}
Correct meaning: ${correctMeaning}
Student's answer: ${userAnswer}`;

  if (!useLocalLlm && (await isQuotaExceeded(userId, false))) {
    return { correct: false, score: 0 };
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

  try {
    const result = JSON.parse(response.choices[0].message.content);
    return {
      correct: !!result.correct,
      score: typeof result.score === 'number' ? result.score : result.correct ? 1.0 : 0.0
    };
  } catch (error) {
    console.error('Failed to parse grading response', error);
    return { correct: false, score: 0 };
  }
}
