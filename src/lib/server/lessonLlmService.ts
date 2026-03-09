import { generateChatCompletion } from '$lib/server/llm';
import { processVocabEnrichment } from './vocabProcessor';
import type { GameMode } from './promptBuilder';

export async function generateLessonStream({
	userId,
	systemPrompt,
	jsonSchemaObj,
	requestSignal,
	targetedVocabulary,
	targetedGrammar,
	allVocabulary,
	gameMode,
	idMap,
	userLevel,
	isAbsoluteBeginner,
	activeLangName,
	activeLanguageId,
	masteredVocab,
	learningVocab
}: {
	userId: string;
	systemPrompt: string;
	jsonSchemaObj: Record<string, unknown>;
	requestSignal: AbortSignal;
	targetedVocabulary: any[];
	targetedGrammar: any[];
	allVocabulary: any[];
	gameMode: GameMode;
	idMap: Record<string, string>;
	userLevel: string;
	isAbsoluteBeginner: boolean;
	activeLangName: string;
	activeLanguageId: string;
	masteredVocab: any[];
	learningVocab: any[];
}) {
	const llmResponse = await generateChatCompletion({
		userId,
		messages: [{ role: 'user', content: 'Generate the next challenge based on my current level.' }],
		systemPrompt,
		jsonSchema: jsonSchemaObj,
		stream: false,
		signal: requestSignal
	});

	const data = llmResponse;
	let fullContent = data.choices?.[0]?.message?.content || '';

	if (!fullContent) {
		console.error('LLM returned empty content. Full response:', JSON.stringify(data));
		throw new Error('LLM returned an empty response. Please try again.');
	}

	// Strip markdown JSON block if present
	const firstBrace = fullContent.indexOf('{');
	const lastBrace = fullContent.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace !== -1) {
		fullContent = fullContent.slice(firstBrace, lastBrace + 1);
	} else {
		console.error('No JSON braces found in LLM response:', fullContent);
		throw new Error('LLM response was not valid JSON. Please try again.');
	}

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
							allVocabulary,
							gameMode,
							idMap,
							userLevel,
							isAbsoluteBeginner
						}
					}) + '\n'
				)
			);

			try {
				if (fullContent) {
					controller.enqueue(
						new TextEncoder().encode(JSON.stringify({ type: 'chunk', content: fullContent }) + '\n')
					);
				}

				// Vocab enrichment: look up words from generated text in the full Vocabulary table
				try {
					let cleaned = fullContent;
					const firstBrace = cleaned.indexOf('{');
					const lastBrace = cleaned.lastIndexOf('}');
					if (firstBrace !== -1 && lastBrace !== -1) {
						cleaned = cleaned.slice(firstBrace, lastBrace + 1);
					}

					if (!cleaned) {
						throw new SyntaxError('Empty JSON content after stream completion.');
					}

					const parsedResponse = JSON.parse(cleaned);

					// Extract only the text that is in the target language
					let targetLanguageText = '';
					if (gameMode === 'native-to-target') {
						targetLanguageText = parsedResponse.targetSentence || '';
					} else if (gameMode === 'target-to-native') {
						targetLanguageText = parsedResponse.challengeText || '';
					} else if (gameMode === 'multiple-choice') {
						if (parsedResponse.targetedGrammarIds && parsedResponse.targetedGrammarIds.length > 0) {
							targetLanguageText = parsedResponse.targetSentence || '';
						} else {
							targetLanguageText = parsedResponse.challengeText || '';
						}
					} else {
						targetLanguageText = parsedResponse.targetSentence || '';
					}

					processVocabEnrichment(
						userId,
						targetLanguageText,
						activeLangName,
						activeLanguageId,
						masteredVocab,
						learningVocab,
						(data) => {
							controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + '\n'));
						}
					);
				} catch (enrichErr) {
					if (enrichErr instanceof SyntaxError) {
						console.error('Vocab enrichment skipped: Incomplete or missing JSON from LLM.');
					} else {
						console.error('Vocab enrichment failed:', enrichErr);
					}
				}

				controller.close();
			} catch (e) {
				controller.error(e);
			}
		},
		cancel() {
			// Stream cancelled by client
		}
	});

	return stream;
}