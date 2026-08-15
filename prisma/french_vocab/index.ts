import { verbs } from './verbs';
import { nouns } from './nouns';
import { adverbs } from './adverbs';
import { adjectives } from './adjectives';
import { conjunctions } from './conjunctions';
import { prepositions } from './prepositions';
import { pronouns } from './pronouns';
import { particles } from './particles';
import { interjections } from './interjections';
import { articles } from './articles';
import { frenchGrammarRules } from './grammar';
import type { LanguageSeedData } from '../seed-types';

// Most entries in these files don't set partOfSpeech explicitly (unlike the
// German/Spanish/Italian vocab files), so it's defaulted here per category —
// otherwise the placement quiz can't filter distractors by part of speech.
const allVocab = [
  ...articles.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'article' })),
  ...verbs.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'verb' })),
  ...nouns.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'noun' })),
  ...adverbs.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'adverb' })),
  ...adjectives.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'adjective' })),
  ...conjunctions.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'conjunction' })),
  ...prepositions.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'preposition' })),
  ...pronouns.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'pronoun' })),
  ...particles.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'particle' })),
  ...interjections.map((v: any) => ({ ...v, partOfSpeech: v.partOfSpeech ?? 'interjection' }))
];

export const seedData: LanguageSeedData = {
  vocabulary: allVocab.map((v: any) => ({
    lemma: v.lemma,
    meaning: v.meaning,
    partOfSpeech: v.partOfSpeech,
    isBeginner: v.isBeginner ?? false,
    gender: v.gender ?? null,
    plural: v.plural ?? null
  })),
  // French grammar rules don't have a guide field — use description as fallback.
  grammarRules: frenchGrammarRules.map((r: any) => ({
    title: r.title,
    description: r.description,
    guide: r.guide ?? r.description,
    level: r.level,
    ruleType: r.ruleType ?? null,
    targetForms: r.targetForms ?? [],
    dependencies: r.dependencies ?? []
  }))
};
