import { generateChatCompletion } from './llm';
import { isClearlyCorrect } from './fuzzyGrade';
import { isQuotaExceeded, recordTokenUsage } from './aiQuota';
import { z } from 'zod';

export type GradingRubricType = 'vocab' | 'comprehension' | 'grammar';

export interface GradeResult {
  score: number;
  feedback: string;
  correct: boolean;
}

interface GradingRubric {
  systemPrompt: string;
  userMessage: (data: any) => string;
  schema: z.ZodType<any>;
}

const RUBRICS: Record<GradingRubricType, GradingRubric> = {
  vocab: {
    systemPrompt: `You are grading a vocabulary flashcard review. The student was shown a word and typed their translation into English.
You must output ONLY valid JSON with no extra text: {"correct": boolean, "score": number}
- correct: true if the answer demonstrates understanding of the word's meaning (allow minor typos, alternate phrasings, synonyms, partial answers that capture the core meaning)
- score: 0.0 to 1.0 (1.0 = perfect match, 0.8 = correct with minor issues, 0.5 = partially correct, 0.0 = wrong or blank)
Be lenient with spelling variations and accept common synonyms.`,
    userMessage: (data) =>
      `Word: ${data.lemma}\nCorrect meaning: ${data.correctMeaning}\nStudent's answer: ${data.userAnswer}`,
    schema: z.object({
      correct: z.boolean(),
      score: z.number().min(0).max(1)
    })
  },
  comprehension: {
    systemPrompt: `You are grading a reading comprehension answer for a language learning app.
The student read an authentic text in their target language and answered a question in English.
Output ONLY valid JSON: {"score": number, "feedback": string}
- score: 0.0 to 1.0 (1.0 = complete and accurate, 0.7 = mostly correct, 0.4 = partially correct, 0.0 = wrong/irrelevant)
- feedback: 1-2 sentences of constructive feedback in English. Mention what was good and what was missing if score < 1.0.
Be lenient with phrasing as long as the core meaning is correct. Accept synonyms and paraphrases.`,
    userMessage: (data) =>
      `Question: ${data.question}\nSample answer: ${data.sampleAnswer}\nStudent's answer: ${data.userAnswer}`,
    schema: z.object({
      score: z.number().min(0).max(1),
      feedback: z.string()
    })
  },
  grammar: {
    systemPrompt: `You are grading a grammar exercise. The student was asked to apply a specific grammar rule.
You must output ONLY valid JSON with no extra text: {"score": number, "feedback": string}
- score: 0.0 to 1.0 (1.0 = perfect application of the rule, 0.7 = mostly correct with minor issues, 0.4 = partially correct, 0.0 = wrong or irrelevant)
- feedback: 1-2 sentences of constructive feedback in English.
Be lenient with minor spelling errors if the grammatical structure is correct.`,
    userMessage: (data) =>
      `Rule: ${data.ruleTitle}\nContext: ${data.context}\nStudent's answer: ${data.userAnswer}`,
    schema: z.object({
      score: z.number().min(0).max(1),
      feedback: z.string()
    })
  }
};

export async function gradeWithLlm(
  userId: string,
  type: GradingRubricType,
  data: any,
  options: {
    useLocalLlm: boolean;
    sampleAnswer?: string;
    fastPathAnswer?: string;
  }
): Promise<GradeResult> {
  const { userAnswer } = data;
  const { useLocalLlm, sampleAnswer, fastPathAnswer } = options;

  if (!userAnswer?.trim()) {
    return { score: 0, feedback: 'No answer provided.', correct: false };
  }

  // Fast path: skip LLM if fuzzy matching is confident the answer is correct
  const compareTo = fastPathAnswer || sampleAnswer;
  if (compareTo && isClearlyCorrect(userAnswer, compareTo)) {
    return { score: 1.0, feedback: '', correct: true };
  }

  if (!useLocalLlm && (await isQuotaExceeded(userId, false))) {
    throw new Error('Daily AI quota exceeded. Please try again tomorrow.');
  }

  const rubric = RUBRICS[type];
  try {
    const response = await generateChatCompletion({
      userId,
      messages: [{ role: 'user', content: rubric.userMessage(data) }],
      systemPrompt: rubric.systemPrompt,
      jsonMode: true,
      schema: rubric.schema,
      temperature: 0.1,
      onUsage: useLocalLlm
        ? undefined
        : ({ totalTokens }) => {
            recordTokenUsage(userId, totalTokens);
          }
    });

    const result = JSON.parse(response.choices[0].message.content);
    const score =
      typeof result.score === 'number'
        ? Math.max(0, Math.min(1, result.score))
        : result.correct
          ? 1.0
          : 0.0;
    return {
      score,
      feedback: result.feedback || '',
      correct: result.correct ?? score >= 0.8
    };
  } catch (error) {
    console.error('Grading failed', error);
    return {
      score: 0,
      feedback: error instanceof Error ? error.message : 'Error during grading.',
      correct: false
    };
  }
}
