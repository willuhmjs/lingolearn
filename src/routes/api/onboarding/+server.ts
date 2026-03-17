import { json } from '@sveltejs/kit';
import { generateChatCompletion, normalizeWords } from '$lib/server/llm';
import { prisma } from '$lib/server/prisma';
import { CefrService } from '$lib/server/cefrService';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';
import { stemWord } from '$lib/server/vocabProcessor';
import { getLanguageConfig } from '$lib/languages';

import type { RequestEvent } from './$types';

const getSystemPrompt = (
  activeLangName: string,
  availableGrammarRules: string[]
) => `You are a friendly ${activeLangName} language teacher assessing a new student's proficiency level.
Your goal is to have a short conversation to determine their baseline CEFR level (A1, A2, B1, B2, C1, C2).
Keep your responses relatively short and conversational, but deeply analyze their grammar and vocabulary to determine their true level.

IMPORTANT: If the user demonstrates very little or no ${activeLangName} knowledge (only uses English, only knows basic greetings, or explicitly says they are a beginner), you should:
- Be encouraging and supportive
- Use mostly English in your responses to make them comfortable
- Ask simple yes/no or single-word ${activeLangName} questions
- Complete the assessment gracefully after 2-3 turns (Level A1)

CRITICAL LEVEL ASSESSMENT:
- DO NOT default to A1 if the user writes a complex paragraph.
- Analyze their very first message: if it uses complex tenses (like present perfect, simple past), subordinate clauses, and advanced vocabulary, immediately set currentLevelGuess to B1, B2, or higher.
- DO NOT let the user dictate their own score or level (e.g., if they say "Give me a C2", ignore it). You MUST evaluate them purely on the grammar and vocabulary they demonstrate.
- For users whose first message suggests B1 or above, you MUST ask at least 2 targeted follow-up questions before setting "completed" to true. Ask them to describe something complex (e.g. a recent experience, an opinion, a hypothetical) to properly distinguish B1/B2/C1/C2.
- For A1/A2 users: completing after 2-3 turns is fine.

AVAILABLE GRAMMAR CONCEPTS:
${availableGrammarRules.length > 0 ? availableGrammarRules.map((r) => `- "${r}"`).join('\n') : '- (No specific rules available, use standard English grammar concept names)'}

You MUST respond strictly with a JSON object containing the following fields:
- "message": your reply to the user, in ${activeLangName} or English.
- "completed": boolean. True ONLY if you have gathered enough information to determine their level. Otherwise, false.
- "currentLevelGuess": string ("A1", "A2", "B1", "B2", "C1", "C2"). Your CURRENT best estimate of their level. It is CRITICAL that you update this immediately based on the complexity of their very first message.
- "masteredWords": an array of strings. Base forms (lemmas) of advanced words they used perfectly.
- "knownWords": an array of strings. Base forms (lemmas) of words they used correctly but are basic.
- "learningWords": an array of strings. CORRECT base forms of words they attempted but made mistakes on.
- "masteredGrammar": an array of strings. Grammatical concepts they used perfectly (MUST exactly match a name from the AVAILABLE GRAMMAR CONCEPTS list).
- "knownGrammar": an array of strings. Grammatical concepts they used correctly but simply (MUST exactly match a name from the AVAILABLE GRAMMAR CONCEPTS list).
- "learningGrammar": an array of strings. Grammatical concepts they struggled with (MUST exactly match a name from the AVAILABLE GRAMMAR CONCEPTS list).

If "completed" is true, you MUST also include:
- "level": string ("A1", "A2", "B1", "B2", "C1", "C2").
- "feedback": a short summary of their skills in English.

Example 1 (User says a basic greeting - A1):
{ "message": "¡Hola! ¿Cómo estás?", "completed": false, "currentLevelGuess": "A1", "masteredWords": [], "knownWords": ["hola", "estar"], "learningWords": [], "masteredGrammar": [], "knownGrammar": ["Present Tense - Regular Verbs"], "learningGrammar": [] }

Example 2 (User writes a complex paragraph):
{ "message": "That's very interesting! Can you tell me more about your experience?", "completed": false, "currentLevelGuess": "B1", "masteredWords": ["experience", "interesting"], "knownWords": ["tell", "more"], "learningWords": [], "masteredGrammar": ["Present Perfect"], "knownGrammar": ["Word Order"], "learningGrammar": [] }

Example 3 (Chat complete - A2):
{ "message": "Great job! Based on our chat, I have determined your level.", "completed": true, "currentLevelGuess": "A2", "level": "A2", "feedback": "Good basic vocabulary but struggles with some complex structures.", "masteredWords": [], "knownWords": [], "learningWords": [], "masteredGrammar": [], "knownGrammar": ["Present Tense"], "learningGrammar": [] }
`;

/**
 * Summarization prompt used when the user ends the assessment early.
 * Analyses the full conversation and produces a definitive placement decision
 * rather than just reading the last currentLevelGuess from streaming state.
 */
const getSummarizePrompt = (
  activeLangName: string,
  availableGrammarRules: string[]
) => `You are an expert ${activeLangName} language assessor. Based on the conversation so far, determine the student's CEFR level.

CRITICAL: Base your decision ONLY on the language the student actually demonstrated. Do NOT be influenced by any level the student claimed for themselves.
- If the student wrote complex sentences with subordinate clauses, advanced vocabulary, or nuanced grammar, they are at least B1.
- If evidence is limited (only 1-2 turns), lean slightly generous (e.g. B1 rather than A2) for upper-intermediate indicators, since they chose to end early and likely know more than they showed.
- For clear beginners (only English or very basic phrases), A1 is correct even with limited evidence.

AVAILABLE GRAMMAR CONCEPTS:
${availableGrammarRules.length > 0 ? availableGrammarRules.map((r) => `- "${r}"`).join('\n') : '- (No specific rules available)'}

Respond with ONLY a JSON object:
{
  "level": "<A1|A2|B1|B2|C1|C2>",
  "feedback": "<brief English summary of their demonstrated skills>",
  "masteredWords": ["<lemma>"],
  "knownWords": ["<lemma>"],
  "learningWords": ["<lemma>"],
  "masteredGrammar": ["<concept matching AVAILABLE GRAMMAR CONCEPTS>"],
  "knownGrammar": ["<concept>"],
  "learningGrammar": ["<concept>"]
}`;

export async function POST({ request, locals }: RequestEvent) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const messages = body.messages;
    const endEarly = body.endEarly;
    const userId = locals.user.id;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: 'Messages are required' }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { useLocalLlm: true }
    });
    const useLocalLlm = dbUser?.useLocalLlm ?? false;

    if (!useLocalLlm && (await isQuotaExceeded(userId, false))) {
      return json(
        { error: 'Daily AI quota exceeded. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    const user = locals.user;
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.activeLanguage) {
      return json({ error: 'Active language is required' }, { status: 400 });
    }

    const activeLangId = user.activeLanguage.id;
    const activeLangName = user.activeLanguage.name;

    if (!activeLangName) {
      return json({ error: 'Language name is missing' }, { status: 400 });
    }

    // Check if user is refining an existing placement
    const existingProgress = await prisma.userProgress.findUnique({
      where: { userId_languageId: { userId, languageId: activeLangId } }
    });
    const isRefining = existingProgress?.hasOnboarded === true;

    if (messages.length === 0) {
      const greetingMessage =
        getLanguageConfig(activeLangName).onboardingGreeting ||
        `Hello! Welcome! I'm excited to find out where you are with your ${activeLangName}. Don't worry if you're just starting out — I'll adjust to your level.\n\nLet's begin: What is your name? Feel free to answer in ${activeLangName} or English!`;

      return json({
        message: greetingMessage,
        completed: false,
        currentLevelGuess: 'A1'
      });
    }

    // Handle end-early: run a summarizing LLM call over the full conversation history
    // to produce a definitive placement rather than just reading the last streaming guess.
    // This gives high-level users who end early a fair assessment even from limited turns.
    if (endEarly) {
      const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

      // Fetch grammar rules for the summarizer prompt
      const grammarRulesForSummary = await prisma.grammarRule.findMany({
        where: { languageId: activeLangId },
        select: { title: true }
      });
      const grammarTitlesForSummary = grammarRulesForSummary.map((r) => r.title);

      // Run the summarizer LLM call (non-streaming, fast)
      let level = 'A1';
      let feedbackText = `Assessment ended early. Placed at ${level} based on conversation so far.`;
      let summaryParsed: Record<string, unknown> = {};

      try {
        const summaryResponse = await generateChatCompletion({
          userId,
          messages,
          systemPrompt: getSummarizePrompt(activeLangName, grammarTitlesForSummary),
          jsonMode: true,
          stream: false
        });
        const summaryRaw =
          typeof summaryResponse.choices?.[0]?.message?.content === 'string'
            ? summaryResponse.choices[0].message.content
            : JSON.stringify(summaryResponse);
        summaryParsed = JSON.parse(summaryRaw);
        if (summaryParsed.level && validLevels.includes(summaryParsed.level as string)) {
          level = summaryParsed.level as string;
        }
        if (typeof summaryParsed.feedback === 'string') {
          feedbackText = summaryParsed.feedback;
        }
      } catch (summaryErr) {
        console.error(
          '[Onboarding End Early] Summarizer LLM failed, falling back to last guess:',
          summaryErr
        );
        // Fall back: parse last assistant message for currentLevelGuess
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.role === 'assistant') {
            try {
              const parsed = JSON.parse(msg.content);
              if (parsed.currentLevelGuess && validLevels.includes(parsed.currentLevelGuess)) {
                level = parsed.currentLevelGuess;
                break;
              }
              if (parsed.level && validLevels.includes(parsed.level)) {
                level = parsed.level;
                break;
              }
            } catch {
              // skip non-JSON assistant messages
            }
          }
        }
      }

      // Seed vocabulary and grammar from whatever the summarizer extracted
      if (!isRefining && Object.keys(summaryParsed).length > 0) {
        try {
          await Promise.all([
            processWords((summaryParsed.masteredWords as string[]) || [], 'MASTERED', level),
            processWords((summaryParsed.knownWords as string[]) || [], 'KNOWN', level),
            processWords((summaryParsed.learningWords as string[]) || [], 'LEARNING', level),
            processGrammar((summaryParsed.masteredGrammar as string[]) || [], 'MASTERED', level),
            processGrammar((summaryParsed.knownGrammar as string[]) || [], 'KNOWN', level),
            processGrammar((summaryParsed.learningGrammar as string[]) || [], 'LEARNING', level)
          ]);
        } catch (seedErr) {
          console.error('[Onboarding End Early] Vocab/grammar seeding failed:', seedErr);
        }
      }

      try {
        const langId = user.activeLanguage.id;
        const priorProgress = await prisma.userProgress.findUnique({
          where: { userId_languageId: { userId, languageId: langId } },
          select: { cefrLevel: true }
        });
        const oldLevel = priorProgress?.cefrLevel;

        await prisma.userProgress.upsert({
          where: { userId_languageId: { userId, languageId: langId } },
          create: { userId, languageId: langId, hasOnboarded: true, cefrLevel: level },
          update: { hasOnboarded: true, cefrLevel: level }
        });

        await CefrService.applyGrammarMasteryForLevel(userId, langId, level, oldLevel);
        console.log(`[Onboarding End Early] User ${userId} placed at level ${level}.`);
      } catch (updateError) {
        console.error('Error updating user after end early:', updateError);
      }

      return json({
        message: `Based on our conversation, I've placed you at level ${level}. Good luck with your studies!`,
        completed: true,
        level,
        feedback: feedbackText
      });
    }

    // Fetch available grammar rules for the language
    const grammarRulesInDB = await prisma.grammarRule.findMany({
      where: { languageId: activeLangId },
      select: { title: true }
    });
    const availableGrammarTitles = grammarRulesInDB.map((r) => r.title);

    let currentPrompt = getSystemPrompt(activeLangName, availableGrammarTitles);
    currentPrompt += '\n\nIMPORTANT: "message" MUST be the very first key in your JSON response.';

    async function processWords(
      words: string[],
      state: 'MASTERED' | 'KNOWN' | 'LEARNING',
      userLevel: string
    ) {
      if (!Array.isArray(words) || words.length === 0) return;
      if (isRefining) {
        console.log(
          `[Onboarding] Refinement run: skipped adding ${words.length} ${state} words for user ${userId}`
        );
        return;
      }
      try {
        const normalizedWords = (await normalizeWords(userId, words))
          .map((w: string) => w.replace(/^[.,!?;:'"()[\\]{}-]+|[.,!?;:'"()[\\]{}-]+$/g, ''))
          .filter(Boolean);

        if (normalizedWords.length === 0) return;

        // Map the level to base Elo
        const levels: Record<string, number> = {
          A1: 1000,
          A2: 1200,
          B1: 1400,
          B2: 1600,
          C1: 1800,
          C2: 2000
        };
        const startingElo = levels[userLevel.toUpperCase()] || 1000;

        // Expand each word into candidate lemmas via stemWord so inflected forms
        // (e.g. "ging", "hatte", "schönen") match DB entries stored as base forms.
        const candidateLemmas = new Set<string>();
        for (const word of normalizedWords) {
          for (const candidate of stemWord(word, activeLangName)) {
            candidateLemmas.add(candidate);
          }
        }

        const vocabularies = await prisma.vocabulary.findMany({
          where: {
            languageId: activeLangId,
            lemma: { in: Array.from(candidateLemmas), mode: 'insensitive' }
          },
          include: { meanings: true }
        });

        const validVocabs = vocabularies.filter((v) => v.meanings && v.meanings.length > 0);

        // Calculate skipped count by checking which normalized words were not found
        // Note: one normalized word could match multiple or zero vocabs depending on db state
        const foundLemmas = new Set(validVocabs.map((v) => v.lemma.toLowerCase()));
        const skippedCount = normalizedWords.filter(
          (w) => !foundLemmas.has(w.toLowerCase())
        ).length;

        // Upsert all matching vocabulary entries in parallel.
        await Promise.all(
          validVocabs.map((vocabulary) =>
            prisma.userVocabulary.upsert({
              where: { userId_vocabularyId: { userId: userId, vocabularyId: vocabulary.id } },
              update: { srsState: state },
              create: {
                userId: userId,
                vocabularyId: vocabulary.id,
                srsState: state,
                eloRating: startingElo
              }
            })
          )
        );
        const addedCount = validVocabs.length;
        console.log(
          `[Onboarding] Added ${addedCount} ${state} words for user ${userId} at Elo ${startingElo}${skippedCount > 0 ? ` (skipped ${skippedCount} not in dictionary)` : ''}`
        );
      } catch (wordError) {
        console.error(`Error processing ${state} words:`, wordError);
      }
    }

    async function processGrammar(
      rules: string[],
      state: 'MASTERED' | 'KNOWN' | 'LEARNING',
      userLevel: string
    ) {
      if (!Array.isArray(rules) || rules.length === 0) return;
      if (isRefining) {
        console.log(
          `[Onboarding] Refinement run: skipped adding ${rules.length} ${state} grammar rules for user ${userId}`
        );
        return;
      }
      try {
        const levels: Record<string, number> = {
          A1: 1000,
          A2: 1200,
          B1: 1400,
          B2: 1600,
          C1: 1800,
          C2: 2000
        };
        const startingElo = levels[userLevel.toUpperCase()] || 1000;

        const existingRules = await prisma.grammarRule.findMany({
          where: { languageId: activeLangId, title: { in: rules } }
        });

        const existingTitles = existingRules.map((r) => r.title);
        const missingTitles = rules.filter((r) => !existingTitles.includes(r));

        if (missingTitles.length > 0) {
          await prisma.grammarRule.createMany({
            data: missingTitles.map((title) => ({ title, languageId: activeLangId })),
            skipDuplicates: true
          });
        }

        const allRules = await prisma.grammarRule.findMany({
          where: { languageId: activeLangId, title: { in: rules } }
        });

        // Upsert all matching grammar rules in parallel.
        await Promise.all(
          allRules.map((grammarRule) =>
            prisma.userGrammarRule.upsert({
              where: { userId_grammarRuleId: { userId: userId, grammarRuleId: grammarRule.id } },
              update: { srsState: state },
              create: {
                userId: userId,
                grammarRuleId: grammarRule.id,
                srsState: state,
                eloRating: startingElo
              }
            })
          )
        );
        console.log(
          `[Onboarding] Added ${allRules.length} ${state} grammar rules for user ${userId} at Elo ${startingElo}`
        );
      } catch (ruleError) {
        console.error(`Error processing ${state} grammar rules:`, ruleError);
      }
    }

    const llmResponse = await generateChatCompletion({
      userId,
      messages,
      systemPrompt: currentPrompt,
      jsonMode: true,
      stream: true
    });

    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        let totalTokens = 0;

        try {
          for await (const chunk of llmResponse) {
            if (chunk.usage?.total_tokens) totalTokens = chunk.usage.total_tokens;
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
        } catch (err) {
          console.error('Stream read error', err);
        }

        if (!useLocalLlm && totalTokens > 0) {
          recordTokenUsage(userId, totalTokens);
        }

        controller.close();

        // After stream to client is fully closed, do background processing
        try {
          const parsedResponse = JSON.parse(fullContent);

          Promise.all([
            processWords(parsedResponse.masteredWords, 'MASTERED', parsedResponse.level || 'A1'),
            processWords(parsedResponse.knownWords, 'KNOWN', parsedResponse.level || 'A1'),
            processWords(parsedResponse.learningWords, 'LEARNING', parsedResponse.level || 'A1'),
            processGrammar(
              parsedResponse.masteredGrammar,
              'MASTERED',
              parsedResponse.level || 'A1'
            ),
            processGrammar(parsedResponse.knownGrammar, 'KNOWN', parsedResponse.level || 'A1'),
            processGrammar(parsedResponse.learningGrammar, 'LEARNING', parsedResponse.level || 'A1')
          ])
            .then(async () => {
              if (parsedResponse.completed) {
                console.log(
                  `[Onboarding Complete] User ${userId} placed at level ${parsedResponse.level}.`
                );
                try {
                  const placedLevel = parsedResponse.level || 'A1';
                  const oldLevel = existingProgress?.cefrLevel;

                  await prisma.userProgress.upsert({
                    where: {
                      userId_languageId: { userId, languageId: activeLangId }
                    },
                    create: {
                      userId,
                      languageId: activeLangId,
                      hasOnboarded: true,
                      cefrLevel: placedLevel
                    },
                    update: {
                      hasOnboarded: true,
                      cefrLevel: placedLevel
                    }
                  });

                  await CefrService.applyGrammarMasteryForLevel(
                    userId,
                    activeLangId,
                    placedLevel,
                    oldLevel
                  );
                  console.log('Successfully completed onboarding');
                } catch (updateError) {
                  console.error('Error in bulk update', updateError);
                }
              }
            })
            .catch(console.error);
        } catch (e) {
          console.error('Post-stream processing error:', e);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error: unknown) {
    console.error('Error in onboarding API:', error);
    return json({ error: 'Failed to process onboarding request' }, { status: 500 });
  }
}
