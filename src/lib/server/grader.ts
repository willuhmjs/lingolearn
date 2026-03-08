import { prisma } from './prisma';

type SrsState = 'UNSEEN' | 'LEARNING' | 'KNOWN' | 'MASTERED';
type Vocabulary = {
	id: string;
	lemma: string;
	meanings?: any[];
	partOfSpeech: string | null;
	gender: 'der' | 'die' | 'das' | null;
	plural: string | null;
	metadata: import('@prisma/client').Prisma.JsonValue | null;
	createdAt: Date;
	updatedAt: Date;
};
type GrammarRule = {
	id: string;
	title: string;
	description: string | null;
	level: string;
	createdAt: Date;
	updatedAt: Date;
};

export type GameMode = 'native-to-target' | 'target-to-native' | 'fill-blank' | 'multiple-choice';

export interface EvaluationPayload {
	globalScore: number;
	vocabularyUpdates: { id: string; score: number; eloBefore?: number; eloAfter?: number }[];
	grammarUpdates: { id: string; score: number; eloBefore?: number; eloAfter?: number }[];
	extraVocabLemmas?: string[];
	feedback: string;
	feedbackEnglish?: string;
}

const normalizeText = (text: string) => {
	return text
		.replace(/ß/g, 'ss')
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/Ä/g, 'Ae')
		.replace(/Ö/g, 'Oe')
		.replace(/Ü/g, 'Ue');
};

/**
 * Builds the system prompt and user message for evaluation, without calling the LLM.
 * Used by the streaming submit-answer endpoint.
 */
export function buildEvaluationPrompt(
	userInput: string,
	targetSentence: string,
	targetedVocabulary: Vocabulary[],
	targetedGrammar: GrammarRule[],
	gameMode: GameMode = 'native-to-target',
	userLevel: string = 'A1',
	activeLanguageName: string,
	nativeLanguage: string = 'English'
): { systemPrompt: string; userMessage: string; idMap: Record<string, string> } {
	// Build short ID maps so the LLM sees tiny tokens like "v0" instead of full UUIDs
	const idMap: Record<string, string> = {}; // short -> real
	targetedVocabulary.forEach((v, i) => {
		idMap[`v${i}`] = v.id;
	});
	targetedGrammar.forEach((g, i) => {
		idMap[`g${i}`] = g.id;
	});

	const vocabList = targetedVocabulary.map((v, i) => `- ${v.lemma} (ID: v${i})`).join('\n');
	const grammarList = targetedGrammar.map((g, i) => `- ${g.title} (ID: g${i})`).join('\n');

	const isAbsoluteBeginner = userLevel === 'A1';
	const beginnerEncouragement = isAbsoluteBeginner
		? `\nIMPORTANT BEGINNER CONTEXT: This student is at A1 level and may be just starting out. Be extra encouraging in your feedback. Celebrate what they got right before mentioning errors. Use simple language in feedback. If they attempted something even partially correct, give partial credit (at least 0.3). The goal is to build confidence while learning.\n`
		: '';

	if (gameMode === 'fill-blank') {
		const systemPrompt = `You are an expert language tutor evaluating a student's fill-in-the-blank answers.
You must output ONLY strictly valid JSON. Do not include markdown formatting or extra text.
${beginnerEncouragement}

Your task:
The student was given a ${activeLanguageName} sentence with blanks for targeted vocabulary words. They provided answers for each blank.
Compare their answers against the expected complete ${activeLanguageName} sentence.
Calculate a global accuracy score between 0.0 and 1.0. Be forgiving of minor typos and capitalization errors.
Note: Do not penalize the user if they use ASCII equivalents for ${activeLanguageName} special characters (e.g., 'ss' instead of 'ß', 'ae' instead of 'ä', 'oe' instead of 'ö', 'ue' instead of 'ü', or their uppercase equivalents like 'Ae' for 'Ä', 'Ue' for 'Ü', etc.). Treat these as ENTIRELY correct — they MUST receive a score of 1.0 for that vocabulary item.
IMPORTANT: Capitalization errors (e.g., writing "Gluecklich" instead of "glücklich") are MINOR issues. If the student wrote the correct word with only a capitalization difference, the vocabulary score for that word MUST be at least 0.8. Do NOT give a score of 0 for capitalization-only errors.
SCORING CONSISTENCY: Each vocabulary/grammar item score must be consistent with the global score. If the global score is above 0.8, no individual item that the student attempted correctly (even with minor issues) should receive a score below 0.5.
Provide helpful, concise feedback in ${activeLanguageName} ("feedback") and ${nativeLanguage} ("feedbackEnglish").
For vocabularyUpdates and grammarUpdates, provide a score between 0.0 and 1.0 depending on how well they used the item. Score each item INDEPENDENTLY.
If the user correctly used any OTHER ${activeLanguageName} words by coincidence that are not in the targeted list, output their base forms (lemmas) with proper capitalization (e.g. nouns capitalized in German) in the "extraVocabLemmas" array.

IMPORTANT: "feedback" MUST be the very first key in your JSON response.

Targeted Vocabulary:
${vocabList}

Targeted Grammar Rules:
${grammarList}

JSON format:
{
  "feedback": "<string (${activeLanguageName} feedback)>",
  "feedbackEnglish": "<string (${nativeLanguage} translation of feedback)>",
  "globalScore": <number>,
  "vocabularyUpdates": [ { "id": "<vocabulary ID>", "score": <number (0.0 to 1.0)> } ],
  "grammarUpdates": [ { "id": "<grammar ID>", "score": <number (0.0 to 1.0)> } ],
  "extraVocabLemmas": ["<lemma1>", "<lemma2>"]
}`;

		const userMessage = `Complete ${activeLanguageName} sentence: ${normalizeText(targetSentence)}\nUser's blank answers: ${normalizeText(userInput)}`;
		return { systemPrompt, userMessage, idMap };
	}

	if (gameMode === 'multiple-choice') {
		const systemPrompt = `You are an expert language tutor evaluating a student's multiple choice answer.
You must output ONLY strictly valid JSON. Do not include markdown formatting or extra text.
${beginnerEncouragement}

Your task:
The student was shown a ${activeLanguageName} sentence and chose a ${nativeLanguage} translation from multiple options.
Compare their chosen answer to the correct translation.
If they chose correctly, score 1.0. If wrong, score 0.0.
Provide brief feedback in ${activeLanguageName} ("feedback") and ${nativeLanguage} ("feedbackEnglish") explaining why the correct answer is right.
For vocabularyUpdates, provide a score of 1.0 or 0.0 based on whether they got the question right.
Since this is a recognition task (${activeLanguageName} to ${nativeLanguage}), do NOT evaluate grammar rules. Always return an empty array for "grammarUpdates".
If the user correctly recognized any OTHER ${activeLanguageName} words by coincidence that are not in the targeted list, output their base forms (lemmas) with proper capitalization (e.g. nouns capitalized in German) in the "extraVocabLemmas" array.

IMPORTANT: "feedback" MUST be the very first key in your JSON response.

Targeted Vocabulary:
${vocabList}

Targeted Grammar Rules:
${grammarList}

JSON format:
{
  "feedback": "<string (${activeLanguageName} feedback)>",
  "feedbackEnglish": "<string (${nativeLanguage} translation of feedback)>",
  "globalScore": <number>,
  "vocabularyUpdates": [ { "id": "<vocabulary ID>", "score": <number (0.0 to 1.0)> } ],
  "grammarUpdates": [ { "id": "<grammar ID>", "score": <number (0.0 to 1.0)> } ],
  "extraVocabLemmas": ["<lemma1>", "<lemma2>"]
}`;

		const userMessage = `Correct ${nativeLanguage} translation: ${targetSentence}\nUser's chosen answer: ${userInput}`;
		return { systemPrompt, userMessage, idMap };
	}

	// Translation modes (native-to-target, target-to-native)
	const isNativeToTarget = gameMode === 'native-to-target';
	const userLanguage = isNativeToTarget ? '${activeLanguageName}' : nativeLanguage;
	const targetLanguage = isNativeToTarget ? '${activeLanguageName}' : nativeLanguage;

	const asciiNote = isNativeToTarget
		? `Note: Do not penalize the user if they use ASCII equivalents for ${activeLanguageName} special characters (e.g., 'ss' instead of 'ß', 'ae' instead of 'ä', 'oe' instead of 'ö', 'ue' instead of 'ü', or their uppercase equivalents like 'Ae' for 'Ä'). Treat these as entirely correct.`
		: '';

	const grammarNote = isNativeToTarget
		? ''
		: `Note: Since this is a ${activeLanguageName}-to-${nativeLanguage} translation, do NOT evaluate grammar rules. Always return an empty array for "grammarUpdates".`;

	const vocabScoringNote = isNativeToTarget
		? ''
		: `IMPORTANT: For vocabulary scoring in ${activeLanguageName}-to-${nativeLanguage} mode, score each targeted vocabulary word INDEPENDENTLY based solely on whether the user correctly conveyed its meaning in ${nativeLanguage}. Do NOT penalize a vocabulary word for unrelated errors elsewhere in the sentence. The user is translating INTO ${nativeLanguage}, so they will not write the ${activeLanguageName} words themselves — instead, check whether the ${nativeLanguage} translation accurately reflects the meaning of each targeted ${activeLanguageName} vocabulary word. For example, if "die Klasse" is targeted and the user writes "the class", that vocabulary word MUST receive a score of 1.0, even if other parts of the sentence contain errors (like writing "Ist" instead of "Is"). Each vocabulary score should reflect ONLY whether that specific word's meaning was correctly translated.`;

	const helpNote = isNativeToTarget
		? `Note: The user is allowed to ask for a ${nativeLanguage} translation, or provide a ${nativeLanguage} translation of the sentence alongside their answer. If they ask for a translation or provide a ${nativeLanguage} translation because they are stuck, do not penalize them for it. Provide the translation in the feedback and give a neutral score (e.g., 0.5) to keep them motivated, rather than failing them.`
		: `Note: The user is allowed to ask for help or a ${activeLanguageName} translation. If they do, provide the translation in the feedback and give a neutral score (e.g., 0.5) to keep them motivated, rather than failing them.`;

	const extraVocabNote = isNativeToTarget
		? `If the user correctly used any OTHER ${activeLanguageName} words by coincidence that are not in the targeted list, output their base forms (lemmas) with proper capitalization (e.g. nouns capitalized in German) in the "extraVocabLemmas" array.`
		: `If the user demonstrated understanding of any OTHER ${activeLanguageName} words from the original sentence (by translating them correctly), output the ORIGINAL ${activeLanguageName} base forms (lemmas) with proper capitalization (e.g. nouns capitalized in German) in the "extraVocabLemmas" array. Do NOT output ${nativeLanguage} words in this array.`;

	const systemPrompt = `You are an expert language tutor evaluating a student's ${userLanguage} translation.
You must output ONLY strictly valid JSON. Do not include markdown formatting or extra text.
${beginnerEncouragement}

Your task:
Evaluate the user's ${userLanguage} input against the target expected ${targetLanguage} output.
Calculate a global accuracy score between 0.0 and 1.0. Be forgiving of minor mistakes like slight typos, capitalization errors, or minor word order issues that do not change the core meaning. Do not penalize minor errors harshly; keep the score proportional to the overall understanding shown.
Assess if the user correctly used the targeted vocabulary and grammar rules. Give a decimal score between 0.0 and 1.0 for each item in vocabularyUpdates and grammarUpdates. Score each vocabulary and grammar item INDEPENDENTLY — do not penalize one item for errors related to a different item.
Provide helpful, concise feedback in ${activeLanguageName} ("feedback") and ${nativeLanguage} ("feedbackEnglish").
${extraVocabNote}
${asciiNote}
${grammarNote}
${vocabScoringNote}
${helpNote}

IMPORTANT: "feedback" MUST be the very first key in your JSON response.

Targeted Vocabulary:
${vocabList}

Targeted Grammar Rules:
${grammarList}

JSON format:
{
  "feedback": "<string (${activeLanguageName} feedback)>",
  "feedbackEnglish": "<string (${nativeLanguage} translation of feedback)>",
  "globalScore": <number>,
  "vocabularyUpdates": [ { "id": "<vocabulary ID>", "score": <number (0.0 to 1.0)> } ],
  "grammarUpdates": [ { "id": "<grammar ID>", "score": <number (0.0 to 1.0)> } ],
  "extraVocabLemmas": ["<${activeLanguageName} lemma 1>", "<${activeLanguageName} lemma 2>"]
}`;

	const normalizedTarget = isNativeToTarget ? normalizeText(targetSentence) : targetSentence;
	const normalizedInput = isNativeToTarget ? normalizeText(userInput) : userInput;

	const userMessage = `Target Expected Output: ${normalizedTarget}\nUser Input: ${normalizedInput}`;
	return { systemPrompt, userMessage, idMap };
}

/**
 * Parses raw LLM content into a typed EvaluationPayload.
 */
export function parseEvaluationResponse(content: string): EvaluationPayload {
	const cleanedContent = content
		.replace(/^```json\s*/i, '')
		.replace(/```\s*$/i, '')
		.trim();
		
	let payload;
	try {
		payload = JSON.parse(cleanedContent);
	} catch (e) {
		// Attempt to recover truncated JSON from streaming
		try {
			payload = JSON.parse(cleanedContent + '}');
		} catch (e2) {
			try {
				payload = JSON.parse(cleanedContent + '"}');
			} catch (e3) {
				try {
					payload = JSON.parse(cleanedContent + '"]]}');
				} catch (e4) {
					throw e; // throw original error if recovery fails
				}
			}
		}
	}

	// Ensure backwards compatibility if LLM returns "success" (boolean) instead of "score"
	const mapItem = (item: { id: string; score?: number; success?: boolean }) => ({
		id: item.id,
		score: typeof item.score === 'number' ? item.score : item.success ? 1.0 : 0.0
	});

	const result: EvaluationPayload = {
		globalScore: payload.globalScore ?? 0,
		vocabularyUpdates: (payload.vocabularyUpdates || []).map(mapItem),
		grammarUpdates: (payload.grammarUpdates || []).map(mapItem),
		extraVocabLemmas: (payload.extraVocabLemmas || []).map((l: string) =>
			l.replace(/^[.,!?;:'"()[\]{}-]+|[.,!?;:'"()[\]{}-]+$/g, '')
		),
		feedback: payload.feedback || '',
		feedbackEnglish: payload.feedbackEnglish || ''
	};

	// Reconcile contradictory scores: if globalScore is high but individual items
	// are scored at 0, the LLM is being inconsistent. Bump low scores to at least
	// match the global signal (e.g. capitalize-only errors scored at 0 despite 95% global).
	if (result.globalScore >= 0.8) {
		const minItemScore = 0.5;
		result.vocabularyUpdates = result.vocabularyUpdates.map((u) => ({
			...u,
			score: Math.max(u.score, minItemScore)
		}));
		result.grammarUpdates = result.grammarUpdates.map((u) => ({
			...u,
			score: Math.max(u.score, minItemScore)
		}));
	}

	return result;
}

export function mapLevelToElo(level: string): number {
	const levels: Record<string, number> = {
		A1: 1000,
		A2: 1200,
		B1: 1400,
		B2: 1600,
		C1: 1800,
		C2: 2000
	};
	return levels[level.toUpperCase()] || 1000;
}

const K_FACTOR = 256;

function calculateNewElo(
	currentElo: number,
	score: number,
	baseDifficulty: number,
	gameMode: string
): number {
	const expectedScore = 1 / (1 + Math.pow(10, (baseDifficulty - currentElo) / 400));

	let kMultiplier = 1.0;
	if (gameMode === 'multiple-choice') kMultiplier = 0.5; // easier, less reward/penalty
	if (gameMode === 'native-to-target') kMultiplier = 1.2; // harder, more reward/penalty

	const effectiveK = K_FACTOR * kMultiplier;
	return currentElo + effectiveK * (score - expectedScore);
}

export function deriveSrsState(eloRating: number, baseDifficulty: number): SrsState {
	const competence = eloRating - baseDifficulty;
	if (competence < 50) return 'LEARNING';
	if (competence < 150) return 'KNOWN';
	return 'MASTERED';
}

export function calculateNextReviewDate(eloRating: number, baseDifficulty: number): Date {
	const competence = eloRating - baseDifficulty;
	const intervalInDays = Math.max(1, Math.floor(Math.pow(2, competence / 50)));
	const nextDate = new Date();
	nextDate.setDate(nextDate.getDate() + intervalInDays);
	return nextDate;
}

export async function updateSrsMetrics(userId: string, vocabularyId: string, score: number) {
	const currentProgress = await prisma.userVocabularyProgress.findUnique({
		where: { userId_vocabularyId: { userId, vocabularyId } }
	});

	let { interval = 0, easeFactor = 2.5, consecutiveCorrect = 0 } = currentProgress || {};

	// SM-2 logic
	// Map score (0-1) to grade (0-5)
	const grade = Math.round(score * 5);

	if (grade >= 3) {
		// Correct
		if (consecutiveCorrect === 0) {
			interval = 1;
		} else if (consecutiveCorrect === 1) {
			interval = 6;
		} else {
			interval = Math.round(interval * easeFactor);
		}
		consecutiveCorrect++;
	} else {
		// Incorrect
		consecutiveCorrect = 0;
		interval = 1;
	}

	easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
	if (easeFactor < 1.3) easeFactor = 1.3;

	const nextReviewDate = new Date();
	nextReviewDate.setDate(nextReviewDate.getDate() + interval);

	await prisma.userVocabularyProgress.upsert({
		where: { userId_vocabularyId: { userId, vocabularyId } },
		create: {
			userId,
			vocabularyId,
			interval,
			easeFactor,
			consecutiveCorrect,
			nextReviewDate
		},
		update: {
			interval,
			easeFactor,
			consecutiveCorrect,
			nextReviewDate
		}
	});
}

/**
 * Updates the user's database records based on the evaluation payload.
 * Adjusts Elo ratings and SRS states for targeted Vocabulary and Grammar rules.
 */
export async function updateEloRatings(
	userId: string,
	payload: EvaluationPayload,
	gameMode: string = 'native-to-target'
) {
	console.log(`Updating Elos for user ${userId} with payload:`, JSON.stringify(payload, null, 2));
	for (const vocabUpdate of payload.vocabularyUpdates || []) {
		try {
			// Ensure the Vocabulary exists
			const vocabExists = await prisma.vocabulary.findUnique({
				where: { id: vocabUpdate.id }
			});

			if (!vocabExists) {
				await prisma.vocabulary.create({
					data: {
						id: vocabUpdate.id,
						lemma: vocabUpdate.id // Fallback to id if lemma isn't available
					}
				});
			}

			// We don't have CEFR levels for Vocabulary, so we assume an average 1000 base difficulty for words
			const baseDifficulty = 1000;

			const userVocab = await prisma.userVocabulary.findUnique({
				where: { userId_vocabularyId: { userId, vocabularyId: vocabUpdate.id } }
			});

			const currentElo = userVocab?.eloRating ?? baseDifficulty;

			const newElo = calculateNewElo(currentElo, vocabUpdate.score, baseDifficulty, gameMode);
			const newState = deriveSrsState(newElo, baseDifficulty);
			const nextReviewDate = calculateNextReviewDate(newElo, baseDifficulty);

			vocabUpdate.eloBefore = currentElo;
			vocabUpdate.eloAfter = newElo;

			await updateSrsMetrics(userId, vocabUpdate.id, vocabUpdate.score);

			await prisma.userVocabulary.upsert({
				where: { userId_vocabularyId: { userId, vocabularyId: vocabUpdate.id } },
				create: {
					userId,
					vocabularyId: vocabUpdate.id,
					eloRating: newElo,
					srsState: newState,
					nextReviewDate
				},
				update: {
					eloRating: newElo,
					srsState: newState,
					nextReviewDate
				}
			});
		} catch (err) {
			console.error(`Failed to update user vocabulary ${vocabUpdate.id}:`, err);
		}
	}

	// Skip grammar updates for target-to-native and multiple-choice — only award grammar credit for native-to-target and fill-blank
	if (gameMode === 'target-to-native' || gameMode === 'multiple-choice') {
		console.log(`Skipping grammar updates for ${gameMode} mode`);
	} else {
		for (const grammarUpdate of payload.grammarUpdates || []) {
			try {
				// Ensure the GrammarRule exists
				const grammarExists = await prisma.grammarRule.findUnique({
					where: { id: grammarUpdate.id }
				});

				if (!grammarExists) {
					await prisma.grammarRule.create({
						data: {
							id: grammarUpdate.id,
							title: grammarUpdate.id // Fallback to id if title isn't available
						}
					});
				}

				const baseDifficulty = mapLevelToElo(grammarExists?.level || 'A1');

				const userGrammar = await prisma.userGrammarRule.findUnique({
					where: { userId_grammarRuleId: { userId, grammarRuleId: grammarUpdate.id } }
				});

				const currentElo = userGrammar?.eloRating ?? baseDifficulty;

				const newElo = calculateNewElo(currentElo, grammarUpdate.score, baseDifficulty, gameMode);
				const newState = deriveSrsState(newElo, baseDifficulty);
				const nextReviewDate = calculateNextReviewDate(newElo, baseDifficulty);

				grammarUpdate.eloBefore = currentElo;
				grammarUpdate.eloAfter = newElo;

				await prisma.userGrammarRule.upsert({
					where: { userId_grammarRuleId: { userId, grammarRuleId: grammarUpdate.id } },
					create: {
						userId,
						grammarRuleId: grammarUpdate.id,
						eloRating: newElo,
						srsState: newState,
						nextReviewDate
					},
					update: {
						eloRating: newElo,
						srsState: newState,
						nextReviewDate
					}
				});
			} catch (err) {
				console.error(`Failed to update user grammar rule ${grammarUpdate.id}:`, err);
			}
		}
	}

	// Process any extra vocabulary the user correctly used by coincidence
	for (const lemma of payload.extraVocabLemmas || []) {
		if (!lemma) continue;
		try {
			// Look up the word in the global vocabulary
			let vocabExists = await prisma.vocabulary.findFirst({
				where: { lemma: lemma }
			});

			if (!vocabExists) {
				vocabExists = await prisma.vocabulary.create({
					data: { lemma: lemma }
				});
			}

			const baseDifficulty = 1000;

			const userVocab = await prisma.userVocabulary.findUnique({
				where: { userId_vocabularyId: { userId, vocabularyId: vocabExists.id } }
			});

			const currentElo = userVocab?.eloRating ?? baseDifficulty;

			// A coincidentally correct usage implies success (score = 1.0)
			// But maybe a lower multiplier so it's not a huge jump? No, standard update is fine.
			const newElo = calculateNewElo(currentElo, 1.0, baseDifficulty, gameMode);
			const newState = deriveSrsState(newElo, baseDifficulty);
			const nextReviewDate = calculateNextReviewDate(newElo, baseDifficulty);

			await updateSrsMetrics(userId, vocabExists.id, 1.0);

			// We don't currently return extra vocab updates in the API response's main arrays,
			// but we could if we wanted to show them. For now just update DB.

			await prisma.userVocabulary.upsert({
				where: { userId_vocabularyId: { userId, vocabularyId: vocabExists.id } },
				create: {
					userId,
					vocabularyId: vocabExists.id,
					eloRating: newElo,
					srsState: newState,
					nextReviewDate
				},
				update: {
					eloRating: newElo,
					srsState: newState,
					nextReviewDate
				}
			});
		} catch (err) {
			console.error(`Failed to process extra vocab lemma ${lemma}:`, err);
		}
	}
}
