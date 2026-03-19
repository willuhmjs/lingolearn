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

vi.mock('../../src/lib/server/gamification', () => ({
  updateGamification: vi.fn()
}));

vi.mock('../../src/lib/server/assignmentService', () => ({
  updateImmersionAssignmentScore: vi.fn()
}));

vi.mock('../../src/lib/server/grader', () => ({
  updateSrsMetrics: vi.fn()
}));

import { gradeImmersionAnswer } from '../../src/lib/server/immersionService';
import { generateChatCompletion } from '../../src/lib/server/llm';
import { isQuotaExceeded } from '../../src/lib/server/aiQuota';
import { isClearlyCorrect } from '../../src/lib/server/fuzzyGrade';
import { updateGamification } from '../../src/lib/server/gamification';
import { updateImmersionAssignmentScore } from '../../src/lib/server/assignmentService';
import { updateSrsMetrics } from '../../src/lib/server/grader';

describe('immersionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('gradeImmersionAnswer', () => {
    it('awards XP directly if directXp is provided', async () => {
      vi.mocked(updateGamification).mockResolvedValueOnce({ xp: 100 } as any);
      const result = await gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: 'a',
        sampleAnswer: 's',
        directXp: 10
      }, false);

      expect(result).toEqual({ score: 1, feedback: '', assignmentProgress: null });
      expect(updateGamification).toHaveBeenCalledWith('u1', 10);
    });

    it('updates assignment progress if directXp and assignmentId are provided', async () => {
      vi.mocked(updateImmersionAssignmentScore).mockResolvedValueOnce({ score: 5, targetScore: 10, passed: false } as any);
      const result = await gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: 'a',
        sampleAnswer: 's',
        directXp: 10,
        assignmentId: 'a1',
        correctCount: 2
      }, false);

      expect(result.assignmentProgress).toEqual({ score: 5, targetScore: 10, passed: false });
      expect(updateImmersionAssignmentScore).toHaveBeenCalledWith('a1', 'u1', 2);
    });

    it('returns score 0 if userAnswer is empty', async () => {
      const result = await gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: '',
        sampleAnswer: 's'
      }, false);
      expect(result.score).toBe(0);
      expect(result.feedback).toBe('No answer provided.');
    });

    it('uses fast path if isClearlyCorrect returns true', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValueOnce(true);
      vi.mocked(updateGamification).mockResolvedValueOnce({} as any);
      
      const result = await gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: 's',
        sampleAnswer: 's',
        awardXp: 20
      }, false);

      expect(result.score).toBe(1);
      expect(updateGamification).toHaveBeenCalledWith('u1', 20);
      expect(generateChatCompletion).not.toHaveBeenCalled();
    });

    it('updates SRS metrics if vocabIds provided (fast path)', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValueOnce(true);
      await gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: 's',
        sampleAnswer: 's',
        vocabIds: ['v1', 'v2']
      }, false);

      expect(updateSrsMetrics).toHaveBeenCalledWith('u1', 'v1', 1.0);
      expect(updateSrsMetrics).toHaveBeenCalledWith('u1', 'v2', 1.0);
    });

    it('throws error if quota exceeded', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValueOnce(false);
      vi.mocked(isQuotaExceeded).mockResolvedValueOnce(true);

      await expect(gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: 'a',
        sampleAnswer: 's'
      }, false)).rejects.toThrow('Daily AI quota exceeded. Please try again tomorrow.');
    });

    it('awards proportional XP after LLM grading', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValueOnce(false);
      vi.mocked(isQuotaExceeded).mockResolvedValueOnce(false);
      vi.mocked(generateChatCompletion).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ score: 0.5, feedback: 'OK' }) } }]
      } as any);

      await gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: 'a',
        sampleAnswer: 's',
        awardXp: 20
      }, false);

      expect(updateGamification).toHaveBeenCalledWith('u1', 10); // 20 * 0.5
    });

    it('updates assignment score if score >= 0.5', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValueOnce(false);
      vi.mocked(isQuotaExceeded).mockResolvedValueOnce(false);
      vi.mocked(generateChatCompletion).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ score: 0.6, feedback: 'OK' }) } }]
      } as any);

      await gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: 'a',
        sampleAnswer: 's',
        assignmentId: 'a1'
      }, false);

      expect(updateImmersionAssignmentScore).toHaveBeenCalledWith('a1', 'u1', 1);
    });

    it('does not update assignment score if score < 0.5', async () => {
      vi.mocked(isClearlyCorrect).mockReturnValueOnce(false);
      vi.mocked(isQuotaExceeded).mockResolvedValueOnce(false);
      vi.mocked(generateChatCompletion).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ score: 0.4, feedback: 'Poor' }) } }]
      } as any);

      await gradeImmersionAnswer('u1', {
        question: 'q',
        userAnswer: 'a',
        sampleAnswer: 's',
        assignmentId: 'a1'
      }, false);

      expect(updateImmersionAssignmentScore).not.toHaveBeenCalled();
    });
  });
});
