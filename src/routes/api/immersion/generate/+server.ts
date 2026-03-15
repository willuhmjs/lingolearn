import { json } from '@sveltejs/kit';
import { generateChatCompletion } from '$lib/server/llm';
import { generateLessonRateLimiter } from '$lib/server/ratelimit';
import { prisma } from '$lib/server/prisma';
import { isQuotaExceeded, recordTokenUsage } from '$lib/server/aiQuota';

const MEDIA_TYPES = [
	'news_article',
	'advertisement',
	'restaurant_menu',
	'social_post',
	'recipe',
	'review',
	'letter'
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

const MEDIA_TYPE_SCHEMAS: Record<
	MediaType,
	{ description: string; templateDataSchema: string }
> = {
	news_article: {
		description: 'A newspaper or online news article with headline, byline, and body text.',
		templateDataSchema: `{
  "source": "<newspaper name, e.g. Berliner Tageszeitung>",
  "date": "<formatted date in target language, e.g. 11. März 2026>",
  "headline": "<compelling news headline>",
  "byline": "<e.g. Von Maria Schmidt>",
  "lead": "<first paragraph summarizing the story (2-3 sentences)>",
  "body": "<2-3 more paragraphs of article body>"
}`
	},
	advertisement: {
		description:
			'A print or digital advertisement for a product or service.',
		templateDataSchema: `{
  "brand": "<brand or company name>",
  "product": "<product or service name>",
  "slogan": "<catchy advertising slogan>",
  "features": ["<feature 1>", "<feature 2>", "<feature 3>"],
  "callToAction": "<e.g. Jetzt kaufen! or Besuchen Sie uns!>",
  "price": "<price string, e.g. Nur €29,99! — optional>",
  "disclaimer": "<small print disclaimer — optional, can be empty string>"
}`
	},
	restaurant_menu: {
		description: 'A restaurant menu with sections and dishes.',
		templateDataSchema: `{
  "restaurantName": "<restaurant name>",
  "tagline": "<short restaurant tagline or description>",
  "sections": [
    {
      "name": "<section name, e.g. Vorspeisen>",
      "items": [
        { "name": "<dish name>", "description": "<1-2 sentence description>", "price": "<e.g. 8,50 €>" }
      ]
    }
  ]
}`
	},
	social_post: {
		description: 'A social media post (Instagram/Twitter style).',
		templateDataSchema: `{
  "username": "<display name>",
  "handle": "<@handle>",
  "content": "<the post text, can include line breaks>",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "likes": "<number as string, e.g. 1.234>",
  "comments": "<number as string, e.g. 47>",
  "timestamp": "<relative time in target language, e.g. vor 3 Stunden>"
}`
	},
	recipe: {
		description: 'A cooking recipe with ingredients and steps.',
		templateDataSchema: `{
  "title": "<recipe name>",
  "servings": "<number, e.g. 4>",
  "prepTime": "<e.g. 15 Min.>",
  "cookTime": "<e.g. 30 Min.>",
  "difficulty": "<e.g. Einfach / Mittel / Schwer>",
  "ingredients": ["<ingredient 1 with quantity>", "<ingredient 2>"],
  "steps": ["<step 1>", "<step 2>", "<step 3>"],
  "tips": "<optional cooking tip, can be empty string>"
}`
	},
	review: {
		description: 'A written review of a product, restaurant, book, or film.',
		templateDataSchema: `{
  "subject": "<what is being reviewed, e.g. Das Hotel Adlon or Der Film Oppenheimer>",
  "rating": <integer 1-5>,
  "author": "<reviewer name>",
  "date": "<formatted date in target language>",
  "body": "<2-3 paragraph review text>",
  "verdict": "<one-sentence summary verdict>"
}`
	},
	letter: {
		description: 'A personal or formal letter.',
		templateDataSchema: `{
  "location": "<city name>",
  "date": "<formatted date in target language>",
  "salutation": "<e.g. Liebe Maria, or Sehr geehrte Damen und Herren,>",
  "body": "<letter body, 2-3 paragraphs>",
  "closing": "<e.g. Mit freundlichen Grüßen, or Herzliche Grüße,>",
  "signature": "<sender name>"
}`
	}
};

function buildImmersionPrompt(
	mediaType: MediaType,
	cefrLevel: string,
	languageName: string,
	vocabHints: string[],
	grammarHints: string[]
): string {
	const schema = MEDIA_TYPE_SCHEMAS[mediaType];
	const isLowerLevel = cefrLevel === 'A1' || cefrLevel === 'A2';

	let vocabSection = '';
	if (vocabHints.length > 0) {
		vocabSection = `\nThe learner is currently studying these vocabulary words. Try to naturally incorporate a few of them where they fit, but do NOT force them — authenticity comes first:\n${vocabHints.map((v) => `- ${v}`).join('\n')}\n`;
	}

	let grammarSection = '';
	if (grammarHints.length > 0) {
		grammarSection = `\nThe learner is practicing these grammar concepts. Where it feels natural, use sentence structures that demonstrate some of them:\n${grammarHints.map((g) => `- ${g}`).join('\n')}\n`;
	}

	return `You are a language learning content generator. Generate an authentic, realistic ${schema.description.toLowerCase()} written entirely in ${languageName}, appropriate for a ${cefrLevel} language learner.

Language complexity guidelines for ${cefrLevel}:
${
	cefrLevel === 'A1'
		? '- Use very simple, short sentences. Basic vocabulary only. Present tense mostly.'
		: cefrLevel === 'A2'
			? '- Use simple sentences. Common vocabulary. Present and simple past tense.'
			: cefrLevel === 'B1'
				? '- Use moderately complex sentences. Everyday vocabulary. Mix of tenses.'
				: cefrLevel === 'B2'
					? '- Use complex sentences. Wider vocabulary. Natural tense usage.'
					: '- Use sophisticated, native-level language.'
}

Make the content feel authentic — like something that would actually appear in the real world. Choose a realistic topic relevant to everyday life, culture, or current events.
${vocabSection}${grammarSection}

Generate a JSON response with this EXACT structure:
{
  "templateData": ${schema.templateDataSchema},
  "questions": [
    {
      "type": "multiple_choice",
      "question": "<comprehension question in English about the content>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctIndex": <0-3>,
      "explanation": "<brief explanation of why the answer is correct>",
      "points": 5
    },
    {
      "type": "multiple_choice",
      "question": "<vocabulary question in English, e.g. 'What does X mean?'>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctIndex": <0-3>,
      "explanation": "<brief explanation>",
      "points": 5
    },
    {
      "type": "free_response",
      "question": "<open-ended comprehension question in English requiring a short answer>",
      "sampleAnswer": "<1-2 sentence ideal answer in English>",
      "points": 10
    }${
		isLowerLevel
			? ''
			: `,
    {
      "type": "multiple_choice",
      "question": "<inference or context question in English>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctIndex": <0-3>,
      "explanation": "<brief explanation>",
      "points": 5
    },
    {
      "type": "free_response",
      "question": "<deeper question asking for opinion or analysis in English>",
      "sampleAnswer": "<ideal answer demonstrating understanding>",
      "points": 10
    }`
	}
  ]
}

Output ONLY valid JSON. No markdown, no extra text.`;
}

export async function POST(event) {
	const { request, locals } = event;

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = await prisma.user.findUnique({
		where: { id: locals.user.id },
		select: { useLocalLlm: true }
	});

	if (!user?.useLocalLlm && (await generateLessonRateLimiter.isLimited(event))) {
		return json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
	}

	if (!user?.useLocalLlm && await isQuotaExceeded(locals.user.id, false)) {
		return json({ error: 'Daily AI quota exceeded. Please try again tomorrow.' }, { status: 429 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const requestedMediaType = body.mediaType as MediaType | 'random' | undefined;

		const mediaType: MediaType =
			!requestedMediaType || requestedMediaType === 'random'
				? MEDIA_TYPES[Math.floor(Math.random() * MEDIA_TYPES.length)]
				: MEDIA_TYPES.includes(requestedMediaType as MediaType)
					? (requestedMediaType as MediaType)
					: MEDIA_TYPES[Math.floor(Math.random() * MEDIA_TYPES.length)];

		const cefrLevel = locals.user.cefrLevel || 'A1';
		const languageName = locals.user.activeLanguage?.name || 'German';
		const activeLanguageId = locals.user.activeLanguage?.id;

		let vocabHints: string[] = [];
		let vocabIds: string[] = [];
		let grammarHints: string[] = [];

		if (activeLanguageId) {
			const userVocabs = await prisma.userVocabulary.findMany({
				where: {
					userId: locals.user.id,
					vocabulary: { languageId: activeLanguageId }
				},
				include: { vocabulary: true },
				take: 15,
				orderBy: { nextReviewDate: 'asc' }
			});
			vocabHints = userVocabs.map((uv) => uv.vocabulary.lemma);
			vocabIds = userVocabs.map((uv) => uv.vocabularyId);

			const userGrammars = await prisma.userGrammarRule.findMany({
				where: {
					userId: locals.user.id,
					grammarRule: { languageId: activeLanguageId }
				},
				include: { grammarRule: true },
				take: 8,
				orderBy: { nextReviewDate: 'asc' }
			});
			grammarHints = userGrammars.map((ug) => ug.grammarRule.title);
		}

		const systemPrompt = buildImmersionPrompt(mediaType, cefrLevel, languageName, vocabHints, grammarHints);

		const userId = locals.user.id;
		const useLocalLlm = user?.useLocalLlm ?? false;
		const response = await generateChatCompletion({
			userId,
			messages: [
				{
					role: 'user',
					content: `Generate a ${mediaType.replace(/_/g, ' ')} in ${languageName} for a ${cefrLevel} learner.`
				}
			],
			systemPrompt,
			jsonMode: true,
			temperature: 0.85,
			onUsage: useLocalLlm ? undefined : ({ totalTokens }) => {
				recordTokenUsage(userId, totalTokens);
			}
		});

		const raw = response.choices[0].message.content;
		const result = JSON.parse(raw);

		// Attach unique IDs to questions for client-side tracking
		const questions = (result.questions || []).map(
			(q: Record<string, unknown>, i: number) => ({ ...q, id: `q${i}` })
		);

		return json({ mediaType, templateData: result.templateData, questions, vocabIds });
	} catch (error) {
		console.error('Immersion generate error:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
}
