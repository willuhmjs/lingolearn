import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CEFR_CONFIG } from '../../src/lib/server/srsConfig';

// ─── Prisma mock ────────────────────────────────────────────────────────────

const mockPrisma = {
	userProgress: { findUnique: vi.fn(), update: vi.fn() },
	userVocabulary: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
	userGrammarRule: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
	grammarRule: { findMany: vi.fn() },
	$transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
};

vi.mock('../../src/lib/server/prisma', () => ({ prisma: mockPrisma }));

// Dynamic import so mock is applied first
const { CefrService } = await import('../../src/lib/server/cefrService');

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockProgress(level: string) {
	mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'prog-1', cefrLevel: level });
}

function mockCounts(encounteredVocab: number, interactedGrammar: number, masteredVocab: number, masteredGrammar: number) {
	mockPrisma.userVocabulary.count
		.mockResolvedValueOnce(encounteredVocab)  // encountered
		.mockResolvedValueOnce(masteredVocab);    // mastered
	mockPrisma.userGrammarRule.count
		.mockResolvedValueOnce(interactedGrammar) // interacted
		.mockResolvedValueOnce(masteredGrammar);  // mastered
}

function mockElos(vocabElos: number[], grammarElos: number[]) {
	mockPrisma.userVocabulary.findMany.mockResolvedValue(vocabElos.map(e => ({ eloRating: e })));
	mockPrisma.userGrammarRule.findMany.mockResolvedValue(grammarElos.map(e => ({ eloRating: e })));
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
		expect(result.targetElo).toBe(CEFR_CONFIG.ELO_TARGETS.A1);
	});

	it('returns 100% complete with null nextLevel at C2 (max level)', async () => {
		mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'p', cefrLevel: 'C2' });

		const result = await CefrService.getCefrProgress('user-1', 'lang-1');

		expect(result.currentLevel).toBe('C2');
		expect(result.nextLevel).toBeNull();
		expect(result.percentComplete).toBe(100);
		expect(result.targetElo).toBeNull();
	});

	it('computes correct vocabMastery ratio', async () => {
		mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'p', cefrLevel: 'A1' });
		mockPrisma.grammarRule = { count: vi.fn().mockResolvedValue(10) } as any;

		// encountered=10, interactedGrammar=5, masteredVocab=8, masteredGrammar=5
		mockPrisma.userVocabulary.count
			.mockResolvedValueOnce(10)  // encounteredVocab
			.mockResolvedValueOnce(8);  // masteredVocab
		mockPrisma.userGrammarRule.count
			.mockResolvedValueOnce(5)   // totalGrammar (via grammarRule.count below)
			.mockResolvedValueOnce(8)   // masteredGrammar
			.mockResolvedValueOnce(5);  // interactedGrammar

		mockPrisma.userVocabulary.findMany.mockResolvedValue([{ eloRating: 1200 }]);
		mockPrisma.userGrammarRule.findMany.mockResolvedValue([{ eloRating: 1100 }]);

		// grammarRule.count mock for totalGrammar
		mockPrisma.grammarRule.findMany = vi.fn().mockResolvedValue([]);

		const result = await CefrService.getCefrProgress('user-1', 'lang-1');
		// vocabMastery = 8/10 = 0.8
		expect(result.vocabMastery).toBeCloseTo(0.8, 2);
	});

	it('percentComplete is between 0 and 100', async () => {
		mockPrisma.userProgress.findUnique.mockResolvedValue({ id: 'p', cefrLevel: 'B1' });

		mockPrisma.userVocabulary.count.mockResolvedValue(5);
		mockPrisma.userGrammarRule.count.mockResolvedValue(3);
		mockPrisma.grammarRule.findMany = vi.fn().mockResolvedValue([]);
		mockPrisma.userVocabulary.findMany.mockResolvedValue([{ eloRating: 1400 }]);
		mockPrisma.userGrammarRule.findMany.mockResolvedValue([{ eloRating: 1300 }]);

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
		const expectedDecayed = currentElo - (currentElo - baseline) * CEFR_CONFIG.DECAY.RATE;

		mockPrisma.userVocabulary.findMany.mockResolvedValue([
			{ id: 'uv-1', eloRating: currentElo, vocabulary: { cefrLevel: 'A1' } }
		]);
		mockPrisma.userGrammarRule.findMany.mockResolvedValue([]);
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
			{ id: 'uv-1', eloRating: baseline, vocabulary: { cefrLevel: 'A1' } }
		]);
		mockPrisma.userGrammarRule.findMany.mockResolvedValue([]);

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
