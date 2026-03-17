/** Shape of a single article-map entry (used for hover tooltips on articles). */
export type ArticleForm = { caseLabel: string; nomArticle: string };

export interface ArticleMapEntry {
  definite: boolean;
  forms: ArticleForm[];
}

/** Inflection map: maps a conjugated/contracted surface form to its lemma + tooltip note. */
export interface InflectionEntry {
  lemma: string;
  note: string;
}

/**
 * Everything a UI or server module needs to know about a single language.
 * Adding a new language = creating a new file that satisfies this interface.
 */
export interface LanguageConfig {
  /** Display name used in the DB / UI (e.g. "German", "French"). */
  name: string;

  /** ISO 639-1 code (e.g. "de", "fr", "es"). */
  code: string;

  /** Emoji flag for the language (e.g. "🇩🇪", "🇫🇷", "🇪🇸"). */
  flag: string;

  /** Special characters shown on the on-screen keyboard. */
  specialChars: string[];

  /**
   * ASCII digraph → native character replacements applied while the user
   * types in the dictionary search box (e.g. "ae" → "ä" for German).
   * Empty array = no replacements.
   */
  asciiReplacements: { from: RegExp; to: string }[];

  /** Maps article surface forms → case/gender metadata for hover tooltips. */
  articleMap: Record<string, ArticleMapEntry>;

  /**
   * Maps common inflected / contracted surface forms → lemma + note.
   * Used by the tooltip system to resolve conjugated verbs, contractions, etc.
   */
  inflectionMap: Record<string, InflectionEntry>;

  /**
   * Maps a Prisma Gender enum value (e.g. "MASCULINE", "DER") to the
   * nominative definite article string (e.g. "der").  Return null for
   * unknown genders.
   */
  genderToArticle: (gender: string) => string | null;

  /** Default definite article string when gender is unknown (e.g. "der/die/das"). */
  defaultDefiniteArticle: string;

  /** Default indefinite article string when gender is unknown (e.g. "ein/eine"). */
  defaultIndefiniteArticle: string;

  /** Plural definite article (e.g. "die" for German, "les" for French). */
  pluralDefiniteArticle: string;

  /**
   * Maps a nominative definite article to the corresponding indefinite article.
   * e.g. German: { der: "ein", die: "eine", das: "ein" }
   */
  definiteToIndefinite: Record<string, string>;

  /**
   * Whether the language assigns grammatical gender to nouns.
   * Used to decide whether to show gender fields in the UI.
   */
  hasGender: boolean;

  /**
   * Whether nouns are conventionally written with an initial capital letter
   * (true for German, false for all others). Used to disambiguate nouns vs.
   * non-nouns when parsing tokenized text.
   */
  capitalizeNouns: boolean;

  /**
   * Opening greeting shown to the user at the start of the onboarding
   * conversation, written in the target language.
   */
  onboardingGreeting: string;

  /**
   * Inflectional suffixes to strip when generating lemma candidates for DB
   * lookup. Used by vocabProcessor's stemWord() for Romance languages.
   * Empty array = no suffix stripping (use Snowball stemmer instead).
   */
  stemSuffixes: string[];

  /**
   * Whether to apply the Snowball morphological stemmer (German Snowball
   * algorithm from @orama/stemmers) and the strong-verb lookup table.
   * true = German; false = use stemSuffixes only.
   */
  stemWithSnowball: boolean;

  /**
   * Native-language constraint prompt injected into LLM requests to ensure
   * the model writes in correct, native-quality target language.
   * Empty string = no constraint.
   */
  llmConstraintPrompt: string;

  /**
   * Destinations used by the World Immersion mode. Each entry becomes an
   * ImmersionDestination row, seeded automatically on first startup.
   */
  destinations: { city: string; country: string; emoji: string; description: string }[];
}
