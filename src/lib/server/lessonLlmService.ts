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
	isEarlyReview,
	activeLangName,
	activeLanguageId,
	masteredVocab,
	learningVocab,
	useLocalLlm = false,
	onUsage
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
	isEarlyReview: boolean;
	activeLangName: string;
	activeLanguageId: string;
	masteredVocab: any[];
	learningVocab: any[];
	useLocalLlm?: boolean;
	onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void;
}) {
	const llmResponse = await generateChatCompletion({
		userId,
		messages: [{ role: 'user', content: 'Generate the next challenge based on my current level.' }],
		systemPrompt,
		jsonSchema: jsonSchemaObj,
		stream: false,
		signal: requestSignal,
		addLanguageConstraint: true,
		onUsage
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

	// Tracks whether the client has cancelled the stream. Used to guard controller
	// calls after cancellation — calling enqueue/close/error on a cancelled
	// ReadableStream controller throws synchronously and can produce an unhandled
	// rejection that crashes the Node.js process.
	let streamCancelled = false;

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
							isAbsoluteBeginner,
							isEarlyReview
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

				// Vocab enrichment: look up words from generated text in the full Vocabulary table.
				// Must always complete even after a client disconnect — it writes to the shared DB
				// and records good-will token usage. The outer .catch() is a final safety net that
				// prevents any error escaping to the process-level unhandledRejection handler.
				const enrichmentPromise = (async () => {
					try {
						let cleaned = fullContent;
						const fb = cleaned.indexOf('{');
						const lb = cleaned.lastIndexOf('}');
						if (fb !== -1 && lb !== -1) {
							cleaned = cleaned.slice(fb, lb + 1);
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

						await processVocabEnrichment(
							userId,
							targetLanguageText,
							activeLangName,
							activeLanguageId,
							masteredVocab,
							learningVocab,
							(chunkData) => {
								if (!streamCancelled) {
									try {
										controller.enqueue(new TextEncoder().encode(JSON.stringify(chunkData) + '\n'));
									} catch {
										// Stream closed between the guard check and the enqueue; safe to ignore.
									}
								}
							},
							useLocalLlm,
							!useLocalLlm // chargeQuota: record good-will tokens only for public LLM users
						);
					} catch (enrichErr) {
						if (enrichErr instanceof SyntaxError) {
							console.error('Vocab enrichment skipped: Incomplete or missing JSON from LLM.');
						} else {
							console.error('Vocab enrichment failed:', enrichErr);
						}
					}
				})().catch((err) => {
					console.error('Vocab enrichment unhandled error:', err);
				});

				await enrichmentPromise;

				if (!streamCancelled) {
					try { controller.close(); } catch { /* already closed or cancelled */ }
				}
			} catch (e) {
				if (!streamCancelled) {
					try { controller.error(e); } catch { /* already errored or cancelled */ }
				}
			}
		},
		cancel() {
			streamCancelled = true;
		}
	});

	return stream;
}
