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

const allVocab = [
  ...articles,
  ...verbs,
  ...nouns,
  ...adverbs,
  ...adjectives,
  ...conjunctions,
  ...prepositions,
  ...pronouns,
  ...particles,
  ...interjections
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
