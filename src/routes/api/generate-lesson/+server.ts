import { json } from '@sveltejs/kit';
import { SrsState } from '@prisma/client';
import { prisma } from '$lib/server/prisma';
import { generateChatCompletion } from '$lib/server/llm';
import { generateLessonRateLimiter } from '$lib/server/ratelimit';

export type GameMode = 'native-to-target' | 'target-to-native' | 'fill-blank' | 'multiple-choice';

export async function POST(event) {
	const { request, locals } = event;
	if (await generateLessonRateLimiter.isLimited(event)) {
		return json({ error: 'Too many requests. Limit is 10/min, 200/day.' }, { status: 429 });
	}

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const gameMode: GameMode = body.gameMode || 'native-to-target';
		const assignmentId = body.assignmentId;
		const activeLangName = locals.user.activeLanguage?.name || 'Target Language';
		const userId = locals.user.id;
		const activeLanguageId = locals.user.activeLanguage?.id;

		let targetCefrLevel = locals.user.cefrLevel || 'A1';
		let assignmentTopic: string | null = null;
		let assignmentTargetGrammar: string[] = [];

		if (assignmentId) {
			const assignment = await prisma.assignment.findUnique({
				where: { id: assignmentId }
			}) as any;
			if (assignment && assignment.targetCefrLevel) {
				targetCefrLevel = assignment.targetCefrLevel;
			}
			if (assignment) {
				assignmentTopic = assignment.topic || null;
				assignmentTargetGrammar = assignment.targetGrammar || [];
			}
		}

		const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
		const userLevelIndex = cefrLevels.indexOf(targetCefrLevel);
		const allowedLevels = cefrLevels.slice(0, userLevelIndex + 1);

		// Target a larger pool (10-15 words) so the LLM has choices for thematic coherence
		const targetLearningCount = Math.min(15, Math.max(10, 5 + userLevelIndex * 2));

		const now = new Date();

		// 1 & 2 & 3. Fetch Mastered and Learning Vocabulary and Grammar concurrently
		// Fetch a larger pool, then we will shuffle and select a subset
		let [masteredVocabDb, learningVocabDb, masteredGrammarDb, allMasteredGrammarIdsQuery] = await Promise.all([
			prisma.userVocabulary.findMany({
				where: { 
					userId, 
					srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
					OR: [
						{ nextReviewDate: null },
						{ nextReviewDate: { lte: now } }
					],
					vocabulary: { meaning: { not: null }, languageId: activeLanguageId }
				},
				include: { vocabulary: true },
				take: 100
			}),
			prisma.userVocabulary.findMany({
				where: { 
					userId, 
					srsState: { in: [SrsState.UNSEEN, SrsState.LEARNING] },
					OR: [
						{ nextReviewDate: null },
						{ nextReviewDate: { lte: now } }
					],
					vocabulary: { meaning: { not: null }, languageId: activeLanguageId }
				},
				include: { vocabulary: true },
				take: 100
			}),
			prisma.userGrammarRule.findMany({
				where: { 
					userId, 
					srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] },
					OR: [
						{ nextReviewDate: null },
						{ nextReviewDate: { lte: now } }
					]
				},
				include: { grammarRule: true },
				take: 5
			}),
			prisma.userGrammarRule.findMany({
				where: {
					userId,
					srsState: { in: [SrsState.KNOWN, SrsState.MASTERED] }
				},
				select: { grammarRuleId: true }
			})
		]);

		const masteredGrammarIds = new Set(allMasteredGrammarIdsQuery.map(g => g.grammarRuleId));

		let learningGrammarDbQuery = await prisma.userGrammarRule.findMany({
			where: { 
				userId, 
				srsState: { in: [SrsState.UNSEEN, SrsState.LEARNING] },
				OR: [
					{ nextReviewDate: null },
					{ nextReviewDate: { lte: now } }
				],
				grammarRule: { level: { in: allowedLevels }, languageId: activeLanguageId }
			},
			include: { 
				grammarRule: {
					include: { dependencies: { select: { id: true } } }
				} 
			}
		});

		let learningGrammarDb = learningGrammarDbQuery.filter(ug => {
			return ug.grammarRule.dependencies.every(dep => masteredGrammarIds.has(dep.id));
		}).slice(0, 1);

		// Shuffle and take a random subset of words for the prompt to ensure diversity
		masteredVocabDb = masteredVocabDb.sort(() => 0.5 - Math.random()).slice(0, 10);
		learningVocabDb = learningVocabDb.sort(() => 0.5 - Math.random()).slice(0, targetLearningCount);

		// Always try to inject 1-2 new random words to keep the user learning
		const knownVocabIds = await prisma.userVocabulary.findMany({
			where: { userId },
			select: { vocabularyId: true }
		});
		
		const knownIdsArray = knownVocabIds.map(v => v.vocabularyId);
		
		// To get random unseen words, we can't easily order by random in standard Prisma findMany without fetching all.
		// A fast approximation is getting a random offset using count.
		const unseenCount = await prisma.vocabulary.count({
			where: { id: { notIn: knownIdsArray }, meaning: { not: null }, languageId: activeLanguageId }
		});

		if (unseenCount > 0 && learningVocabDb.length < targetLearningCount) {
			const needed = targetLearningCount - learningVocabDb.length;
			const randomSkip = Math.max(0, Math.floor(Math.random() * unseenCount) - needed);
			const unseenVocabs = await prisma.vocabulary.findMany({
				where: { id: { notIn: knownIdsArray }, meaning: { not: null }, languageId: activeLanguageId },
				skip: randomSkip,
				take: needed
			});
			
			// Push these directly into learning list so they get taught
			for (const uv of unseenVocabs) {
				// @ts-expect-error type inference
				learningVocabDb.push({ vocabulary: uv });
			}
		}

		// Fallback for new users: if no UserVocabulary exists, pick random Vocabulary
		if (masteredVocabDb.length === 0 && learningVocabDb.length === 0) {
			const allVocabs = await prisma.vocabulary.findMany({
				where: { meaning: { not: null }, languageId: activeLanguageId },
				take: 22
			});
			// @ts-expect-error type inference
			masteredVocabDb = allVocabs.slice(0, 20).map(v => ({ vocabulary: v }));
			// @ts-expect-error type inference
			learningVocabDb = allVocabs.slice(20, 22).map(v => ({ vocabulary: v }));
		}

		// If we still have no learning vocabulary, pick some unseen ones from the global list
		if (learningVocabDb.length === 0) {
			const knownVocabIds = await prisma.userVocabulary.findMany({
				where: { userId },
				select: { vocabularyId: true }
			});
			const unseenVocabs = await prisma.vocabulary.findMany({
				where: { id: { notIn: knownVocabIds.map(v => v.vocabularyId) }, meaning: { not: null }, languageId: activeLanguageId },
				take: 2
			});
			// @ts-expect-error type inference
			learningVocabDb = unseenVocabs.map(v => ({ vocabulary: v }));
		}

		// 3. Same for Grammar
		if (masteredGrammarDb.length === 0 && learningGrammarDb.length === 0) {
			const potentialNewGrammars = await prisma.grammarRule.findMany({ 
				where: { level: { in: allowedLevels }, languageId: activeLanguageId },
				include: { dependencies: { select: { id: true } } },
				take: 20
			});
			const eligibleGrammars = potentialNewGrammars.filter(rule => 
				rule.dependencies.every(dep => masteredGrammarIds.has(dep.id))
			);
			if (eligibleGrammars.length > 0) {
				// @ts-expect-error type inference
				masteredGrammarDb = eligibleGrammars.slice(0, Math.min(5, eligibleGrammars.length - 1)).map(g => ({ grammarRule: g }));
				if (eligibleGrammars.length > 5) {
					// @ts-expect-error type inference
					learningGrammarDb = eligibleGrammars.slice(5, 6).map(g => ({ grammarRule: g }));
				} else if (eligibleGrammars.length > 1) {
					// @ts-expect-error type inference
					learningGrammarDb = eligibleGrammars.slice(-1).map(g => ({ grammarRule: g }));
				}
			}
		}

		// If we still have no learning grammar, pick some unseen ones from the global list
		if (learningGrammarDb.length === 0) {
			const knownGrammarIds = await prisma.userGrammarRule.findMany({
				where: { userId },
				select: { grammarRuleId: true }
			});
			const knownIdsSet = new Set(knownGrammarIds.map(g => g.grammarRuleId));

			const potentialNewGrammars = await prisma.grammarRule.findMany({
				where: { id: { notIn: Array.from(knownIdsSet) }, level: { in: allowedLevels }, languageId: activeLanguageId },
				include: { dependencies: { select: { id: true } } },
				take: 20
			});
			
			const eligibleGrammars = potentialNewGrammars.filter(rule => 
				rule.dependencies.every(dep => masteredGrammarIds.has(dep.id))
			);

			if (eligibleGrammars.length > 0) {
				// @ts-expect-error type inference
				learningGrammarDb = [ { grammarRule: eligibleGrammars[0] } ];
			}
		}

		const masteredVocab = masteredVocabDb.map((uv: any) => ({ ...uv.vocabulary, eloRating: uv.eloRating ?? 1000, srsState: uv.srsState ?? 'UNSEEN' }));
		const learningVocab = learningVocabDb.map((uv: any) => ({ ...uv.vocabulary, eloRating: uv.eloRating ?? 1000, srsState: uv.srsState ?? 'UNSEEN' }));
		const masteredGrammar = masteredGrammarDb.map(ug => ug.grammarRule);
		const learningGrammar = learningGrammarDb.map(ug => ug.grammarRule);

		// Build short ID maps for LLM (saves tokens & prevents UUID garbling)
		const idMap: Record<string, string> = {}; // short -> real UUID
		learningVocab.forEach((v, i) => { idMap[`v${i}`] = v.id; });
		learningGrammar.forEach((g, i) => { idMap[`g${i}`] = g.id; });

		// Format for prompt
		const formatVocab = (v: { lemma: string, meaning: string | null, gender?: string | null, plural?: string | null }) => `- ${v.gender ? v.gender + ' ' : ''}${v.lemma}${v.plural ? ' (pl: ' + v.plural + ')' : ''} (${v.meaning})`;
		const masteredVocabList = masteredVocab.map(v => formatVocab(v as unknown as Parameters<typeof formatVocab>[0])).join('\n');
		const learningVocabList = learningVocab.map((v, i) => `${formatVocab(v as unknown as Parameters<typeof formatVocab>[0])} - ID: v${i}`).join('\n');
		const masteredGrammarList = masteredGrammar.map(g => `- ${g.title} (${g.description})`).join('\n');
		const learningGrammarList = learningGrammar.map((g, i) => `- ${g.title} (${g.description}) - ID: g${i}`).join('\n');

		const userLevel = locals.user.cefrLevel || 'A1';
		const isBeginner = userLevel === 'A1' || userLevel === 'A2';
		const isAbsoluteBeginner = userLevel === 'A1' && masteredVocabDb.length <= 5;

		const sentenceConstraint = isAbsoluteBeginner
			? `Generate EXACTLY ONE very simple ${activeLangName} sentence (3-6 words, no run-ons) suitable for someone who is just starting to learn ${activeLangName}. Use only basic vocabulary like greetings, pronouns, simple verbs (sein, haben, heißen, kommen), and common nouns. Keep it extremely simple.`
			: isBeginner
			? `Generate EXACTLY ONE simple, natural ${activeLangName} sentence (no run-ons/semi-colons) as a challenge.`
			: `Generate a natural ${activeLangName} challenge (complex sentence or exactly 2 STRICTLY related, narrative sentences forming a micro-story) suitable for ${userLevel}.`;

		const topicConstraint = assignmentTopic ? `\nCRITICAL THEMATIC CONSTRAINT: The sentence(s) MUST be about the topic: "${assignmentTopic}". This is a mandatory requirement.` : '';
		const grammarConstraint = assignmentTargetGrammar.length > 0 ? `\nCRITICAL GRAMMAR CONSTRAINT: The sentence(s) MUST incorporate the following grammar rule(s): ${assignmentTargetGrammar.join(', ')}. This is a mandatory requirement.` : '';

		// Build mode-specific prompt parts
		let modeInstruction: string;
		let vocabTagInstruction: string;
		let jsonFormatBlock: string;
		let jsonSchemaObj: Record<string, unknown>;

		if (gameMode === 'fill-blank') {
			modeInstruction = `This is a FILL IN THE BLANK exercise. Generate a ${activeLangName} sentence, then create the "challengeText" by replacing targeted vocabulary words with blanks "___". The "targetSentence" must be the complete ${activeLangName} sentence with no blanks. Provide a "hints" array with one object per blank: each has the "vocabId" and a "hint" string (the English meaning of the missing word).`;
			vocabTagInstruction = `Do NOT use <vocab> tags. Instead, replace targeted words with "___" in challengeText. The targetSentence has the full correct ${activeLangName} sentence.`;
			jsonFormatBlock = `JSON format:
{
  "challengeText": "<${activeLangName} sentence with ___ for blanked words>",
  "targetSentence": "<Complete ${activeLangName} sentence>",
  "hints": [{ "vocabId": "<id>", "hint": "<English meaning>" }],
  "targetedVocabularyIds": ["<id1>"],
  "targetedGrammarIds": ["<id1>"]
}`;
			jsonSchemaObj = {
				type: "object",
				properties: {
					challengeText: { type: "string", description: "${activeLangName} sentence with ___ blanks" },
					targetSentence: { type: "string", description: "Complete ${activeLangName} sentence" },
					hints: {
						type: "array",
						items: {
							type: "object",
							properties: {
								vocabId: { type: "string" },
								hint: { type: "string" }
							},
							required: ["vocabId", "hint"],
							additionalProperties: false
						},
						description: "Hints for each blank"
					},
					targetedVocabularyIds: { type: "array", items: { type: "string" } },
					targetedGrammarIds: { type: "array", items: { type: "string" } }
				},
				required: ["challengeText", "targetSentence", "hints", "targetedVocabularyIds", "targetedGrammarIds"],
				additionalProperties: false
			};
		} else if (gameMode === 'multiple-choice') {
			modeInstruction = `This is a MULTIPLE CHOICE exercise. Generate a ${activeLangName} sentence as "challengeText". Provide the correct English translation as "targetSentence". Also provide exactly 3 plausible but INCORRECT English translations as "distractors". The distractors should be similar enough to be challenging but clearly wrong.`;
			vocabTagInstruction = `CRITICAL: In the "challengeText" (which is ${activeLangName}), you MUST wrap the ${activeLangName} lemma form of targeted vocabulary words in a <vocab id="VOCAB_ID">...</vocab> tag. For example, if targeting vocabulary ID "123" with lemma "Hund", write: "Der <vocab id="123">Hund</vocab> bellt."`;
			jsonFormatBlock = `JSON format:
{
  "challengeText": "<${activeLangName} sentence with vocab tags>",
  "targetSentence": "<Correct English translation>",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "targetedVocabularyIds": ["<id1>"],
  "targetedGrammarIds": ["<id1>"]
}`;
			jsonSchemaObj = {
				type: "object",
				properties: {
					challengeText: { type: "string", description: "${activeLangName} sentence to translate" },
					targetSentence: { type: "string", description: "Correct English translation" },
					distractors: {
						type: "array",
						items: { type: "string" },
						description: "3 plausible but incorrect English translations"
					},
					targetedVocabularyIds: { type: "array", items: { type: "string" } },
					targetedGrammarIds: { type: "array", items: { type: "string" } }
				},
				required: ["challengeText", "targetSentence", "distractors", "targetedVocabularyIds", "targetedGrammarIds"],
				additionalProperties: false
			};
		} else if (gameMode === 'target-to-native') {
			modeInstruction = `User translates FROM ${activeLangName} TO English ("challengeText"=${activeLangName}, "targetSentence"=English).`;
			vocabTagInstruction = `CRITICAL: In the "challengeText" (which is ${activeLangName}), you MUST wrap the ${activeLangName} lemma form of targeted vocabulary words in a <vocab id="VOCAB_ID">...</vocab> tag. For example, if targeting vocabulary ID "123" with lemma "Hund", write: "Der <vocab id="123">Hund</vocab> bellt."`;
			jsonFormatBlock = `JSON format:
{
  "challengeText": "<${activeLangName} text>",
  "targetSentence": "<English translation>",
  "targetedVocabularyIds": ["<id1>", "<id2>"],
  "targetedGrammarIds": ["<id1>"]
}`;
			jsonSchemaObj = {
				type: "object",
				properties: {
					challengeText: { type: "string", description: "The ${activeLangName} text to translate" },
					targetSentence: { type: "string", description: "The English translation" },
					targetedVocabularyIds: { type: "array", items: { type: "string" } },
					targetedGrammarIds: { type: "array", items: { type: "string" } }
				},
				required: ["challengeText", "targetSentence", "targetedVocabularyIds", "targetedGrammarIds"],
				additionalProperties: false
			};
		} else {
			// native-to-target (default)
			modeInstruction = `User translates FROM English TO ${activeLangName} ("challengeText"=English, "targetSentence"=${activeLangName}).`;
			vocabTagInstruction = `CRITICAL: In the "challengeText" (which is English), you MUST use the ENGLISH meaning of the targeted vocabulary word and wrap it in a <vocab id="VOCAB_ID">...</vocab> tag. For example, if targeting vocabulary ID "123" with lemma "Hund" and meaning "dog", write: "The <vocab id="123">dog</vocab> is barking." Do NOT put ${activeLangName} words in the English challengeText.
MULTI-WORD MEANINGS: If a ${activeLangName} word's English meaning contains multiple words (e.g., "Fernsehprogramm" = "television program"), you MUST wrap ALL the words together as a single unit inside ONE <vocab> tag. For example: "I watched the <vocab id="v0">television program</vocab> last night." — NOT "<vocab id="v0">television</vocab> program" or "television <vocab id="v0">program</vocab>". The entire multi-word phrase must be inside a single <vocab> tag.`;
			jsonFormatBlock = `JSON format:
{
  "challengeText": "<English text>",
  "targetSentence": "<${activeLangName} translation>",
  "targetedVocabularyIds": ["<id1>", "<id2>"],
  "targetedGrammarIds": ["<id1>"]
}`;
			jsonSchemaObj = {
				type: "object",
				properties: {
					challengeText: { type: "string", description: "The English text to translate" },
					targetSentence: { type: "string", description: "The ${activeLangName} translation" },
					targetedVocabularyIds: { type: "array", items: { type: "string" } },
					targetedGrammarIds: { type: "array", items: { type: "string" } }
				},
				required: ["challengeText", "targetSentence", "targetedVocabularyIds", "targetedGrammarIds"],
				additionalProperties: false
			};
		}

		// 4. Construct System Prompt
		const beginnerGuidance = isAbsoluteBeginner
			? `\nABSOLUTE BEGINNER MODE: This student is just starting to learn ${activeLangName}. They may know almost nothing.
- Use extremely simple vocabulary (greetings, personal pronouns, basic verbs like sein/haben/heißen)
- Sentences should be 3-6 words maximum
- For native-to-target mode: use simple English sentences like "I am a man", "The child is small", "I have a book"
- For target-to-native mode: use simple ${activeLangName} like "Ich bin gut", "Das Kind ist klein"
- For fill-blank: blank only ONE very basic word
- For multiple-choice: make distractors clearly different from the correct answer
- Focus on building confidence — correctness over complexity\n`
			: '';

		const systemPrompt = `Act as an expert ${activeLangName} tutor for a ${userLevel} student. Output ONLY strictly valid JSON, no markdown or extra text.
${beginnerGuidance}

${sentenceConstraint}${topicConstraint}${grammarConstraint}
Compose the ${activeLangName} text focusing on the "Mastered" and "Learning" vocabulary provided below. You are ALLOWED to use other natural ${activeLangName} vocabulary appropriate for a ${userLevel} student, even if it is not in the provided lists. However, you MUST ABSOLUTELY AVOID using any custom or user-provided words that are not explicitly present in the provided vocabulary lists below. If you think the user might have learned a specific obscure word elsewhere but it is not in these lists, do not use it.
CRITICAL THEMATIC INJECTION: The "Learning Concepts" list below is a POOL of words. You MUST choose ONE word from it to establish a central theme. Then, try to incorporate other words from the Learning list ONLY if they fit naturally within that theme.
CRITICAL QUALITY INSTRUCTION: Prioritize sentence quality, natural flow, and logic over using every single word provided in the lists. Do NOT try to force or jam words together if they don't make sense. You DO NOT have to use all the words provided, just pick the ones that fit naturally and make logical sense.
${modeInstruction}

${vocabTagInstruction}

Mastered Vocab:
${masteredVocabList || "Basic"}

Mastered Grammar:
${masteredGrammarList || "Basic"}

Learning Concepts (USE WHAT FITS NATURALLY):
Vocab:
${learningVocabList || "None"}
Grammar:
${learningGrammarList || "None"}

${jsonFormatBlock}`;

		// 5. Call LLM
		const llmResponse = await generateChatCompletion({
			userId,
			messages: [{ role: 'user', content: 'Generate the next challenge based on my current level.' }],
			systemPrompt,
			jsonSchema: jsonSchemaObj,
			stream: true,
			signal: request.signal
		});

		// Calculate targeted concepts beforehand, assuming LLM will use all of them if fallback is needed.
		// Since we're streaming, we send the full learning lists as the targeted concepts immediately.
		// The client could filter them at the end based on targetedIds, but sending them all is safe 
		// because we only gave it 1-2 learning concepts anyway.
		const targetedVocabulary = learningVocab;
		const targetedGrammar = learningGrammar;

		let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

		const stream = new ReadableStream({
			async start(controller) {
				// Send metadata first
				controller.enqueue(
					new TextEncoder().encode(
						JSON.stringify({
							type: 'metadata',
							data: {
								userId,
								targetedVocabulary,
								targetedGrammar,
								allVocabulary: [...masteredVocab, ...learningVocab],
								gameMode,
								idMap,
								userLevel,
								isAbsoluteBeginner
							}
						}) + '\n'
					)
				);

				const reader = llmResponse.body?.getReader();
				if (!reader) {
					controller.close();
					return;
				}

				// Store reader reference for cancel handler
				upstreamReader = reader;

				const decoder = new TextDecoder();
				let buffer = '';
				let fullContent = '';
				
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						
						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							const trimmedLine = line.trim();
							if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
								try {
									const data = JSON.parse(trimmedLine.slice(6));
									const content = data.choices[0]?.delta?.content || '';
									if (content) {
										fullContent += content;
										controller.enqueue(
											new TextEncoder().encode(
												JSON.stringify({ type: 'chunk', content }) + '\n'
											)
										);
									}
								} catch {
									// ignore partial JSON parse errors
								}
							}
						}
					}
					
					if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
						try {
							const data = JSON.parse(buffer.trim().slice(6));
							const content = data.choices[0]?.delta?.content || '';
							if (content) {
								fullContent += content;
								controller.enqueue(
									new TextEncoder().encode(
										JSON.stringify({ type: 'chunk', content }) + '\n'
									)
								);
							}
						} catch {
							// ignore parse errors
						}
					}

					// Vocab enrichment: look up words from generated text in the full Vocabulary table
					try {
						let cleaned = fullContent;
						const firstBrace = cleaned.indexOf('{');
						const lastBrace = cleaned.lastIndexOf('}');
						if (firstBrace !== -1 && lastBrace !== -1) {
							cleaned = cleaned.slice(firstBrace, lastBrace + 1);
						}
						const parsedResponse = JSON.parse(cleaned);

						// Extract all text that may contain ${activeLangName} words
						const allText = [
							parsedResponse.challengeText || '',
							parsedResponse.targetSentence || ''
						].join(' ');

						const rawWords = allText
							.replace(/<[^>]+>/g, '')
							.split(/\s+/)
							.map((w: string) => w.replace(/[.,!?;:'"|()/[\]{}\-\u2014\u2013]/g, '').trim())
							.filter((w: string) => w.length > 0);

						const existingIds = new Set(
							[...masteredVocab, ...learningVocab].map(v => v.id)
						);

						const candidates = new Set<string>();
						for (const word of rawWords) {
							const lower = word.toLowerCase();
							candidates.add(lower);
							candidates.add(lower.charAt(0).toUpperCase() + lower.slice(1));

							if (activeLangName === 'German') {
							// Basic ${activeLangName} stemming: strip inflectional suffixes
														const suffixes = ['ung', 'te', 'ten', 'tet', 'test', 'en', 'er', 'es', 'em', 'et', 'st', 'e', 't', 'n', 's'];
														for (const suffix of suffixes) {
															if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
																const stem = lower.slice(0, -suffix.length);
																candidates.add(stem);
																candidates.add(stem.charAt(0).toUpperCase() + stem.slice(1));
																if (suffix !== 'en') {
																	candidates.add(stem + 'en');
																	candidates.add((stem + 'en').charAt(0).toUpperCase() + (stem + 'en').slice(1));
																}
															}
														}
							
														// Past participle: ge-...-t or ge-...-en
														if (lower.startsWith('ge') && lower.length > 4) {
															const rest = lower.slice(2);
															candidates.add(rest);
															candidates.add(rest.charAt(0).toUpperCase() + rest.slice(1));
															if (rest.endsWith('t') && rest.length > 2) {
																const pStem = rest.slice(0, -1);
																candidates.add(pStem + 'en');
																candidates.add((pStem + 'en').charAt(0).toUpperCase() + (pStem + 'en').slice(1));
															}
															if (rest.endsWith('en') && rest.length > 3) {
																candidates.add(rest);
																candidates.add(rest.charAt(0).toUpperCase() + rest.slice(1));
															}
														}
							
														// zu-infinitive: aufzugeben → aufgeben
														const zuMatch = lower.match(/^(.+?)zu(.+)$/);
														if (zuMatch && zuMatch[1].length >= 2 && zuMatch[2].length >= 2) {
															const combined = zuMatch[1] + zuMatch[2];
															candidates.add(combined);
															candidates.add(combined.charAt(0).toUpperCase() + combined.slice(1));
														}
													}
						}
						let enrichmentVocab: any[] = [];
						if (candidates.size > 0) {
							enrichmentVocab = await prisma.vocabulary.findMany({
								where: {
									lemma: { in: Array.from(candidates) },
									id: { notIn: Array.from(existingIds) }
								}
							});

							if (enrichmentVocab.length > 0) {
								controller.enqueue(
									new TextEncoder().encode(
										JSON.stringify({
											type: 'vocab_enrichment',
											data: enrichmentVocab
										}) + '\n'
									)
								);
							}
						}

						// AI fallback: ask the LLM (using the configured model) to generate vocab data
						// for content words that remain unknown after DB lookup.
						const functionWords = new Set([
							// German articles & determiners
							'der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines',
							'kein','keine','keinen','keinem','keiner','keines',
							// German pronouns & common particles
							'ich','du','er','sie','es','wir','ihr','sie','sie','sich',
							'mich','dich','ihn','uns','euch','ihnen',
							'mir','dir','ihm','ihr','uns','euch','ihnen',
							'mein','dein','sein','unser','euer','ihr',
							// German conjunctions / particles
							'und','oder','aber','doch','denn','weil','dass','wenn','ob','als','wie',
							'nicht','auch','noch','schon','nur','sehr','so','ja','nein','gar',
							// German prepositions (contracted forms already in inflection map)
							'in','an','auf','für','mit','von','zu','bei','nach','aus','über','unter',
							'vor','hinter','neben','zwischen','durch','um','gegen','ohne','bis',
							'am','im','ins','zum','zur','vom','beim','ans','aufs','fürs',
							// English function words
							'a','an','the','of','in','is','it','to','he','she','we','they','i','you',
							'this','that','and','or','but','at','as','be','by','do','for','if','me',
							'my','no','not','on','up','us','was','are','has','had','his','her','its',
						]);

						const foundLemmas = new Set<string>([
							...masteredVocab.map(v => v.lemma.toLowerCase()),
							...learningVocab.map(v => v.lemma.toLowerCase()),
							...enrichmentVocab.map((v: any) => v.lemma.toLowerCase()),
						]);

						const unknownContentWords = [
							...new Set(
								rawWords
									.map((w: string) => w.replace(/[.,!?;:'"|()/[\]{}\-\u2014\u2013]/g, '').trim())
									.filter((w: string) =>
										w.length >= 3 &&
										!functionWords.has(w.toLowerCase()) &&
										!foundLemmas.has(w.toLowerCase())
									)
							)
						].slice(0, 20); // cap to avoid huge requests

						// Contextual pronoun / conjugation lookup:
						// Many words have generic DB meanings that are misleading in context.
						// E.g. German "es" = "it" but "es gibt" = "there is/are"; Spanish "es" is a
						// conjugated verb (ser → "is"), "se" is a reflexive/passive marker, etc.
						const AMBIGUOUS_WORDS_BY_LANG: Record<string, string[]> = {
							'German': [
								'er','sie','es','wir','ihr',          // personal pronouns (she/they/formal-you ambiguity)
								'man','sich',                          // impersonal / reflexive
								'ihn','ihm','ihnen',                   // accusative/dative pronoun forms
								'jemand','niemand','etwas','nichts',   // indefinite pronouns
							],
							'Spanish': [
								// Conjugated forms of ser / estar / tener / ir / haber — contextually ambiguous
								'es','está','son','están','era','fue','sido','siendo',
								'hay','hubo','había',                  // haber impersonal
								'va','van','voy','vamos',              // ir conjugations
								'tiene','tienen','tengo',              // tener
								// Object / reflexive / indirect-object pronouns
								'se','le','les','lo','la','los','las', // clitic pronouns
								'me','te','nos','os',                  // other clitics
							],
						};
						const ambiguousForLang = AMBIGUOUS_WORDS_BY_LANG[activeLangName] ?? [];
						const ambiguousSet = new Set(ambiguousForLang);
						const sentenceWordsLower = rawWords
							.map((w: string) => w.replace(/[.,!?;:'"|()/[\]{}\-\u2014\u2013¡¿]/g, '').toLowerCase())
							.filter(Boolean);
						const ambiguousInSentence = ambiguousForLang.length > 0
							? [...new Set(sentenceWordsLower.filter((w: string) => ambiguousSet.has(w)))]
							: [];
						const fullSentence = [
							parsedResponse.challengeText || '',
							parsedResponse.targetSentence || ''
						].join(' ').replace(/<[^>]+>/g, '').trim();

						if (unknownContentWords.length > 0 || ambiguousInSentence.length > 0) {
							// Run both AI enrichment calls in parallel — do NOT await them sequentially.
							const aiTasks: Promise<void>[] = [];

							if (unknownContentWords.length > 0) {
								aiTasks.push((async () => {
									try {
										const aiRes = await generateChatCompletion({
											userId,
											messages: [{
												role: 'user',
												content: `Provide vocabulary dictionary entries for these ${activeLangName} words or inflected forms: ${JSON.stringify(unknownContentWords)}\n\nRespond with JSON in this exact shape:\n{"vocabulary":[{"lemma":"...","meaning":"...","partOfSpeech":"noun|verb|adjective|adverb|preposition|conjunction|pronoun|article|particle|interjection|other","gender":"MASCULINE|FEMININE|NEUTER or null for non-nouns","plural":"plural form or null"}]}`
											}],
											systemPrompt: `You are an expert ${activeLangName} lexicographer. For each word given (which may be an inflected form), output its base-form (lemma) dictionary entry with an English meaning. Output ONLY valid JSON matching the requested schema, no markdown or extra text.`,
											jsonMode: true,
											temperature: 0.1
										});
										let aiResultRaw: string;
										if (typeof aiRes.choices?.[0]?.message?.content === 'string') {
											aiResultRaw = aiRes.choices[0].message.content;
										} else {
											aiResultRaw = JSON.stringify(aiRes);
										}
										const aiResult = JSON.parse(aiResultRaw);
										if (aiResult?.vocabulary?.length > 0) {
											const aiVocabEntries = await Promise.all(
												aiResult.vocabulary.map(async (v: any) => {
													const cleanLemma = v.lemma?.replace(/^[.,!?;:'"()[\\]{}-]+|[.,!?;:'"()[\\]{}-]+$/g, '') || '';
													const existing = await prisma.vocabulary.findFirst({
														where: { lemma: cleanLemma, languageId: activeLanguageId }
													});
													if (existing) {
														if (!existing.meaning && v.meaning) {
															return prisma.vocabulary.update({
																where: { id: existing.id },
																data: { meaning: v.meaning, partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech }
															});
														}
														return existing;
													}
													return prisma.vocabulary.create({
														data: {
															lemma: cleanLemma,
															meaning: v.meaning,
															partOfSpeech: v.partOfSpeech,
															gender: v.gender ?? null,
															plural: v.plural ?? null,
															languageId: activeLanguageId
														}
													});
												})
											);
											controller.enqueue(
												new TextEncoder().encode(
													JSON.stringify({ type: 'vocab_enrichment', data: aiVocabEntries }) + '\n'
												)
											);
										}
									} catch (aiFallbackErr) {
										console.error('AI vocab fallback failed:', aiFallbackErr);
									}
								})());
							}

							if (ambiguousInSentence.length > 0 && fullSentence) {
								aiTasks.push((async () => {
									try {
										const ctxRes = await generateChatCompletion({
											userId,
											messages: [{
												role: 'user',
												content: `Sentence: "${fullSentence}"\nWords to explain: ${JSON.stringify(ambiguousInSentence)}\n\nRespond with JSON in this exact shape:\n{"vocabulary":[{"lemma":"the word as it appears","meaning":"precise contextual meaning/role in this sentence","partOfSpeech":"verb|pronoun|particle|other"}]}`
											}],
											systemPrompt: `You are an expert ${activeLangName} grammar tutor. For each word given, explain its specific meaning and grammatical role IN THE PROVIDED SENTENCE only — not a generic dictionary definition. Be concise but precise. Examples: Spanish "es" → "is (3rd person singular of ser)", "se lava" → "se = reflexive marker (washes himself)", German "sie" → "they (subject)" or "she (subject)" depending on context, "es gibt" → "there is/are (impersonal)". Output ONLY valid JSON, no markdown.`,
											jsonMode: true,
											temperature: 0.1
										});
										let ctxRaw: string;
										if (typeof ctxRes.choices?.[0]?.message?.content === 'string') {
											ctxRaw = ctxRes.choices[0].message.content;
										} else {
											ctxRaw = JSON.stringify(ctxRes);
										}
										const ctxResult = JSON.parse(ctxRaw);
										if (ctxResult?.vocabulary?.length > 0) {
											const ctxEntries = await Promise.all(
												ctxResult.vocabulary.map(async (v: any) => {
													const cleanLemma = v.lemma?.replace(/^[.,!?;:'"()[\\]{}-]+|[.,!?;:'"()[\\]{}-]+$/g, '') || '';
													const existing = await prisma.vocabulary.findFirst({
														where: { lemma: cleanLemma, languageId: activeLanguageId }
													});
													if (existing) {
														if (!existing.meaning && v.meaning) {
															return prisma.vocabulary.update({
																where: { id: existing.id },
																data: { meaning: v.meaning, partOfSpeech: v.partOfSpeech ?? existing.partOfSpeech }
															});
														}
														return existing;
													}
													return prisma.vocabulary.create({
														data: {
															lemma: cleanLemma,
															meaning: v.meaning,
															partOfSpeech: v.partOfSpeech ?? 'pronoun',
															gender: null,
															plural: null,
															languageId: activeLanguageId
														}
													});
												})
											);
											controller.enqueue(
												new TextEncoder().encode(
													JSON.stringify({ type: 'vocab_enrichment', data: ctxEntries }) + '\n'
												)
											);
										}
									} catch (ctxErr) {
										console.error('Contextual word AI lookup failed:', ctxErr);
									}
								})());
							}

							// Wait for whichever tasks exist — both run concurrently
							await Promise.allSettled(aiTasks);
						}
					} catch (enrichErr) {
						console.error('Vocab enrichment failed:', enrichErr);
					}
					
					controller.close();
				} catch (e) {
					controller.error(e);
				}
			},
			cancel() {
				// Client disconnected — cancel upstream LLM reader
				upstreamReader?.cancel();
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'application/x-ndjson',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (error) {
		console.error('Error generating lesson:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
}
