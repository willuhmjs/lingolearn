export type GameMode = 'native-to-target' | 'target-to-native' | 'fill-blank' | 'multiple-choice';

function shuffleAndCap(list: string, maxItems: number): string {
	const lines = list.split('\n').filter(Boolean);
	for (let i = lines.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[lines[i], lines[j]] = [lines[j], lines[i]];
	}
	return lines.slice(0, maxItems).join('\n');
}

export function buildLessonPrompt({
	activeLangName,
	userLevel,
	gameMode,
	isAbsoluteBeginner,
	assignmentTopic,
	assignmentTargetGrammar,
	masteredVocabList,
	learningVocabList,
	knownVocabList,
	masteredGrammarList,
	learningGrammarList,
	additionalGrammarList
}: {
	activeLangName: string;
	userLevel: string;
	gameMode: GameMode;
	isAbsoluteBeginner: boolean;
	assignmentTopic: string | null;
	assignmentTargetGrammar: string[];
	masteredVocabList: string;
	learningVocabList: string;
	knownVocabList: string;
	masteredGrammarList: string;
	learningGrammarList: string;
	additionalGrammarList?: string;
}) {
	const isBeginner = userLevel === 'A1' || userLevel === 'A2';

	const sentenceConstraint = isAbsoluteBeginner
		? `Generate EXACTLY ONE very simple ${activeLangName} sentence (3-6 words, no run-ons) suitable for someone who is just starting to learn ${activeLangName}. Use only basic vocabulary like greetings, pronouns, simple verbs (sein, haben, heißen, kommen), and common nouns. The sentence MUST be a complete, standalone thought about a real daily-life situation (e.g. greeting someone, saying where you live, ordering food, introducing yourself). NEVER generate sentence fragments, dangling clauses, or abstract statements.`
		: isBeginner
			? `Generate EXACTLY ONE simple, natural ${activeLangName} sentence (no run-ons/semi-colons) as a challenge. The sentence MUST be a complete thought grounded in a concrete, everyday scenario — something a person would actually say in conversation, at work, while shopping, traveling, or socializing. NEVER generate orphan subordinate clauses (e.g. "If I have a book"), abstract fragments, or sentences that lack a clear real-world context.`
			: `Generate a natural, coherent ${activeLangName} sentence suitable for ${userLevel}. It can be a single complex sentence or, if it reads naturally, two short closely related sentences that form a logical mini-narrative. The result MUST read as something a native speaker would actually say or write in a real situation — conversation, email, news, storytelling, or daily life. NEVER generate orphan clauses or contextless fragments.`;

	const qualityConstraint = `
CRITICAL STYLE & TONE CONSTRAINT:
- The sentence(s) MUST make logical, real-world sense. NEVER produce a sentence that sounds absurd, surreal, or randomly cobbled together.
- Every sentence MUST be a COMPLETE, STANDALONE THOUGHT. Never output a dangling subordinate clause (e.g. "If I have a book", "When the weather is nice"), a noun phrase without a verb, or any fragment that leaves the reader waiting for more. If you use a subordinate clause, it MUST be paired with a main clause.
- Before outputting, mentally re-read the sentence and ask: "Would a native speaker ever actually say this in a real conversation or written text?" If not, rewrite it.
- Ground every sentence in a CONCRETE DAILY-LIFE SCENARIO. Good topics: greetings, introductions, ordering food/drinks, asking for directions, making plans, describing your day, talking about family/friends, shopping, travel, work, school, weather, hobbies, opinions on common topics.
- BAD examples (NEVER generate these): "If I have a book", "The big red house and the small cat", "When one learns a language", "A man with a dog". These are fragments or lack real conversational context.
- GOOD examples: "I'd like a coffee, please", "Where is the train station?", "My sister lives in Berlin", "Can you help me find the library?", "I usually go jogging in the morning".
- Emulate the style, depth, and conversational realism of AP Language classes.
- It is MUCH BETTER to use only 1 target vocabulary word in a natural sentence than to force 2-3 words into a sentence that sounds unnatural or nonsensical.`;

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
  "targetedVocabularyIds": ["v0"],
  "targetedGrammarIds": ["g0"]
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
		vocabTagInstruction = `CRITICAL: In the "challengeText" (which is ${activeLangName} unless testing grammar), you MUST wrap targeted vocabulary words in a <vocab id="VOCAB_ID">...</vocab> tag. IMPORTANT: Wrap the EXACT word form as it appears in the sentence — NOT the infinitive or dictionary form. For example, if targeting vocabulary ID "v0" with lemma "Hund", write: "Der <vocab id="v0">Hund</vocab> bellt." For verbs, tag the conjugated form: if targeting "gehen" and the sentence has "geht", write <vocab id="v0">geht</vocab>. SEPARABLE VERBS: If the targeted verb is separable and its stem and prefix appear in different positions (e.g. "Ich fange morgen an" for "anfangen"), tag ONLY the conjugated stem where it appears: <vocab id="v0">fange</vocab> — do NOT insert the full infinitive into the sentence.`;
		jsonFormatBlock = `JSON format:
{
  "challengeText": "<${activeLangName} sentence with vocab tags>",
  "targetSentence": "<Correct English translation>",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "targetedVocabularyIds": ["v0", "v1"],
  "targetedGrammarIds": ["g0"]
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
		vocabTagInstruction = `CRITICAL: In the "challengeText" (which is ${activeLangName}), you MUST wrap targeted vocabulary words in a <vocab id="VOCAB_ID">...</vocab> tag. IMPORTANT: Wrap the EXACT word form as it appears in the sentence — NOT the infinitive or dictionary form. For example, if targeting vocabulary ID "v0" with lemma "Hund", write: "Der <vocab id="v0">Hund</vocab> bellt." For verbs, tag the conjugated form: if targeting "gehen" and the sentence has "geht", write <vocab id="v0">geht</vocab>. SEPARABLE VERBS: If the targeted verb is separable and its stem and prefix appear in different positions (e.g. "Ich fange morgen an" for "anfangen"), tag ONLY the conjugated stem where it appears: <vocab id="v0">fange</vocab> — do NOT insert the full infinitive into the sentence.`;
		jsonFormatBlock = `JSON format:
{
  "challengeText": "<${activeLangName} text>",
  "targetSentence": "<English translation>",
  "targetedVocabularyIds": ["v0", "v1"],
  "targetedGrammarIds": ["g0"]
}`;
		jsonSchemaObj = {
			type: 'object',
			properties: {
				challengeText: { type: 'string', description: `The ${activeLangName} text to translate` },
				targetSentence: { type: 'string', description: 'The English translation' },
				targetedVocabularyIds: { type: 'array', items: { type: 'string' } },
				targetedGrammarIds: { type: 'array', items: { type: 'string' } }
			},
			required: ['challengeText', 'targetSentence', 'targetedVocabularyIds', 'targetedGrammarIds'],
			additionalProperties: false
		};
	} else {
		// native-to-target (default)
		modeInstruction = `You must generate a direct English sentence for the user to translate into ${activeLangName}. The "challengeText" MUST be exclusively in English (e.g. "I have a dog."). NEVER include ${activeLangName} words or instructions like "Translate this sentence:". The "targetSentence" MUST be the accurate ${activeLangName} translation.`;
		vocabTagInstruction = `CRITICAL TAGGING INSTRUCTION (English): In the "challengeText", identify the English equivalents of the targeted ${activeLangName} vocabulary and wrap them in <vocab id="VOCAB_ID">...</vocab> tags. 
- You MUST tag the English words that carry the meaning of the target word, even if the grammatical form changes (e.g., if targeting "laufen" [to run], you might tag "running" or "runs" in the English sentence).
- Example: targeting ID "v0" ("Hund" -> "dog"): "The <vocab id="v0">dog</vocab> is barking."
- MULTI-WORD MEANINGS: If an English equivalent consists of multiple words, wrap them ALL in a single tag. Example: "I watched the <vocab id="v1">television program</vocab> last night."
- DO NOT put ${activeLangName} words inside the English challengeText.`;
		jsonFormatBlock = `JSON format:
{
  "challengeText": "<English text>",
  "targetSentence": "<${activeLangName} translation>",
  "targetedVocabularyIds": ["v0", "v1"],
  "targetedGrammarIds": ["g0"]
}`;
		jsonSchemaObj = {
			type: 'object',
			properties: {
				challengeText: { type: 'string', description: 'The English text to translate' },
				targetSentence: { type: 'string', description: `The ${activeLangName} translation` },
				targetedVocabularyIds: { type: 'array', items: { type: 'string' } },
				targetedGrammarIds: { type: 'array', items: { type: 'string' } }
			},
			required: ['challengeText', 'targetSentence', 'targetedVocabularyIds', 'targetedGrammarIds'],
			additionalProperties: false
		};
	}

	const beginnerGuidance = isAbsoluteBeginner
		? `\nABSOLUTE BEGINNER MODE: This student is just starting to learn ${activeLangName}. They may know almost nothing.
- Use extremely simple vocabulary (greetings, personal pronouns, basic verbs like sein/haben/heißen)
- Sentences should be 3-6 words maximum
- For native-to-target mode: use simple conversational English sentences like "Good morning!", "My name is Anna.", "I live in Berlin.", "I would like water, please.", "Where is the school?"
- For target-to-native mode: use simple conversational ${activeLangName} like "Guten Morgen!", "Ich heiße Anna.", "Ich wohne in Berlin.", "Wo ist die Schule?"
- For fill-blank: blank only ONE very basic word
- For multiple-choice: make distractors clearly different from the correct answer
- Focus on building confidence — correctness over complexity\n`
		: '';

	const systemPrompt = `Act as an expert ${activeLangName} tutor for a ${userLevel} student. Output ONLY strictly valid JSON, no markdown or extra text.
${beginnerGuidance}

${sentenceConstraint}
${qualityConstraint}
${topicConstraint}${grammarConstraint}
Compose the ${activeLangName} text by HEAVILY prioritizing the "Learning Vocabulary" provided below. These are the target words the student is currently focusing on.
CRITICAL THEMATIC INJECTION: Your primary goal is to teach the words in the "Learning Vocabulary" list. You MUST use at least one word from this list. You MAY use 2-3 if they fit together naturally in a coherent, realistic scenario — but NEVER force multiple target words into a sentence if doing so produces an awkward, contrived, or illogical result. It is always better to write a perfect sentence with 1 target word than a strange sentence with 3. Build a realistic, high-quality scenario around the chosen target word(s). You may also use words from the "Mastered" list or other common ${activeLangName} words appropriate for a ${userLevel} student to ensure natural flow.
CRITICAL GRAMMAR INJECTION: You MUST structurally incorporate the requested grammar rule(s) (either from the critical grammar constraint above, or from the Learning Grammar section) into the sentence. This is mandatory. Ensure the grammar rule is naturally applied. You MUST identify ANY and ALL grammar rules used in your sentence (from BOTH the Learning and Mastered Grammar lists) and return their IDs (e.g., "g0", "g1") in the "targetedGrammarIds" array.
CRITICAL QUALITY INSTRUCTION: Prioritize sentence quality, natural flow, and logic above all else. The sentence MUST sound like something a native speaker would genuinely say or write. Do NOT force unrelated vocabulary words into the same sentence — if words don't naturally belong together in a coherent scenario, pick only the one that works best and build a good sentence around it. The sentence must be authentic and pedagogically useful.
SELF-CHECK: After composing your sentence, verify: (1) Is it a complete sentence with a subject and verb, not a fragment or dangling clause? (2) Does it describe a concrete, real-world situation? (3) Would a native speaker actually say this in daily life? If any answer is no, rewrite it.
${modeInstruction}

${vocabTagInstruction}

Mastered Vocab:
${shuffleAndCap(masteredVocabList || '', 10) || 'Basic'}

Mastered Grammar:
${masteredGrammarList || 'Basic'}

Learning Vocabulary (USE WHAT FITS NATURALLY):
${learningVocabList || 'None'}

Review Vocabulary (words the student has seen before — consolidate by using naturally if they fit; include their IDs in targetedVocabularyIds):
${knownVocabList || 'None'}

Learning Grammar (MANDATORY TO INCORPORATE):
${learningGrammarList || 'None'}
${additionalGrammarList ? `\nAdditional Grammar Reference (for identification only — if your sentence uses any of these concepts, include their IDs in targetedGrammarIds even if they are not in the Learning or Mastered lists):\n${additionalGrammarList}` : ''}

${jsonFormatBlock}`;

	return { systemPrompt, jsonSchemaObj };
}
