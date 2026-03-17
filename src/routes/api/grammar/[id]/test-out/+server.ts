import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { generateChatCompletion } from '$lib/server/llm';
import { testOutRateLimiter } from '$lib/server/ratelimit';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';

export async function POST(event) {
  const { params, locals, request } = event;

  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: locals.user.id },
    select: { useLocalLlm: true }
  });

  if (!user?.useLocalLlm && (await testOutRateLimiter.isLimited(event))) {
    return json(
      { error: 'Too many requests. Please wait before generating more questions.' },
      { status: 429 }
    );
  }

  const userId = locals.user.id;

  if (!user?.useLocalLlm && (await isQuotaExceeded(userId, false))) {
    return json({ error: 'Daily AI quota exceeded. Please try again tomorrow.' }, { status: 429 });
  }

  const grammarRuleId = params.id;

  const grammarRule = await prisma.grammarRule.findUnique({
    where: { id: grammarRuleId },
    include: { dependencies: true, language: true }
  });

  if (!grammarRule) {
    return json({ error: 'Grammar rule not found' }, { status: 404 });
  }

  // Validate all prerequisites are mastered
  if (grammarRule.dependencies.length > 0) {
    const prereqStatuses = await prisma.userGrammarRule.findMany({
      where: {
        userId,
        grammarRuleId: { in: grammarRule.dependencies.map((d) => d.id) }
      },
      select: { grammarRuleId: true, srsState: true }
    });

    const allMastered = grammarRule.dependencies.every((dep) => {
      const status = prereqStatuses.find((s) => s.grammarRuleId === dep.id);
      return status?.srsState === 'MASTERED';
    });

    if (!allMastered) {
      return json(
        { error: 'All prerequisites must be mastered before testing out of this rule.' },
        { status: 403 }
      );
    }
  }

  const languageName = grammarRule.language?.name || 'German';
  const level = grammarRule.level || 'A1';

  const systemPrompt = `You are a ${languageName} grammar test question generator.

Generate exactly 10 multiple-choice fill-in-the-blank questions to test the following grammar rule:
Title: "${grammarRule.title}"
Description: ${grammarRule.description || '(no description)'}
CEFR Level: ${level}

Each question MUST:
1. Have a ${languageName} sentence with exactly one blank ("___") that directly tests this grammar rule
2. Have exactly 4 answer options (one correct, three plausible distractors)
3. Include the correctIndex (0-3) indicating which option is correct
4. Include a brief English context hint (translate the sentence with ___ for the blank)
5. Include a brief explanation of why the correct answer is right

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "sentence": "<${languageName} sentence with ___ for the blank>",
      "context": "<English translation hint with ___ for the blank>",
      "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
      "correctIndex": <0-3>,
      "explanation": "<brief explanation of why the correct answer is right>"
    }
  ]
}

Requirements:
- Questions must vary in difficulty (start simpler, end harder)
- Distractors must be plausible but clearly wrong to a learner who knows the rule
- Do NOT repeat the same sentence or structure across questions
- All questions must directly test "${grammarRule.title}", not other unrelated grammar rules
- Use everyday, natural ${languageName} sentences`;

  try {
    const useLocalLlm = user?.useLocalLlm ?? false;
    const response = await generateChatCompletion({
      userId,
      messages: [
        {
          role: 'user',
          content: `Generate 10 test questions for the grammar rule: ${grammarRule.title}`
        }
      ],
      systemPrompt,
      jsonMode: true,
      stream: false,
      signal: request.signal,
      onUsage: useLocalLlm
        ? undefined
        : ({ totalTokens }) => {
            recordTokenUsage(userId, totalTokens);
          }
    });

    let content = response.choices?.[0]?.message?.content || '';

    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      content = content.slice(firstBrace, lastBrace + 1);
    } else {
      throw new Error('LLM did not return valid JSON');
    }

    const parsed = JSON.parse(content);

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length < 5) {
      return json(
        { error: 'Failed to generate enough questions. Please try again.' },
        { status: 500 }
      );
    }

    const questions = parsed.questions.slice(0, 10);

    return json({
      questions,
      grammarRule: { id: grammarRule.id, title: grammarRule.title, level }
    });
  } catch (error) {
    console.error('Error generating test-out questions:', error);
    return json({ error: 'Failed to generate questions. Please try again.' }, { status: 500 });
  }
}
