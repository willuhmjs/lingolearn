import { describe, it, expect } from 'vitest';
import { buildLessonPrompt, type GameMode } from '../../src/lib/server/promptBuilder';

const BASE_PARAMS = {
	activeLangName: 'German',
	userLevel: 'A1',
	isAbsoluteBeginner: false,
	assignmentTopic: null,
	assignmentTargetGrammar: [],
	masteredVocabList: '- der Hund (dog)\n- die Katze (cat)',
	learningVocabList: '- das Buch (book) - ID: v0',
	knownVocabList: '',
	masteredGrammarList: '- Nominative Case (subject form) - ID: g0',
	learningGrammarList: '- Accusative Case (direct object) - ID: g1',
	additionalGrammarList: ''
};

describe('buildLessonPrompt', () => {
	describe('return shape', () => {
		it('returns systemPrompt and jsonSchemaObj', () => {
			const result = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'native-to-target' });
			expect(result).toHaveProperty('systemPrompt');
			expect(result).toHaveProperty('jsonSchemaObj');
			expect(typeof result.systemPrompt).toBe('string');
			expect(typeof result.jsonSchemaObj).toBe('object');
		});
	});

	describe('native-to-target mode', () => {
		it('schema requires challengeText, targetSentence, targetedVocabularyIds, targetedGrammarIds', () => {
			const { jsonSchemaObj } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'native-to-target' });
			expect(jsonSchemaObj.required).toEqual(
				expect.arrayContaining(['challengeText', 'targetSentence', 'targetedVocabularyIds', 'targetedGrammarIds'])
			);
		});

		it('schema does NOT require distractors or hints', () => {
			const { jsonSchemaObj } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'native-to-target' });
			const required = jsonSchemaObj.required as string[];
			expect(required).not.toContain('distractors');
			expect(required).not.toContain('hints');
		});

		it('system prompt instructs English challengeText', () => {
			const { systemPrompt } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'native-to-target' });
			expect(systemPrompt).toMatch(/English/i);
		});
	});

	describe('target-to-native mode', () => {
		it('schema requires challengeText, targetSentence, targetedVocabularyIds, targetedGrammarIds', () => {
			const { jsonSchemaObj } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'target-to-native' });
			expect(jsonSchemaObj.required).toEqual(
				expect.arrayContaining(['challengeText', 'targetSentence', 'targetedVocabularyIds', 'targetedGrammarIds'])
			);
		});

		it('system prompt mentions German sentence for challengeText', () => {
			const { systemPrompt } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'target-to-native' });
			expect(systemPrompt).toMatch(/German/i);
		});
	});

	describe('fill-blank mode', () => {
		it('schema requires hints array', () => {
			const { jsonSchemaObj } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'fill-blank' });
			expect(jsonSchemaObj.required).toEqual(expect.arrayContaining(['hints']));
		});

		it('hints schema items require vocabId and hint', () => {
			const { jsonSchemaObj } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'fill-blank' });
			const schema = jsonSchemaObj as any;
			expect(schema.properties.hints.items.required).toEqual(
				expect.arrayContaining(['vocabId', 'hint'])
			);
		});

		it('system prompt mentions blank (___)', () => {
			const { systemPrompt } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'fill-blank' });
			expect(systemPrompt).toContain('___');
		});
	});

	describe('multiple-choice mode', () => {
		it('schema requires distractors array', () => {
			const { jsonSchemaObj } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'multiple-choice' });
			expect(jsonSchemaObj.required).toEqual(expect.arrayContaining(['distractors']));
		});

		it('system prompt mentions 3 plausible but INCORRECT', () => {
			const { systemPrompt } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'multiple-choice' });
			expect(systemPrompt).toMatch(/incorrect/i);
		});
	});

	describe('absolute beginner mode', () => {
		it('system prompt includes ABSOLUTE BEGINNER MODE when isAbsoluteBeginner=true', () => {
			const { systemPrompt } = buildLessonPrompt({
				...BASE_PARAMS,
				gameMode: 'native-to-target',
				isAbsoluteBeginner: true
			});
			expect(systemPrompt).toMatch(/ABSOLUTE BEGINNER MODE/);
		});

		it('system prompt constrains to 3-6 words when isAbsoluteBeginner=true', () => {
			const { systemPrompt } = buildLessonPrompt({
				...BASE_PARAMS,
				gameMode: 'native-to-target',
				isAbsoluteBeginner: true
			});
			expect(systemPrompt).toMatch(/3-6 words/);
		});

		it('no ABSOLUTE BEGINNER MODE text when isAbsoluteBeginner=false', () => {
			const { systemPrompt } = buildLessonPrompt({
				...BASE_PARAMS,
				gameMode: 'native-to-target',
				isAbsoluteBeginner: false
			});
			expect(systemPrompt).not.toMatch(/ABSOLUTE BEGINNER MODE/);
		});
	});

	describe('assignment constraints', () => {
		it('includes topic constraint when assignmentTopic is set', () => {
			const { systemPrompt } = buildLessonPrompt({
				...BASE_PARAMS,
				gameMode: 'native-to-target',
				assignmentTopic: 'travel and transportation'
			});
			expect(systemPrompt).toMatch(/travel and transportation/);
			expect(systemPrompt).toMatch(/CRITICAL THEMATIC CONSTRAINT/);
		});

		it('no topic constraint when assignmentTopic is null', () => {
			const { systemPrompt } = buildLessonPrompt({
				...BASE_PARAMS,
				gameMode: 'native-to-target',
				assignmentTopic: null
			});
			expect(systemPrompt).not.toMatch(/CRITICAL THEMATIC CONSTRAINT/);
		});

		it('includes grammar constraint when assignmentTargetGrammar has items', () => {
			const { systemPrompt } = buildLessonPrompt({
				...BASE_PARAMS,
				gameMode: 'native-to-target',
				assignmentTargetGrammar: ['Dative Case', 'Plural Nouns']
			});
			expect(systemPrompt).toMatch(/CRITICAL GRAMMAR CONSTRAINT/);
			expect(systemPrompt).toMatch(/Dative Case/);
			expect(systemPrompt).toMatch(/Plural Nouns/);
		});

		it('no grammar constraint when assignmentTargetGrammar is empty', () => {
			const { systemPrompt } = buildLessonPrompt({
				...BASE_PARAMS,
				gameMode: 'native-to-target',
				assignmentTargetGrammar: []
			});
			expect(systemPrompt).not.toMatch(/CRITICAL GRAMMAR CONSTRAINT/);
		});
	});

	describe('vocab and grammar lists in prompt', () => {
		it('includes learning vocab in prompt', () => {
			const { systemPrompt } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'native-to-target' });
			expect(systemPrompt).toMatch(/Learning Vocabulary/);
			expect(systemPrompt).toMatch(/das Buch/);
		});

		it('includes learning grammar in prompt', () => {
			const { systemPrompt } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: 'native-to-target' });
			expect(systemPrompt).toMatch(/Learning Grammar/);
			expect(systemPrompt).toMatch(/Accusative Case/);
		});

		it('shows "Basic" when masteredVocabList is empty', () => {
			const { systemPrompt } = buildLessonPrompt({
				...BASE_PARAMS,
				gameMode: 'native-to-target',
				masteredVocabList: ''
			});
			expect(systemPrompt).toMatch(/Basic/);
		});
	});

	describe('JSON schema structure', () => {
		const modes: GameMode[] = ['native-to-target', 'target-to-native', 'fill-blank', 'multiple-choice'];

		for (const mode of modes) {
			it(`${mode}: schema type is object`, () => {
				const { jsonSchemaObj } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: mode });
				expect(jsonSchemaObj.type).toBe('object');
			});

			it(`${mode}: additionalProperties is false`, () => {
				const { jsonSchemaObj } = buildLessonPrompt({ ...BASE_PARAMS, gameMode: mode });
				expect(jsonSchemaObj.additionalProperties).toBe(false);
			});
		}
	});
});
