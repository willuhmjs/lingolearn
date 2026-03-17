/**
 * Onboarding placement quiz — generate a round for a given CEFR level.
 *
 * Returns:
 *   - 4 vocabulary MC questions (word → pick the correct English meaning)
 *   - 2 grammar MC questions (pick the correct target-language form)
 *   - 1 short immersion passage with 3 comprehension MC questions
 *
 * The user must not be allowed to hover for definitions during this quiz —
 * that is enforced on the client side (disableHoverTranslation).
 *
 * Adaptive algorithm:
 *   score ≥ 75 %  → caller should advance to next level
 *   score 50–74 % → place at this level
 *   score < 50 %  → place at previous level (or A1)
 */

import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { generateChatCompletion } from '$lib/server/llm';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';
import type { RequestEvent } from './$types';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Pick `n` random items from an array without repetition. */
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// ── Immersion media types ──────────────────────────────────────────────────────
// Each type produces structured templateData so the UI can render it richly.
// The LLM writes the content entirely in the target language; questions are in English.

type PlacementMediaType = (typeof PLACEMENT_MEDIA_TYPES)[number];

const PLACEMENT_MEDIA_TYPES = [
  'news_article',
  'advertisement',
  'restaurant_menu',
  'social_post',
  'recipe',
  'review',
  'letter',
  'email',
  'text_messages',
  'train_announcement',
  'weather_forecast',
  'job_listing',
  'event_flyer',
  'diary_entry'
] as const;

const MEDIA_TYPE_INFO: Record<
  PlacementMediaType,
  { label: string; icon: string; description: string; templateSchema: string }
> = {
  news_article: {
    label: 'News Article',
    icon: '📰',
    description: 'A newspaper or online news article with headline, byline, and body text.',
    templateSchema: `{
  "source": "<newspaper name>",
  "date": "<formatted date in target language>",
  "headline": "<compelling news headline>",
  "byline": "<e.g. Von Maria Schmidt>",
  "body": "<2-3 paragraphs of article body>"
}`
  },
  advertisement: {
    label: 'Advertisement',
    icon: '📢',
    description: 'A print or digital advertisement for a product or service.',
    templateSchema: `{
  "brand": "<brand or company name>",
  "product": "<product or service name>",
  "slogan": "<catchy advertising slogan>",
  "features": ["<feature 1>", "<feature 2>", "<feature 3>"],
  "callToAction": "<e.g. Jetzt kaufen!>",
  "price": "<price string, e.g. Nur 29,99 EUR>"
}`
  },
  restaurant_menu: {
    label: 'Restaurant Menu',
    icon: '🍽️',
    description: 'A restaurant menu with sections and dishes.',
    templateSchema: `{
  "restaurantName": "<restaurant name>",
  "tagline": "<short description>",
  "sections": [
    {
      "name": "<section name, e.g. Vorspeisen>",
      "items": [
        { "name": "<dish name>", "description": "<1 sentence description>", "price": "<e.g. 8,50 EUR>" }
      ]
    }
  ]
}`
  },
  social_post: {
    label: 'Social Post',
    icon: '💬',
    description: 'A social media post (Instagram/Twitter style).',
    templateSchema: `{
  "username": "<display name>",
  "handle": "<@handle>",
  "content": "<the post text>",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "likes": "<number as string>",
  "timestamp": "<relative time in target language, e.g. vor 3 Stunden>"
}`
  },
  recipe: {
    label: 'Recipe',
    icon: '👨‍🍳',
    description: 'A cooking recipe with ingredients and steps.',
    templateSchema: `{
  "title": "<recipe name>",
  "servings": "<number>",
  "prepTime": "<e.g. 15 Min.>",
  "ingredients": ["<ingredient 1 with quantity>", "<ingredient 2>"],
  "steps": ["<step 1>", "<step 2>", "<step 3>"]
}`
  },
  review: {
    label: 'Review',
    icon: '⭐',
    description: 'A written review of a product, restaurant, book, or film.',
    templateSchema: `{
  "subject": "<what is being reviewed>",
  "rating": <integer 1-5>,
  "author": "<reviewer name>",
  "body": "<2 paragraph review text>",
  "verdict": "<one-sentence summary verdict>"
}`
  },
  letter: {
    label: 'Letter',
    icon: '✉️',
    description: 'A personal or formal letter.',
    templateSchema: `{
  "location": "<city name>",
  "date": "<formatted date in target language>",
  "salutation": "<e.g. Liebe Maria,>",
  "body": "<letter body, 2 paragraphs>",
  "closing": "<e.g. Mit freundlichen Grüßen,>",
  "signature": "<sender name>"
}`
  },
  email: {
    label: 'Email',
    icon: '📧',
    description: 'A work or personal email with subject line.',
    templateSchema: `{
  "from": "<sender name and email>",
  "to": "<recipient name and email>",
  "subject": "<email subject line>",
  "body": "<email body, 2-3 short paragraphs>",
  "signature": "<sender sign-off and name>"
}`
  },
  text_messages: {
    label: 'Text Messages',
    icon: '📱',
    description: 'A short text message conversation between two people.',
    templateSchema: `{
  "participants": ["<name 1>", "<name 2>"],
  "messages": [
    { "sender": "<name>", "text": "<message text>", "time": "<e.g. 14:30>" },
    { "sender": "<name>", "text": "<message text>", "time": "<e.g. 14:32>" },
    { "sender": "<name>", "text": "<message text>", "time": "<e.g. 14:33>" },
    { "sender": "<name>", "text": "<message text>", "time": "<e.g. 14:35>" },
    { "sender": "<name>", "text": "<message text>", "time": "<e.g. 14:36>" }
  ]
}`
  },
  train_announcement: {
    label: 'Train Announcement',
    icon: '🚆',
    description: 'A public transport announcement or departure board.',
    templateSchema: `{
  "station": "<station name>",
  "announcements": [
    { "line": "<train line or number>", "destination": "<destination city>", "platform": "<platform number>", "departure": "<time>", "status": "<on time / delayed / cancelled>" }
  ],
  "spokenAnnouncement": "<a spoken announcement text as heard over loudspeakers, 2-3 sentences>"
}`
  },
  weather_forecast: {
    label: 'Weather Forecast',
    icon: '🌤️',
    description: 'A weather forecast for a city or region.',
    templateSchema: `{
  "location": "<city or region>",
  "date": "<formatted date in target language>",
  "summary": "<1 sentence weather summary>",
  "details": "<2-3 sentence detailed forecast>",
  "high": "<high temperature>",
  "low": "<low temperature>",
  "conditions": "<e.g. sunny, rainy, cloudy>"
}`
  },
  job_listing: {
    label: 'Job Listing',
    icon: '💼',
    description: 'A job advertisement or posting.',
    templateSchema: `{
  "company": "<company name>",
  "position": "<job title>",
  "location": "<city>",
  "type": "<full-time / part-time / remote>",
  "description": "<2-3 sentence job description>",
  "requirements": ["<requirement 1>", "<requirement 2>", "<requirement 3>"],
  "contact": "<application email or instructions>"
}`
  },
  event_flyer: {
    label: 'Event Flyer',
    icon: '🎉',
    description: 'A flyer or poster for an event, concert, or festival.',
    templateSchema: `{
  "eventName": "<event name>",
  "type": "<concert / festival / exhibition / market / etc.>",
  "date": "<formatted date>",
  "time": "<formatted time>",
  "location": "<venue and city>",
  "description": "<2-3 sentence event description>",
  "price": "<ticket price or 'Free entry'>",
  "extras": "<any additional info, e.g. food, dress code>"
}`
  },
  diary_entry: {
    label: 'Diary Entry',
    icon: '📓',
    description: "A personal diary or journal entry about someone's day.",
    templateSchema: `{
  "date": "<formatted date in target language>",
  "mood": "<one word mood in target language>",
  "entry": "<3-5 sentence diary entry about the day's events, feelings, and plans>"
}`
  }
};

// Which media types are appropriate at each CEFR level.
// Lower levels get simpler, shorter formats. Higher levels get everything.
const MEDIA_TYPES_BY_LEVEL: Record<string, PlacementMediaType[]> = {
  A1: [
    'restaurant_menu',
    'advertisement',
    'weather_forecast',
    'text_messages',
    'event_flyer',
    'diary_entry'
  ],
  A2: [
    'restaurant_menu',
    'advertisement',
    'social_post',
    'text_messages',
    'weather_forecast',
    'event_flyer',
    'train_announcement',
    'diary_entry',
    'recipe'
  ],
  B1: [
    'news_article',
    'email',
    'review',
    'social_post',
    'recipe',
    'letter',
    'job_listing',
    'train_announcement',
    'diary_entry',
    'text_messages'
  ],
  B2: [
    'news_article',
    'email',
    'review',
    'letter',
    'job_listing',
    'recipe',
    'social_post',
    'diary_entry',
    'advertisement'
  ],
  C1: ['news_article', 'letter', 'review', 'job_listing', 'email', 'diary_entry', 'social_post'],
  C2: ['news_article', 'letter', 'review', 'job_listing', 'email', 'diary_entry', 'social_post']
};

function buildImmersionPrompt(
  level: string,
  langName: string,
  mediaType: PlacementMediaType
): string {
  const info = MEDIA_TYPE_INFO[mediaType];
  const complexity =
    level === 'A1'
      ? 'Very simple, short sentences. Present tense. Basic everyday vocabulary only.'
      : level === 'A2'
        ? 'Simple sentences. Common vocabulary. Present and simple past tense.'
        : level === 'B1'
          ? 'Moderately complex sentences. Everyday vocabulary. Mix of tenses.'
          : level === 'B2'
            ? 'Complex sentences. Wider vocabulary range. Natural tense variety.'
            : 'Sophisticated, near-native prose with advanced structures.';

  return `You are a language learning content generator.

Generate an authentic, realistic ${info.description.toLowerCase()} written entirely in ${langName}, appropriate for a ${level} language learner.

Complexity guidelines for ${level}: ${complexity}

Make the content feel authentic — like something that would actually appear in the real world. Choose a realistic topic relevant to everyday life, culture, or current events.

Then create EXACTLY 3 multiple-choice comprehension questions in English about the content.
Each question must have exactly 4 options (A, B, C, D) and one correct answer.
Mix question types: at least one about the main idea, one about specific details, and one about vocabulary in context.

Respond with ONLY valid JSON in this exact shape:
{
  "templateData": ${info.templateSchema},
  "questions": [
    {
      "question": "<comprehension or vocabulary-in-context question in English>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correctIndex": <0-3>,
      "explanation": "<why this answer is correct>"
    }
  ]
}

Output ONLY valid JSON. No markdown, no extra text.`;
}

function buildGrammarQuestionPrompt(
  rule: { title: string; description: string | null; level: string },
  langName: string
): string {
  return `You are a ${langName} grammar question writer for CEFR level ${rule.level}.

Grammar rule: "${rule.title}"
${rule.description ? `Description: ${rule.description}` : ''}

Write ONE multiple-choice question that tests this grammar concept.
- Present a sentence with a blank or ask which form is correct.
- Write in English for the question stem, use ${langName} for the answer options.
- Provide exactly 4 options; only one is correct.
- Make the distractors plausible (common mistakes learners make).

Respond with ONLY valid JSON:
{
  "question": "<question stem>",
  "options": ["<A>", "<B>", "<C>", "<D>"],
  "correctIndex": <0-3>,
  "explanation": "<brief English explanation>"
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

  const body = await request.json().catch(() => ({}));
  const level: string = CEFR_LEVELS.includes(body.level) ? body.level : 'A1';

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { useLocalLlm: true }
  });
  const useLocalLlm = dbUser?.useLocalLlm ?? false;

  if (!useLocalLlm && (await isQuotaExceeded(userId, false))) {
    return json({ error: 'Daily AI quota exceeded. Please try again tomorrow.' }, { status: 429 });
  }

  const langId = activeLanguage.id;
  const langName = activeLanguage.name;

  // ── 1. Pull vocabulary for this level ──────────────────────────────────────
  // We need vocab with at least one meaning so we can build MC options.
  const allVocabAtLevel = await prisma.vocabulary.findMany({
    where: { languageId: langId, cefrLevel: level },
    include: { meanings: { take: 1 } },
    orderBy: { frequency: 'asc' } // most frequent first → better signal
  });
  const vocabWithMeaning = allVocabAtLevel.filter((v) => v.meanings.length > 0);

  // We pick 4 target words + 8 distractor words (for wrong options).
  const targetVocab = sample(vocabWithMeaning, Math.min(4, vocabWithMeaning.length));
  const distractorPool = vocabWithMeaning
    .filter((v) => !targetVocab.find((t) => t.id === v.id))
    .slice(0, 20);

  // Build vocab MC questions entirely from DB — no LLM needed.
  const vocabQuestions = targetVocab.map((vocab) => {
    const correctMeaning = vocab.meanings[0].value;
    // Pick 3 wrong meanings from distractors
    const distractors = sample(distractorPool, 3).map((d) => d.meanings[0].value);
    const options = [...distractors, correctMeaning];
    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    const correctIndex = options.indexOf(correctMeaning);
    return {
      type: 'vocab_mc' as const,
      vocabId: vocab.id,
      lemma: vocab.lemma,
      question: `What does "${vocab.lemma}" mean?`,
      options,
      correctIndex
    };
  });

  // ── 2. Grammar MC questions via LLM ────────────────────────────────────────
  const grammarRulesAtLevel = await prisma.grammarRule.findMany({
    where: { languageId: langId, level },
    select: { id: true, title: true, description: true, level: true }
  });
  const selectedGrammar = sample(grammarRulesAtLevel, Math.min(2, grammarRulesAtLevel.length));

  const grammarQuestions = await Promise.all(
    selectedGrammar.map(async (rule) => {
      try {
        const resp = await generateChatCompletion({
          userId,
          messages: [
            {
              role: 'user',
              content: `Write a ${langName} grammar question for the rule: "${rule.title}"`
            }
          ],
          systemPrompt: buildGrammarQuestionPrompt(rule, langName),
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
        return {
          type: 'grammar_mc' as const,
          grammarRuleId: rule.id,
          grammarRuleTitle: rule.title,
          question: parsed.question as string,
          options: parsed.options as string[],
          correctIndex: parsed.correctIndex as number,
          explanation: parsed.explanation as string
        };
      } catch (e) {
        console.error('[Placement] Grammar question generation failed for rule:', rule.title, e);
        return null;
      }
    })
  );

  const validGrammarQuestions = grammarQuestions.filter(
    (q): q is NonNullable<typeof q> => q !== null
  );

  // ── 3. Immersion content + comprehension MC ─────────────────────────────────
  // Pick a random media type appropriate for this level
  const availableTypes = MEDIA_TYPES_BY_LEVEL[level] ?? PLACEMENT_MEDIA_TYPES;
  const chosenMediaType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  const mediaInfo = MEDIA_TYPE_INFO[chosenMediaType];

  let immersionData: {
    mediaType: PlacementMediaType;
    label: string;
    icon: string;
    templateData: Record<string, unknown>;
  } | null = null;
  let comprehensionQuestions: Array<{
    type: 'comprehension_mc';
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }> = [];

  try {
    const resp = await generateChatCompletion({
      userId,
      messages: [
        {
          role: 'user',
          content: `Generate a ${mediaInfo.label.toLowerCase()} in ${langName} for a ${level} learner with 3 comprehension questions.`
        }
      ],
      systemPrompt: buildImmersionPrompt(level, langName, chosenMediaType),
      jsonMode: true,
      stream: false,
      temperature: 0.85,
      onUsage: useLocalLlm
        ? undefined
        : ({ totalTokens }) => {
            recordTokenUsage(userId, totalTokens);
          }
    });
    const parsed = JSON.parse(resp.choices[0].message.content);
    immersionData = {
      mediaType: chosenMediaType,
      label: mediaInfo.label,
      icon: mediaInfo.icon,
      templateData: parsed.templateData ?? {}
    };
    comprehensionQuestions = (parsed.questions ?? []).map((q: Record<string, unknown>) => ({
      type: 'comprehension_mc' as const,
      question: q.question as string,
      options: q.options as string[],
      correctIndex: q.correctIndex as number,
      explanation: q.explanation as string
    }));
  } catch (e) {
    console.error('[Placement] Immersion content generation failed:', e);
  }

  // ── 4. Collect the vocab IDs that appear in this round for SRS seeding ──────
  const roundVocabIds = targetVocab.map((v) => v.id);

  return json({
    level,
    langName,
    vocabQuestions,
    grammarQuestions: validGrammarQuestions,
    immersionData,
    comprehensionQuestions,
    roundVocabIds,
    // Total questions in this round (for client-side scoring)
    totalQuestions:
      vocabQuestions.length + validGrammarQuestions.length + comprehensionQuestions.length
  });
}
