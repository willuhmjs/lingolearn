import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma module before importing aiQuota
const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../../src/lib/server/prisma', () => ({
  prisma: {
    userAiUsage: {
      findUnique: mockFindUnique,
      upsert: mockUpsert
    }
  }
}));

// Import after mocking
const { getDailyUsage, isQuotaExceeded, recordTokenUsage, DAILY_TOKEN_QUOTA } =
  await import('../../src/lib/server/aiQuota');

describe('DAILY_TOKEN_QUOTA', () => {
  it('is a positive number', () => {
    expect(DAILY_TOKEN_QUOTA).toBeGreaterThan(0);
  });
});

describe('getDailyUsage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no usage record exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getDailyUsage('user-123');
    expect(result).toBeNull();
  });

  it('returns correct effectiveUsage when goodWillTokens < tokensUsed', async () => {
    mockFindUnique.mockResolvedValue({ tokensUsed: 1000, goodWillTokens: 200 });
    const result = await getDailyUsage('user-123');
    expect(result).toEqual({ tokensUsed: 1000, goodWillTokens: 200, effectiveUsage: 800 });
  });

  it('clamps effectiveUsage to 0 when goodWillTokens >= tokensUsed', async () => {
    mockFindUnique.mockResolvedValue({ tokensUsed: 100, goodWillTokens: 200 });
    const result = await getDailyUsage('user-123');
    expect(result?.effectiveUsage).toBe(0);
  });
});

describe('isQuotaExceeded', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false immediately when useLocalLlm=true (no DB call)', async () => {
    const result = await isQuotaExceeded('user-123', true);
    expect(result).toBe(false);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns false when no usage record exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await isQuotaExceeded('user-123', false);
    expect(result).toBe(false);
  });

  it('returns false when effectiveUsage is below quota', async () => {
    mockFindUnique.mockResolvedValue({ tokensUsed: 100, goodWillTokens: 0 });
    const result = await isQuotaExceeded('user-123', false);
    expect(result).toBe(false);
  });

  it('returns true when effectiveUsage meets quota exactly', async () => {
    mockFindUnique.mockResolvedValue({
      tokensUsed: DAILY_TOKEN_QUOTA,
      goodWillTokens: 0
    });
    const result = await isQuotaExceeded('user-123', false);
    expect(result).toBe(true);
  });

  it('returns true when effectiveUsage exceeds quota', async () => {
    mockFindUnique.mockResolvedValue({
      tokensUsed: DAILY_TOKEN_QUOTA + 1000,
      goodWillTokens: 0
    });
    const result = await isQuotaExceeded('user-123', false);
    expect(result).toBe(true);
  });

  it('returns false when goodWillTokens bring effectiveUsage below quota', async () => {
    mockFindUnique.mockResolvedValue({
      tokensUsed: DAILY_TOKEN_QUOTA + 5000,
      goodWillTokens: 10000
    });
    const result = await isQuotaExceeded('user-123', false);
    expect(result).toBe(false);
  });
});

describe('recordTokenUsage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when tokens <= 0', async () => {
    await recordTokenUsage('user-123', 0);
    await recordTokenUsage('user-123', -5);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('calls upsert with correct token count', async () => {
    mockUpsert.mockResolvedValue({});
    await recordTokenUsage('user-123', 500);
    expect(mockUpsert).toHaveBeenCalledOnce();
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.tokensUsed).toBe(500);
    expect(call.create.goodWillTokens).toBe(0);
  });

  it('sets goodWillTokens when goodWill=true', async () => {
    mockUpsert.mockResolvedValue({});
    await recordTokenUsage('user-123', 300, true);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.goodWillTokens).toBe(300);
    expect(call.update.goodWillTokens).toEqual({ increment: 300 });
  });

  it('does not set goodWillTokens when goodWill=false (default)', async () => {
    mockUpsert.mockResolvedValue({});
    await recordTokenUsage('user-123', 300);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.goodWillTokens).toBe(0);
    expect(call.update).not.toHaveProperty('goodWillTokens');
  });

  it('does not throw when upsert fails (fire-and-forget safe)', async () => {
    mockUpsert.mockRejectedValue(new Error('DB error'));
    await expect(recordTokenUsage('user-123', 100)).resolves.toBeUndefined();
  });
});
