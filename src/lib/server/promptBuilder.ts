export type GameMode = 'native-to-target' | 'target-to-native' | 'fill-blank' | 'multiple-choice';

export function buildLessonPrompt({
	activeLangName,
	userLevel,
	gameMode,
	isAbsoluteBeginner,
	assignmentTopic,
	assignmentTargetGrammar,
	masteredVocabList,
	learningVocabList,
	masteredGrammarList,
	learningGrammarList
}: {
	activeLangName: string;
	userLevel: string;
	gameMode: GameMode;
	isAbsoluteBeginner: boolean;
	assignmentTopic: string | null;
	assignmentTargetGrammar: string[];
	masteredVocabList: string;
	learningVocabList: string;
	masteredGrammarList: string;
	learningGrammarList: string;
}) {
	const isBeginner = userLevel === 'A1' || userLevel === 'A2';

	const sentenceConstraint = isAbsoluteBeginner
		? `Generate EXACTLY ONE very simple ${activeLangName} sentence (3-6 words, no run-ons) suitable for someone who is just starting to learn ${activeLangName}. Use only basic vocabulary like greetings, pronouns, simple verbs (sein, haben, heißen, kommen), and common nouns. Keep it extremely simple.`
		: isBeginner
			? `Generate EXACTLY ONE simple, natural ${activeLangName} sentence (no run-ons/semi-colons) as a challenge.`
			: `Generate a natural ${activeLangName} challenge (complex sentence or exactly 2 STRICTLY related, narrative sentences forming a micro-story) suitable for ${userLevel}.`;

	const qualityConstraint = `
CRITICAL STYLE & TONE CONSTRAINT:
- The sentences MUST NOT be mundane, robotic, or nonsensical.
- They MUST be engaging, thought-provoking, and highly relevant for everyday use.
- Emulate the style, depth, and conversational realism of AP Language classes.
- Cover real-world situations, nuanced day-to-day communication, and engaging scenarios.
- Whether short or long, the sentence(s) must make complete sense, sound highly natural, and actively engage the user.`;

	const topicConstraint = assignmentTopic
		? `\nCRITICAL THEMATIC CONSTRAINT: The sentence(s) MUST be about the topic: "${assignmentTopic}". This is a mandatory requirement.`
		: '';
	const grammarConstraint =
		assignmentTargetGrammar.length > 0
			? `\nCRITICAL GRAMMAR CONSTRAINT: The sentence(s) MUST incorporate the following grammar rule(s): ${assignmentTargetGrammar.join(', ')}. This is a mandatory requirement.`
			: '';

	// Build mode-specific prompt parts
	let modeInstruction: string;
	let vocabTagInstruction: string;
	let jsonFormatBlock: string;
	let jsonSchemaObj: Record<string, unknown>;

	if (gameMode === 'fill-blank') {
		modeInstruction = `This is a FILL IN THE BLANK exercise. Generate a ${activeLangName} sentence, then create the "challengeText" by replacing targeted vocabulary words with blanks "___". The "targetSentence" must be the complete ${activeLangName} sentence with no blanks. Provide a "hints" array with one object per blank: each has the "vocabId" and a "hint" string (the English meaning of the missing word). CRUCIAL: If testing the active grammar rule, you MUST blank out the specific word, prefix, or suffix that demonstrates the grammar rule and pass the grammar rule's ID (e.g., "g0") in the "vocabId" field, with a helpful hint.`;
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
			type: 'object',
			properties: {
				challengeText: {
					type: 'string',
					description: `${activeLangName} sentence with ___ blanks`
				},
				targetSentence: { type: 'string', description: `Complete ${activeLangName} sentence` },
				hints: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							vocabId: { type: 'string' },
							hint: { type: 'string' }
						},
						required: ['vocabId', 'hint'],
						additionalProperties: false
					},
					description: 'Hints for each blank'
				},
				targetedVocabularyIds: { type: 'array', items: { type: 'string' } },
				targetedGrammarIds: { type: 'array', items: { type: 'string' } }
			},
			required: [
				'challengeText',
				'targetSentence',
				'hints',
				'targetedVocabularyIds',
				'targetedGrammarIds'
			],
			additionalProperties: false
		};
	} else if (gameMode === 'multiple-choice') {
		modeInstruction = `This is a MULTIPLE CHOICE exercise. Generate a direct ${activeLangName} sentence as "challengeText" (NEVER write instructions like "Translate this:"). Provide the correct English translation as "targetSentence". Also provide exactly 3 plausible but INCORRECT English translations as "distractors". The distractors should be similar enough to be challenging but clearly wrong. CRUCIAL: If the primary goal is to test a grammar rule, the distractors MUST be grammatically incorrect variations of the *target language* sentence instead of English translations, and the "targetSentence" should just be the correct ${activeLangName} sentence. If you do this, set "challengeText" to the direct English translation ONLY.`;
		vocabTagInstruction = `CRITICAL: In the "challengeText" (which is ${activeLangName} unless testing grammar), you MUST wrap the ${activeLangName} lemma form of targeted vocabulary words in a <vocab id="VOCAB_ID">...</vocab> tag. For example, if targeting vocabulary ID "123" with lemma "Hund", write: "Der <vocab id="123">Hund</vocab> bellt."`;
		jsonFormatBlock = `JSON format:
{
  "challengeText": "<${activeLangName} sentence with vocab tags>",
  "targetSentence": "<Correct English translation>",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "targetedVocabularyIds": ["<id1>"],
  "targetedGrammarIds": ["<id1>"]
}`;
		jsonSchemaObj = {
			type: 'object',
			properties: {
				challengeText: { type: 'string', description: `${activeLangName} sentence to translate` },
				targetSentence: { type: 'string', description: 'Correct English translation' },
				distractors: {
					type: 'array',
					items: { type: 'string' },
					description: '3 plausible but incorrect English translations'
				},
				targetedVocabularyIds: { type: 'array', items: { type: 'string' } },
				targetedGrammarIds: { type: 'array', items: { type: 'string' } }
			},
			required: [
				'challengeText',
				'targetSentence',
				'distractors',
				'targetedVocabularyIds',
				'targetedGrammarIds'
			],
			additionalProperties: false
		};
	} else if (gameMode === 'target-to-native') {
		modeInstruction = `You must generate a single, direct ${activeLangName} sentence for the user to translate into English. "challengeText" MUST be the ${activeLangName} sentence itself, NOT instructions like "Translate this sentence:". "targetSentence" MUST be the correct English translation.`;
		vocabTagInstruction = `CRITICAL: In the "challengeText" (which is ${activeLangName}), you MUST wrap the ${activeLangName} lemma form of targeted vocabulary words in a <vocab id="VOCAB_ID">...</vocab> tag. For example, if targeting vocabulary ID "123" with lemma "Hund", write: "Der <vocab id="123">Hund</vocab> bellt."`;
		jsonFormatBlock = `JSON format:
{
  "challengeText": "<${activeLangName} text>",
  "targetSentence": "<English translation>",
  "targetedVocabularyIds": ["<id1>", "<id2>"],
  "targetedGrammarIds": ["<id1>"]
}`;
		jsonSchemaObj = {
			type: 'object',
			properties: {
				challengeText: { type: 'string', description: `The ${activeLangName} text to translate` },
				targetSentence: { type: 'string', description: 'The English translation' },
				targetedVocabularyIds: { type: 'array', items: { type: 'string' } },
				targetedGrammarIds: { type: 'array', items: { type: 'string' } }
			},
			required: [
				'challengeText',
				'targetSentence',
				'targetedVocabularyIds',
				'targetedGrammarIds'
			],
			additionalProperties: false
		};
	} else {
		// native-to-target (default)
		modeInstruction = `You must generate a direct English sentence for the user to translate into ${activeLangName}. "challengeText" MUST be ONLY the English sentence itself (e.g. "I have a dog."), NEVER write instructions like "Translate this sentence:" or "Write a sentence describing...". "targetSentence" MUST be the correct ${activeLangName} translation.`;
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
			type: 'object',
			properties: {
				challengeText: { type: 'string', description: 'The English text to translate' },
				targetSentence: { type: 'string', description: `The ${activeLangName} translation` },
				targetedVocabularyIds: { type: 'array', items: { type: 'string' } },
				targetedGrammarIds: { type: 'array', items: { type: 'string' } }
			},
			required: [
				'challengeText',
				'targetSentence',
				'targetedVocabularyIds',
				'targetedGrammarIds'
			],
			additionalProperties: false
		};
	}

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

${sentenceConstraint}
${qualityConstraint}
${topicConstraint}${grammarConstraint}
Compose the ${activeLangName} text focusing on the "Mastered" and "Learning" concepts provided below. You are ALLOWED to use other natural ${activeLangName} vocabulary appropriate for a ${userLevel} student, even if it is not in the provided lists. However, you MUST ABSOLUTELY AVOID using any custom or user-provided words that are not explicitly present in the provided vocabulary lists below. If you think the user might have learned a specific obscure word elsewhere but it is not in these lists, do not use it.
CRITICAL THEMATIC INJECTION: The "Learning Vocabulary" list below is a POOL of words. You MUST choose ONE word from it to establish a central theme. Then, try to incorporate other words from the Learning Vocabulary list ONLY if they fit naturally within that theme.
CRITICAL GRAMMAR INJECTION: You MUST structurally incorporate the requested grammar rule(s) (either from the critical grammar constraint above, or from the Learning Grammar section) into the sentence. This is mandatory. Ensure the grammar rule is naturally applied. If an ID is provided (e.g., ID: g0), return it in the targetedGrammarIds array.
CRITICAL QUALITY INSTRUCTION: Prioritize sentence quality, natural flow, and logic over using every single word provided in the lists. Do NOT try to force or jam words together if they don't make sense. You DO NOT have to use all the words provided, just pick the ones that fit naturally and make logical sense.
${modeInstruction}

${vocabTagInstruction}

Mastered Vocab:
${masteredVocabList || 'Basic'}

Mastered Grammar:
${masteredGrammarList || 'Basic'}

Learning Vocabulary (USE WHAT FITS NATURALLY):
${learningVocabList || 'None'}

Learning Grammar (MANDATORY TO INCORPORATE):
${learningGrammarList || 'None'}

${jsonFormatBlock}`;

	return { systemPrompt, jsonSchemaObj };
}