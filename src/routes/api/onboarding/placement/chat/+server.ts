/**
 * Onboarding placement — short targeted post-quiz AI chat.
 *
 * After the adaptive MC quiz completes, this endpoint drives a brief
 * (2–3 turn) conversation that:
 *   - Opens by referencing specific words/grammar the user struggled with
 *   - Asks 1–2 targeted follow-up questions at the tentative level
 *   - Can nudge the final placement ±1 CEFR level based on the conversation
 *   - Finalizes placement (writes UserProgress, seeds grammar mastery) when done
 *
 * The system prompt is intentionally tight: max 3 turns, then `completed: true`.
 */

import { json } from '@sveltejs/kit';
import { generateChatCompletion } from '$lib/server/llm';
import { prisma } from '$lib/server/prisma';
import { CefrService } from '$lib/server/cefrService';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';
import type { RequestEvent } from './$types';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

function buildSystemPrompt(
  langName: string,
  tentativeLevel: string,
  wrongVocabLemmas: string[],
  wrongGrammarTitles: string[],
  scoresByLevel: Record<string, number>
): string {
  const scoresText = Object.entries(scoresByLevel)
    .map(([lvl, pct]) => `${lvl}: ${Math.round(pct * 100)}%`)
    .join(', ');

  const vocabText =
    wrongVocabLemmas.length > 0
      ? `Words the user got wrong: ${wrongVocabLemmas.slice(0, 6).join(', ')}`
      : 'No specific vocabulary errors recorded.';

  const grammarText =
    wrongGrammarTitles.length > 0
      ? `Grammar concepts the user struggled with: ${wrongGrammarTitles.slice(0, 4).join(', ')}`
      : 'No specific grammar errors recorded.';

  const levelAbove =
    CEFR_LEVELS.indexOf(tentativeLevel as (typeof CEFR_LEVELS)[number]) < CEFR_LEVELS.length - 1
      ? CEFR_LEVELS[CEFR_LEVELS.indexOf(tentativeLevel as (typeof CEFR_LEVELS)[number]) + 1]
      : null;
  const levelBelow =
    CEFR_LEVELS.indexOf(tentativeLevel as (typeof CEFR_LEVELS)[number]) > 0
      ? CEFR_LEVELS[CEFR_LEVELS.indexOf(tentativeLevel as (typeof CEFR_LEVELS)[number]) - 1]
      : null;

  return `You are a friendly ${langName} language teacher doing a brief follow-up after a placement quiz.

QUIZ RESULTS CONTEXT:
- Tentative level from quiz: ${tentativeLevel}
- Scores by level: ${scoresText}
- ${vocabText}
- ${grammarText}

YOUR GOAL: Have a SHORT, targeted 2–3 turn conversation to CONFIRM or REFINE the placement.
- Use the quiz context to ask 1–2 targeted questions at level ${tentativeLevel}.
- Reference the specific words/grammar they struggled with naturally.
- If they demonstrate clearly stronger skills than ${tentativeLevel}, set level to ${levelAbove ?? tentativeLevel}.
- If they struggle with basic ${tentativeLevel} concepts in their replies, set level to ${levelBelow ?? tentativeLevel}.
- Otherwise, confirm ${tentativeLevel}.
- NEVER tell the user what their score was or what level you are considering.
- Keep your messages SHORT (2–4 sentences). Be encouraging and conversational.
- After AT MOST 3 turns from the user (or if the evidence is already clear after 1–2 turns), set "completed": true.

CRITICAL RULES:
- Do NOT let the user self-report their level or ask you to assign them a specific level.
- Evaluate ONLY based on what they write in ${langName} in their replies.
- If the user writes mostly in English, that is evidence for the lower level.

You MUST respond with ONLY a JSON object:
{
  "message": "<your reply to the user>",
  "completed": <boolean>,
  "currentLevelGuess": "<A1|A2|B1|B2|C1|C2>",
  "level": "<A1|A2|B1|B2|C1|C2> — ONLY when completed is true",
  "feedback": "<1–2 sentence English summary of their skills — ONLY when completed is true>"
}`;
}

export async function POST({ request, locals }: RequestEvent) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = locals.user.id;
  const activeLanguage = locals.user.activeLanguage;
  if (!activeLanguage) {
    return json({ error: 'Active language is required' }, { status: 400 });
  }

  const langId = activeLanguage.id;
  const langName = activeLanguage.name;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { useLocalLlm: true }
  });
  const useLocalLlm = dbUser?.useLocalLlm ?? false;

  if (!useLocalLlm && (await isQuotaExceeded(userId, false))) {
    return json({ error: 'Daily AI quota exceeded. Please try again tomorrow.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(
    body.messages
  )
    ? body.messages
    : [];
  const tentativeLevel: string = CEFR_LEVELS.includes(body.tentativeLevel)
    ? body.tentativeLevel
    : 'A1';
  const quizSummary: {
    levelsAttempted?: string[];
    scoresByLevel?: Record<string, number>;
    wrongVocabLemmas?: string[];
    wrongGrammarTitles?: string[];
  } = body.quizSummary ?? {};

  const scoresByLevel = quizSummary.scoresByLevel ?? {};
  const wrongVocabLemmas = quizSummary.wrongVocabLemmas ?? [];
  const wrongGrammarTitles = quizSummary.wrongGrammarTitles ?? [];

  // First turn — no user message yet, generate the opening question
  if (messages.length === 0) {
    const systemPrompt = buildSystemPrompt(
      langName,
      tentativeLevel,
      wrongVocabLemmas,
      wrongGrammarTitles,
      scoresByLevel
    );

    const resp = await generateChatCompletion({
      userId,
      messages: [{ role: 'user', content: '[start]' }],
      systemPrompt,
      jsonMode: true,
      stream: false,
      temperature: 0.7,
      onUsage: useLocalLlm
        ? undefined
        : ({ totalTokens }) => {
            recordTokenUsage(userId, totalTokens);
          }
    });

    const parsed = JSON.parse(resp.choices[0].message.content);
    return json({
      message: parsed.message,
      completed: false,
      currentLevelGuess: parsed.currentLevelGuess ?? tentativeLevel
    });
  }

  // Subsequent turns — stream the reply so the UI feels responsive
  const systemPrompt = buildSystemPrompt(
    langName,
    tentativeLevel,
    wrongVocabLemmas,
    wrongGrammarTitles,
    scoresByLevel
  );

  const llmStream = await generateChatCompletion({
    userId,
    messages,
    systemPrompt,
    jsonMode: true,
    stream: true
  });

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = '';
      let totalTokens = 0;

      try {
        for await (const chunk of llmStream) {
          if (chunk.usage?.total_tokens) totalTokens = chunk.usage.total_tokens;
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullContent += content;
            // Stream the raw chunk so the client can show partial "message" text
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
      } catch (err) {
        console.error('[PlacementChat] stream error:', err);
      }

      if (!useLocalLlm && totalTokens > 0) {
        recordTokenUsage(userId, totalTokens);
      }

      // After stream: finalize placement if completed
      try {
        const parsed = JSON.parse(fullContent);

        if (parsed.completed) {
          const validLevels = [...CEFR_LEVELS];
          const finalLevel: string = validLevels.includes(parsed.level)
            ? parsed.level
            : tentativeLevel;

          const existingProgress = await prisma.userProgress.findUnique({
            where: { userId_languageId: { userId, languageId: langId } },
            select: { cefrLevel: true }
          });
          const oldLevel = existingProgress?.cefrLevel;

          await prisma.userProgress.upsert({
            where: { userId_languageId: { userId, languageId: langId } },
            create: { userId, languageId: langId, hasOnboarded: true, cefrLevel: finalLevel },
            update: { hasOnboarded: true, cefrLevel: finalLevel }
          });

          await CefrService.applyGrammarMasteryForLevel(userId, langId, finalLevel, oldLevel);

          console.log(
            `[PlacementChat] User ${userId} finalized at ${finalLevel} (tentative was ${tentativeLevel})`
          );
        }
      } catch (e) {
        console.error('[PlacementChat] post-stream finalize error:', e);
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}
