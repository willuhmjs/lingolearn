export type SeedVocabEntry = {
  lemma: string;
  meaning: string;
  partOfSpeech?: string;
  isBeginner?: boolean;
  gender?: 'MASCULINE' | 'FEMININE' | 'NEUTER' | null;
  plural?: string | null;
};

export type SeedGrammarRule = {
  title: string;
  description: string;
  guide: string;
  level: string;
  ruleType?: string | null;
  targetForms?: string[];
  dependencies?: string[];
};

export type LanguageSeedData = {
  vocabulary: SeedVocabEntry[];
  grammarRules: SeedGrammarRule[];
};
