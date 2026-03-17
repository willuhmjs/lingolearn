/**
 * Shared types and constants for the Play page and its sub-components.
 */

export type GameMode =
  | 'native-to-target'
  | 'target-to-native'
  | 'fill-blank'
  | 'multiple-choice'
  | 'chat'
  | 'immerse';

export type CyclableMode =
  | 'multiple-choice'
  | 'target-to-native'
  | 'fill-blank'
  | 'native-to-target';

export const ALL_CYCLE_MODES: CyclableMode[] = [
  'multiple-choice', // difficulty index 0
  'target-to-native', // difficulty index 1
  'fill-blank', // difficulty index 2
  'native-to-target' // difficulty index 3
];

export interface LeitnerItem {
  vocabIds: string[];
  grammarIds: string[];
  dueAtChallenge: number;
  box: 1 | 2;
}

export const LEITNER_BOX_INTERVALS = { 1: 2, 2: 5 } as const;

export const EMA_ALPHA = 0.2;
export const GAUSS_SIGMA = 1.2;

export interface AssignmentProgress {
  score: number;
  targetScore: number;
  passed: boolean;
}

export function getFlagEmoji(language: string): string {
  if (!language) return '\u{1F30D}';
  const lang = language.toLowerCase();
  if (lang === 'german' || lang === 'de') return '\u{1F1E9}\u{1F1EA}';
  if (lang === 'french' || lang === 'fr') return '\u{1F1EB}\u{1F1F7}';
  if (lang === 'spanish' || lang === 'es') return '\u{1F1EA}\u{1F1F8}';
  if (lang === 'english' || lang === 'en') return '\u{1F1FA}\u{1F1F8}';
  if (lang === 'italian' || lang === 'it') return '\u{1F1EE}\u{1F1F9}';
  if (lang === 'portuguese' || lang === 'pt') return '\u{1F1F5}\u{1F1F9}';
  if (lang === 'russian' || lang === 'ru') return '\u{1F1F7}\u{1F1FA}';
  if (lang === 'japanese' || lang === 'ja') return '\u{1F1EF}\u{1F1F5}';
  if (lang === 'korean' || lang === 'ko') return '\u{1F1F0}\u{1F1F7}';
  if (lang === 'chinese' || lang === 'zh') return '\u{1F1E8}\u{1F1F3}';
  return '\u{1F30D}';
}

export function calculateEloProgress(elo: number): number {
  const level = elo < 1050 ? 'LEARNING' : elo < 1150 ? 'KNOWN' : 'MASTERED';
  return Math.max(
    0,
    Math.min(
      100,
      level === 'LEARNING'
        ? ((elo - 1000) / 50) * 100
        : level === 'KNOWN'
          ? ((elo - 1050) / 100) * 100
          : 100
    )
  );
}

export function getEloLevelClass(elo: number): string {
  const levels: Record<string, string> = {
    LOCKED: 'locked',
    UNSEEN: 'unseen',
    LEARNING: 'learning',
    KNOWN: 'known',
    MASTERED: 'mastered'
  };
  const e = Number(elo);
  if (e < 1050) return levels['LEARNING'] || 'learning';
  if (e < 1150) return levels['KNOWN'] || 'known';
  return levels['MASTERED'] || 'mastered';
}
