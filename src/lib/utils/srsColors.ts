export const SRS_COLORS = {
  UNSEEN: '#e2e8f0',
  LEARNING: '#fef08a',
  KNOWN: '#86efac',
  MASTERED: '#22c55e'
} as const;

export type SrsColorKey = keyof typeof SRS_COLORS;

export function getSrsColor(state: string): string {
  return SRS_COLORS[state as SrsColorKey] ?? SRS_COLORS.UNSEEN;
}
