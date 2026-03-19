import { env } from '$env/dynamic/private';
import { getLanguageConfig } from '$lib/languages';
import { decrypt } from '$lib/server/crypto';
import { prisma } from '$lib/server/prisma';
import { getSiteSettings } from '$lib/server/settings';
import OpenAI from 'openai';
import { z } from 'zod';

/**
 * Rejects URLs that resolve to private/loopback/link-local ranges to prevent SSRF.
 * Only enforced for user-supplied custom LLM endpoints.
 */
function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid LLM base URL');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block plaintext metadata endpoints, loopback, and link-local
  const blocked = [
    /^localhost$/,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./, // AWS/GCP/Azure metadata
    /^fd[0-9a-f]{2}:/i, // IPv6 ULA
    /^fe80:/i, // IPv6 link-local
    /^0\./
  ];

  if (blocked.some((re) => re.test(hostname))) {
    throw new Error('Custom LLM endpoint must not point to a private or loopback address');
  }

  // Only allow https for user-supplied URLs
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Custom LLM endpoint must use http or https');
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateChatCompletionOptions {
  userId: string;
  messages: ChatMessage[];
  model?: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
  /** When true, appends a native-language proofreader constraint to the system prompt.
   *  Only relevant for lesson generation — not grading or enrichment. Defaults to false. */
  addLanguageConstraint?: boolean;
  /** Called once with total token counts after the completion finishes. Not called for streaming responses — use the stream's final usage chunk instead. */
  onUsage?: (usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }) => void;
  /** Optional Zod schema to validate the JSON response. If validation fails, throws an error. */
  schema?: z.ZodType<any>;
}

/**
 * Calls an OpenAI-compatible /v1/chat/completions endpoint using the OpenAI SDK.
 * Looks up custom base URL and API key from the User record, falling back to env vars.
 */
export async function generateChatCompletion({
  userId,
  messages,
  model,
  systemPrompt,
  jsonMode = false,
  jsonSchema,
  temperature = 0.3,
  stream = false,
  signal,
  addLanguageConstraint = false,
  onUsage,
  schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: GenerateChatCompletionOptions): Promise<any> {
  // 1. Fetch user credentials from database and site settings
  const [user, settings, classStudentCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        useLocalLlm: true,
        llmBaseUrl: true,
        llmApiKey: true,
        llmModel: true,
        activeLanguage: true
      }
    }),
    getSiteSettings(),
    prisma.classMember.count({
      where: { userId, role: 'STUDENT' }
    })
  ]);

  // Students in any class must use the site LLM — never their custom endpoint.
  // This prevents malicious LLMs from grading answers as always correct or awarding points.
  const allowCustomLlm = user?.useLocalLlm && classStudentCount === 0;

  // 2. Resolve Base URL and API Key (User custom OR Site Settings OR fallback to environment variables)
  const usingCustomEndpoint = !!(allowCustomLlm && user?.llmBaseUrl);
  const rawBaseUrl = (
    usingCustomEndpoint ? user!.llmBaseUrl! : settings.llmEndpoint || env.DEFAULT_LLM_BASE_URL || ''
  ).replace(/^["']|["']$/g, '');

  // SSRF guard: reject private/loopback addresses for user-supplied endpoints
  if (usingCustomEndpoint && rawBaseUrl) {
    assertSafeUrl(rawBaseUrl);
  }

  const apiKey = (
    allowCustomLlm && user?.llmApiKey
      ? decrypt(user.llmApiKey)
      : decrypt(settings.llmApiKey || '') || env.DEFAULT_LLM_API_KEY || ''
  ).replace(/^["']|["']$/g, '');
  const resolvedModel = (
    model ||
    (allowCustomLlm && user?.llmModel) ||
    settings.llmModel ||
    env.DEFAULT_LLM_MODEL ||
    'gpt-3.5-turbo'
  ).replace(/^["']|["']$/g, '');

  if (!rawBaseUrl) {
    throw new Error('LLM Base URL is not configured.');
  }

  if (!apiKey) {
    throw new Error('LLM API Key is not configured.');
  }

  let baseUrl = rawBaseUrl.replace(/\/$/, '');
  if (!baseUrl.endsWith('/v1')) {
    if (baseUrl.endsWith('/openai')) {
      // Some endpoints might be /openai
    } else {
      baseUrl += '/v1';
    }
  }

  const openai = new OpenAI({
    baseURL: baseUrl,
    apiKey: apiKey
  });

  // 3. Prepare messages payload
  const payloadMessages = [...messages];
  const languageName = user?.activeLanguage?.name || 'German';

  let constraintPrompt = '';
  if (addLanguageConstraint) {
    constraintPrompt = getLanguageConfig(languageName).llmConstraintPrompt;
  }

  if (systemPrompt) {
    payloadMessages.unshift({
      role: 'system',
      content: constraintPrompt ? `${systemPrompt}\n\n${constraintPrompt}` : systemPrompt
    });
  } else if (constraintPrompt) {
    payloadMessages.unshift({ role: 'system', content: constraintPrompt });
  }

  if (jsonSchema || jsonMode) {
    // OpenAI requires the word "JSON" to be in the prompt when using json_object
    // Even without response_format, we still want to clearly ask for JSON
    const hasJsonPrompt = payloadMessages.some(
      (m) => typeof m.content === 'string' && m.content.toLowerCase().includes('json')
    );

    if (!hasJsonPrompt) {
      if (payloadMessages.length > 0 && payloadMessages[0].role === 'system') {
        payloadMessages[0].content +=
          '\n\nPlease return your response ONLY as valid JSON. Do not include any other text.';
      } else {
        payloadMessages.unshift({
          role: 'system',
          content: 'Please return your response ONLY as valid JSON. Do not include any other text.'
        });
      }
    }
  }

  try {
    const response = await openai.chat.completions.create(
      {
        model: resolvedModel,
        messages: payloadMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature,
        stream: stream as boolean,
        // Request usage data on the final streaming chunk so callers can track tokens
        ...(stream ? { stream_options: { include_usage: true } } : {})
      } as OpenAI.Chat.Completions.ChatCompletionCreateParams,
      { signal }
    );

    if (stream) {
      return response;
    }

    const completion = response as OpenAI.Chat.Completions.ChatCompletion;

    if (onUsage && completion.usage) {
      onUsage({
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      });
    }

    // Extract JSON payload if the model output special tokens or markdown around the JSON block
    if ((jsonMode || jsonSchema) && completion.choices?.[0]?.message?.content) {
      const content = completion.choices[0].message.content;
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      const firstBracket = content.indexOf('[');
      const lastBracket = content.lastIndexOf(']');

      let startIndex = -1;
      let endIndex = -1;

      if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        (firstBracket === -1 || firstBrace < firstBracket)
      ) {
        startIndex = firstBrace;
        endIndex = lastBrace;
      } else if (
        firstBracket !== -1 &&
        lastBracket !== -1 &&
        (firstBrace === -1 || firstBracket < firstBrace)
      ) {
        startIndex = firstBracket;
        endIndex = lastBracket;
      }

      if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        completion.choices[0].message.content = content.substring(startIndex, endIndex + 1);
      }
    }

    if (schema && completion.choices?.[0]?.message?.content) {
      try {
        const parsed = JSON.parse(completion.choices[0].message.content);
        schema.parse(parsed);
      } catch (error) {
        console.error('LLM JSON validation failed:', error);
        throw new Error(
          `LLM response did not match the required schema: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return completion;
  } catch (e) {
    const error = e as Error;
    console.error(`LLM API Error: ${error.message}`, error);
    throw new Error(`LLM API Error: ${error.message}`);
  }
}

/**
 * Checks whether a username is classroom-friendly using the site's global LLM.
 * Does NOT require a userId — uses the site-level LLM config only.
 * Returns { approved: boolean, reason: string }.
 */
export async function checkUsernameAppropriate(
  username: string
): Promise<{ approved: boolean; reason: string; suggestion: string }> {
  const [settings] = await Promise.all([getSiteSettings()]);

  const rawBaseUrl = (settings.llmEndpoint || env.DEFAULT_LLM_BASE_URL || '').replace(
    /^["']|["']$/g,
    ''
  );
  const apiKey = (decrypt(settings.llmApiKey || '') || env.DEFAULT_LLM_API_KEY || '').replace(
    /^["']|["']$/g,
    ''
  );
  const resolvedModel = (settings.llmModel || env.DEFAULT_LLM_MODEL || 'gpt-3.5-turbo').replace(
    /^["']|["']$/g,
    ''
  );

  if (!rawBaseUrl || !apiKey) {
    // If LLM is not configured, allow the username through
    return { approved: true, reason: '', suggestion: '' };
  }

  let baseUrl = rawBaseUrl.replace(/\/$/, '');
  if (!baseUrl.endsWith('/v1') && !baseUrl.endsWith('/openai')) {
    baseUrl += '/v1';
  }

  const openai = new OpenAI({ baseURL: baseUrl, apiKey });

  const systemPrompt = `You are a classroom safety moderator for a language-learning app used by students of all ages.
Your job is to decide if a username is appropriate for a classroom environment.

Rules — reject if the username:
- Contains profanity, slurs, or offensive language (in any language)
- References violence, drugs, sexual content, or hate speech
- Is otherwise clearly inappropriate for a college setting

Allow creative, playful, or fun usernames that are harmless.

If the username is NOT approved, also suggest a fun, classroom-friendly alternative (e.g. "HappyFox42", "BluePenguin7", "StarLearner").

Respond ONLY with valid JSON in this exact format:
{"approved": true} or {"approved": false, "reason": "brief reason", "suggestion": "AlternativeUsername"}`;

  try {
    const response = await openai.chat.completions.create({
      model: resolvedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Username to review: "${username}"` }
      ],
      temperature: 0.1
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    const jsonStr =
      firstBrace !== -1 && lastBrace > firstBrace
        ? content.substring(firstBrace, lastBrace + 1)
        : content;

    const schema = z.object({
      approved: z.boolean(),
      reason: z.string().optional(),
      suggestion: z.string().optional()
    });

    const parsed = JSON.parse(jsonStr);
    const result = schema.parse(parsed);

    return {
      approved: result.approved === true,
      reason: result.reason ?? '',
      suggestion: result.suggestion ?? ''
    };
  } catch (error) {
    console.error('Username check failed:', error);
    // On any failure (LLM down, parse error) allow through — don't block signup
    return { approved: true, reason: '', suggestion: '' };
  }
}

/**
 * Normalizes an array of words to their absolute dictionary form (lemma) based on the user's active language.
 * E.g., infinitives for verbs, nominative singular for nouns, base form for adjectives.
 */
export async function normalizeWords(userId: string, words: string[]): Promise<string[]> {
  if (!words || words.length === 0) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { activeLanguage: true }
  });
  const languageName = user?.activeLanguage?.name || 'German';

  const systemPrompt = `You are an expert ${languageName} linguist. Given a list of ${languageName} words, normalize each one to its absolute dictionary form (lemma).
Rules:
1. Verbs: infinitive (e.g., "gehst" -> "gehen", "gemacht" -> "machen")
2. Nouns: nominative singular (e.g., "Äpfeln" -> "apfel", "Hauses" -> "haus")
3. Adjectives: uninflected base form (e.g., "schnellem" -> "schnell")
4. Output as JSON in this format: { "normalizedWords": ["word1", "word2"] }
5. Ensure the order matches the input exactly. Output in lowercase without articles.`;

  try {
    const response = await generateChatCompletion({
      userId,
      messages: [{ role: 'user', content: JSON.stringify(words) }],
      systemPrompt,
      jsonMode: true,
      schema: z.object({
        normalizedWords: z.array(z.string())
      }),
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.normalizedWords;
  } catch (e) {
    console.error('Failed to normalize words', e);
  }

  return words; // Fallback to original words if anything fails
}
