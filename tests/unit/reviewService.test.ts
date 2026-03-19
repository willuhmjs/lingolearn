import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/server/llm', () => ({
  generateChatCompletion: vi.fn()
}));

vi.mock('../../src/lib/server/aiQuota', () => ({
  isQuotaExceeded: vi.fn(),
  recordTokenUsage: vi.fn()
}));

vi.mock('../../src/lib/server/fuzzyGrade', () => ({
  isClearlyCorrect: vi.fn()
}));

import { gradeReviewAnswer } from '../../src/lib/server/reviewService';
import { generateChatCompletion } from '../../src/lib/server/llm';
import { isQuotaExceeded, recordTokenUsage } from '../../src/lib/server/aiQuota';
import { isClearlyCorrect } from '../../src/lib/server/fuzzyGrade';

describe('reviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('gradeReviewAnswer', () => {
    it('returns 0 score for empty answer', async () => {
      const result = await gradeReviewAnswer('u1', '  ', 'apple', 'apple', false);
      expect(result).toEqual({ correct: false, score: 0 });
    });

    it('uses fast path if isClearlyCorrect returns true', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValue(true);
      const result = await gradeReviewAnswer('u1', 'apple', 'apple', 'apple', false);
      expect(result).toEqual({ correct: true, score: 1.0 });
      expect(generateChatCompletion).not.toHaveBeenCalled();
    });

    it('calls LLM if fuzzy matching fails', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValue(false);
      vi.mocked(isQuotaExceeded).mockResolvedValue(false);
      vi.mocked(generateChatCompletion).mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ correct: true, score: 0.9 }) } }]
      } as any);

      const result = await gradeReviewAnswer('u1', 'pomme', 'pomme', 'apple', false);
      expect(result).toEqual({ correct: true, score: 0.9 });
      expect(generateChatCompletion).toHaveBeenCalled();
    });

    it('returns 0 score if quota is exceeded', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValue(false);
      vi.mocked(isQuotaExceeded).mockResolvedValue(true);
      const result = await gradeReviewAnswer('u1', 'pomme', 'pomme', 'apple', false);
      expect(result).toEqual({ correct: false, score: 0 });
      expect(generateChatCompletion).not.toHaveBeenCalled();
    });

    it('records token usage after LLM call if not local LLM', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValue(false);
      vi.mocked(isQuotaExceeded).mockResolvedValue(false);
      vi.mocked(generateChatCompletion).mockImplementation(async ({ onUsage }: any) => {
        if (onUsage) onUsage({ totalTokens: 100 });
        return {
          choices: [{ message: { content: JSON.stringify({ correct: true, score: 1.0 }) } }]
        } as any;
      });

      await gradeReviewAnswer('u1', 'pomme', 'pomme', 'apple', false);
      expect(recordTokenUsage).toHaveBeenCalledWith('u1', 100);
    });

    it('does not record token usage for local LLM', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValue(false);
      vi.mocked(generateChatCompletion).mockImplementation(async ({ onUsage }: any) => {
        if (onUsage) onUsage({ totalTokens: 100 });
        return {
          choices: [{ message: { content: JSON.stringify({ correct: true, score: 1.0 }) } }]
        } as any;
      });

      await gradeReviewAnswer('u1', 'pomme', 'pomme', 'apple', true);
      expect(recordTokenUsage).not.toHaveBeenCalled();
    });

    it('handles malformed LLM response gracefully', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValue(false);
      vi.mocked(isQuotaExceeded).mockResolvedValue(false);
      vi.mocked(generateChatCompletion).mockResolvedValue({
        choices: [{ message: { content: 'not-json' } }]
      } as any);

      const result = await gradeReviewAnswer('u1', 'pomme', 'pomme', 'apple', false);
      expect(result).toEqual({ correct: false, score: 0 });
    });
  });
});
