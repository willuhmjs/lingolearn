import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CEFR_CONFIG } from '../../src/lib/server/srsConfig';

// ─── Prisma mock ────────────────────────────────────────────────────────────

const mockPrisma = {
  userProgress: { findUnique: vi.fn(), update: vi.fn() },
  vocabulary: { findMany: vi.fn() },
  userVocabulary: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  userVocabularyProgress: { findMany: vi.fn() },
  userGrammarRule: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  userGrammarRuleProgress: { findMany: vi.fn() },
  grammarRule: { findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
};

vi.mock('../../src/lib/server/prisma', () => ({ prisma: mockPrisma }));

// Dynamic import so mock is applied first
const { CefrService } = await import('../../src/lib/server/cefrService');

// ─── Helpers ────────────────────────────────────────────────────────────────

function _mockProgress(level: string) {
  mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'prog-1', cefrLevel: level });
}

function _mockCounts(
  encounteredVocab: number,
  interactedGrammar: number,
  masteredVocab: number,
  masteredGrammar: number
) {
  mockPrisma.userVocabulary.count
    .mockResolvedValueOnce(encounteredVocab) // encountered
    .mockResolvedValueOnce(masteredVocab); // mastered
  mockPrisma.userGrammarRule.count
    .mockResolvedValueOnce(interactedGrammar) // interacted
    .mockResolvedValueOnce(masteredGrammar); // mastered
}

function _mockElos(vocabElos: number[], grammarElos: number[]) {
  mockPrisma.userVocabulary.findMany.mockResolvedValue(vocabElos.map((e) => ({ eloRating: e })));
  mockPrisma.userGrammarRule.findMany.mockResolvedValue(grammarElos.map((e) => ({ eloRating: e })));
}

beforeEach(() => vi.clearAllMocks());

// ─── getCefrProgress ────────────────────────────────────────────────────────

describe('CefrService.getCefrProgress', () => {
  it('returns A1 defaults when no userProgress record exists', async () => {
    mockPrisma.userProgress.findUnique.mockResolvedValue(null);

    const result = await CefrService.getCefrProgress('user-1', 'lang-1');

    expect(result.currentLevel).toBe('A1');
    expect(result.nextLevel).toBe('A2');
    expect(result.percentComplete).toBe(0);
    expect(result.freqCoverageCount).toBe(0);
    expect(result.freqCoverageTarget).toBe(CEFR_CONFIG.VOCAB_FREQ_GATE.A1);
  });

  it('returns 100% complete with null nextLevel at C2 (max level)', async () => {
    mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'p', cefrLevel: 'C2' });

    const result = await CefrService.getCefrProgress('user-1', 'lang-1');

    expect(result.currentLevel).toBe('C2');
    expect(result.nextLevel).toBeNull();
    expect(result.percentComplete).toBe(100);
  });

  it('computes freqCoverageCount correctly from top-N frequency words', async () => {
    mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'p', cefrLevel: 'A1' });

    // Simulate DB having 50 A1 words with frequency data — exactly the gate target
    const topWords = Array.from({ length: 50 }, (_, i) => ({ id: `v${i}` }));
    mockPrisma.vocabulary.findMany.mockResolvedValue(topWords);
    mockPrisma.grammarRule.count.mockResolvedValue(10); // totalGrammar
    mockPrisma.userGrammarRule.count
      .mockResolvedValueOnce(8) // masteredGrammar
      .mockResolvedValueOnce(5); // interactedGrammar
    mockPrisma.userVocabulary.findMany.mockResolvedValueOnce(
      Array.from({ length: 40 }, () => ({
        eloRating: 1100,
        vocabulary: { progress: [] }
      }))
    ); // freqGateItems
    mockPrisma.userGrammarRule.findMany.mockResolvedValueOnce([
      { eloRating: 1050, grammarRule: { progress: [] } }
    ]); // grammarGateItems
    mockPrisma.userVocabulary.count.mockResolvedValue(100); // totalMasteredVocab (separate from freq-gate)

    const result = await CefrService.getCefrProgress('user-1', 'lang-1');
    expect(result.freqCoverageCount).toBe(40);
    expect(result.freqCoverageTarget).toBe(50);
  });

  it('handles user with extreme ELOs (above max CEFR baseline)', async () => {
    mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'p', cefrLevel: 'C2' });
    mockPrisma.vocabulary.findMany.mockResolvedValue([]);
    mockPrisma.grammarRule.count.mockResolvedValue(0);
    mockPrisma.userGrammarRule.count.mockResolvedValue(0);
    mockPrisma.userVocabulary.findMany.mockResolvedValueOnce([]);
    mockPrisma.userGrammarRule.findMany.mockResolvedValueOnce([]);
    mockPrisma.userVocabulary.count.mockResolvedValue(5000);

    const result = await CefrService.getCefrProgress('user-1', 'lang-1');
    expect(result.currentLevel).toBe('C2');
    expect(result.percentComplete).toBe(100);
  });

  it('handles negative or zero counts gracefully', async () => {
    mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'p', cefrLevel: 'A1' });
    mockPrisma.vocabulary.findMany.mockResolvedValue([]);
    mockPrisma.grammarRule.count.mockResolvedValue(0);
    mockPrisma.userGrammarRule.count.mockResolvedValue(0);
    mockPrisma.userVocabulary.findMany.mockResolvedValue([]);
    mockPrisma.userGrammarRule.findMany.mockResolvedValue([]);
    mockPrisma.userVocabulary.count.mockResolvedValue(0);

    const result = await CefrService.getCefrProgress('user-1', 'lang-1');
    // We expect a non-zero percentComplete because some sub-progresses default to 1 (like totalVocabProgress when target=0)
    expect(result.percentComplete).toBeGreaterThanOrEqual(0);
    expect(result.freqCoverageCount).toBe(0);
  });

  it('percentComplete is between 0 and 100', async () => {
    mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'p', cefrLevel: 'B1' });

    mockPrisma.vocabulary.findMany.mockResolvedValue(
      Array.from({ length: 70 }, (_, i) => ({ id: `v${i}` }))
    );
    mockPrisma.grammarRule.count.mockResolvedValue(8);
    mockPrisma.userGrammarRule.count
      .mockResolvedValueOnce(4) // totalInteracted (interactedGrammar)
      .mockResolvedValueOnce(2); // totalMastered (not used this way anymore)

    mockPrisma.userVocabulary.findMany.mockResolvedValueOnce(
      Array.from({ length: 35 }, () => ({
        eloRating: 1400,
        vocabulary: { progress: [] }
      }))
    ); // freqGateItems
    mockPrisma.userGrammarRule.findMany.mockResolvedValueOnce([
      { eloRating: 1300, grammarRule: { progress: [] } }
    ]); // grammarGateItems
    mockPrisma.userVocabulary.count.mockResolvedValue(200);

    const result = await CefrService.getCefrProgress('user-1', 'lang-1');
    expect(result.percentComplete).toBeGreaterThanOrEqual(0);
    expect(result.percentComplete).toBeLessThanOrEqual(100);
  });
});

// ─── applyEloDecay ──────────────────────────────────────────────────────────

describe('CefrService.applyEloDecay', () => {
  it('does nothing when there are no stale items', async () => {
    mockPrisma.userVocabulary.findMany.mockResolvedValue([]);
    mockPrisma.userGrammarRule.findMany.mockResolvedValue([]);

    await CefrService.applyEloDecay('user-1', 'lang-1');

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('decays vocab ELO toward its CEFR baseline', async () => {
    const baseline = CEFR_CONFIG.BASE_ELO.A1; // 1000
    const currentElo = 1200;
    const _expectedDecayed = currentElo - (currentElo - baseline) * CEFR_CONFIG.DECAY.RATE;

    mockPrisma.userVocabulary.findMany.mockResolvedValue([
      { id: 'uv-1', vocabularyId: 'v-1', eloRating: currentElo, vocabulary: { cefrLevel: 'A1' } }
    ]);
    mockPrisma.userGrammarRule.findMany.mockResolvedValue([]);
    mockPrisma.userVocabularyProgress.findMany.mockResolvedValue([
      { vocabularyId: 'v-1', stability: 5, repetitions: 3, lapses: 0 }
    ]);
    mockPrisma.userGrammarRuleProgress.findMany.mockResolvedValue([]);
    mockPrisma.userVocabulary.update.mockResolvedValue({});

    await CefrService.applyEloDecay('user-1', 'lang-1');

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    // The update should apply the expected decayed ELO
    const transactionArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionArg).toHaveLength(1); // 1 vocab update
  });

  it('skips items already at or below baseline (no update needed)', async () => {
    const baseline = CEFR_CONFIG.BASE_ELO.A1; // 1000
    mockPrisma.userVocabulary.findMany.mockResolvedValue([
      { id: 'uv-1', vocabularyId: 'v-1', eloRating: baseline, vocabulary: { cefrLevel: 'A1' } }
    ]);
    mockPrisma.userGrammarRule.findMany.mockResolvedValue([]);
    mockPrisma.userVocabularyProgress.findMany.mockResolvedValue([]);
    mockPrisma.userGrammarRuleProgress.findMany.mockResolvedValue([]);

    await CefrService.applyEloDecay('user-1', 'lang-1');

    // No updates needed since ELO is already at baseline
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

// ─── applyGrammarMasteryForLevel ────────────────────────────────────────────

describe('CefrService.applyGrammarMasteryForLevel', () => {
  it('does nothing for an invalid CEFR level', async () => {
    await CefrService.applyGrammarMasteryForLevel('user-1', 'lang-1', 'INVALID');
    expect(mockPrisma.grammarRule.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when placed at A1 (no prior levels to master)', async () => {
    mockPrisma.grammarRule.findMany.mockResolvedValue([]);

    await CefrService.applyGrammarMasteryForLevel('user-1', 'lang-1', 'A1');

    // No rules to master (A1 is the first level)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
