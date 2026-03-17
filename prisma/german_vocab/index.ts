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
import { germanGrammarRules } from './grammar';
import type { LanguageSeedData } from '../seed-types';

function normalizeGender(g: string | undefined): 'MASCULINE' | 'FEMININE' | 'NEUTER' | null {
  if (g === 'der') return 'MASCULINE';
  if (g === 'die') return 'FEMININE';
  if (g === 'das') return 'NEUTER';
  if (g === 'MASCULINE' || g === 'FEMININE' || g === 'NEUTER')
    return g as 'MASCULINE' | 'FEMININE' | 'NEUTER';
  return null;
}

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
    gender: normalizeGender(v.gender),
    plural: v.plural ?? null
  })),
  grammarRules: germanGrammarRules.map((r: any) => ({
    title: r.title,
    description: r.description,
    guide: r.guide,
    level: r.level,
    ruleType: r.ruleType ?? null,
    targetForms: r.targetForms ?? [],
    dependencies: r.dependencies ?? []
  }))
};
