import { describe, it, expect } from 'vitest';
import {
  computeAnswerXp,
  levelUpXp,
  CEFR_CONFIG,
  ELO_CONFIG,
  XP_CONFIG,
  LESSON_CONFIG
} from '../../src/lib/server/srsConfig';

describe('computeAnswerXp', () => {
  it('returns base XP for A1 (no tier bonus)', () => {
    expect(computeAnswerXp(10, 'A1')).toBe(10);
  });

  it('adds 1 tier bonus for A2', () => {
    expect(computeAnswerXp(10, 'A2')).toBe(12);
  });

  it('adds 2 tier bonuses for B1', () => {
    expect(computeAnswerXp(10, 'B1')).toBe(14);
  });

  it('adds 5 tier bonuses for C2', () => {
    expect(computeAnswerXp(10, 'C2')).toBe(20);
  });

  it('treats unknown CEFR level as tier 0 (same as A1)', () => {
    expect(computeAnswerXp(10, 'INVALID')).toBe(10);
  });

  it('works with different base XP values', () => {
    // MULTIPLE_CHOICE base = 5
    expect(computeAnswerXp(5, 'B2')).toBe(5 + 3 * XP_CONFIG.LEVEL_BONUS_PER_CEFR_TIER);
  });
});

describe('levelUpXp', () => {
  it('returns correct bonus for A2', () => {
    expect(levelUpXp('A2')).toBe(XP_CONFIG.LEVEL_UP_BONUS.A2);
  });

  it('returns correct bonus for B1', () => {
    expect(levelUpXp('B1')).toBe(XP_CONFIG.LEVEL_UP_BONUS.B1);
  });

  it('returns correct bonus for C2', () => {
    expect(levelUpXp('C2')).toBe(XP_CONFIG.LEVEL_UP_BONUS.C2);
  });

  it('returns 0 for A1 (no level-up bonus defined)', () => {
    expect(levelUpXp('A1')).toBe(0);
  });

  it('returns 0 for unknown levels', () => {
    expect(levelUpXp('D1')).toBe(0);
  });
});

describe('CEFR_CONFIG', () => {
  it('defines levels in ascending order', () => {
    expect(CEFR_CONFIG.LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });

  it('has ELO targets for all levels except C2 (max level)', () => {
    const levelsWithTargets = Object.keys(CEFR_CONFIG.ELO_TARGETS);
    expect(levelsWithTargets).not.toContain('C2');
    expect(levelsWithTargets).toContain('A1');
    expect(levelsWithTargets).toContain('C1');
  });

  it('has ascending ELO targets', () => {
    const targets = Object.values(CEFR_CONFIG.ELO_TARGETS);
    for (let i = 0; i < targets.length - 1; i++) {
      expect(targets[i]).toBeLessThan(targets[i + 1]);
    }
  });

  it('grammar mastery threshold is between 0 and 1', () => {
    expect(CEFR_CONFIG.GRAMMAR_MASTERY_THRESHOLD).toBeGreaterThan(0);
    expect(CEFR_CONFIG.GRAMMAR_MASTERY_THRESHOLD).toBeLessThanOrEqual(1);
  });

  it('VOCAB_FREQ_GATE has ascending targets across levels', () => {
    const gate = CEFR_CONFIG.VOCAB_FREQ_GATE;
    expect(gate.A1).toBeLessThan(gate.A2);
    expect(gate.A2).toBeLessThan(gate.B1);
    expect(gate.B1).toBeLessThan(gate.B2);
    expect(gate.B2).toBeLessThan(gate.C1);
  });

  it('GRAMMAR_MIN_INTERACTION is a positive integer', () => {
    expect(CEFR_CONFIG.GRAMMAR_MIN_INTERACTION).toBeGreaterThan(0);
    expect(Number.isInteger(CEFR_CONFIG.GRAMMAR_MIN_INTERACTION)).toBe(true);
  });
});

describe('ELO_CONFIG', () => {
  it('all K_MULTIPLIERS are positive', () => {
    for (const val of Object.values(ELO_CONFIG.K_MULTIPLIERS)) {
      expect(val).toBeGreaterThan(0);
    }
  });

  it('NATIVE_TO_TARGET has highest K multiplier (hardest mode)', () => {
    const multipliers = ELO_CONFIG.K_MULTIPLIERS;
    expect(multipliers.NATIVE_TO_TARGET).toBeGreaterThan(multipliers.MULTIPLE_CHOICE);
    expect(multipliers.NATIVE_TO_TARGET).toBeGreaterThan(multipliers.TARGET_TO_NATIVE);
  });
});

describe('LESSON_CONFIG', () => {
  it('LEARNING_POOL_MIN < LEARNING_POOL_MAX', () => {
    expect(LESSON_CONFIG.LEARNING_POOL_MIN).toBeLessThan(LESSON_CONFIG.LEARNING_POOL_MAX);
  });

  it('LESSON_VOCAB_MAX <= LEARNING_POOL_MAX', () => {
    expect(LESSON_CONFIG.LESSON_VOCAB_MAX).toBeLessThanOrEqual(LESSON_CONFIG.LEARNING_POOL_MAX);
  });

  it('adaptive new-word cap bounds are valid', () => {
    expect(LESSON_CONFIG.NEW_WORDS_PER_DAY_CAP_MIN).toBeGreaterThan(0);
    expect(LESSON_CONFIG.NEW_WORDS_PER_DAY_CAP_MAX).toBeGreaterThan(
      LESSON_CONFIG.NEW_WORDS_PER_DAY_CAP_MIN
    );
  });
});
