import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/server/prisma', () => ({
  prisma: {
    assignment: {
      findUnique: vi.fn()
    },
    classMember: {
      findUnique: vi.fn()
    },
    assignmentScore: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

import { updateAssignmentScore, updateImmersionAssignmentScore } from '../../src/lib/server/assignmentService';
import { prisma } from '../../src/lib/server/prisma';

describe('assignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateAssignmentScore', () => {
    it('throws error if assignment not found', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValueOnce(null);
      await expect(updateAssignmentScore('a1', 'u1', true)).rejects.toThrow('Assignment not found');
    });

    it('throws error if user is not a class member', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValueOnce({ id: 'a1', classId: 'c1' } as any);
      vi.mocked(prisma.classMember.findUnique).mockResolvedValueOnce(null);
      await expect(updateAssignmentScore('a1', 'u1', true)).rejects.toThrow('User is not a member of this class');
    });

    it('increments score and updates passed status', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValueOnce({ id: 'a1', classId: 'c1', targetScore: 10 } as any);
      vi.mocked(prisma.classMember.findUnique).mockResolvedValueOnce({ classId: 'c1', userId: 'u1' } as any);
      vi.mocked(prisma.assignmentScore.findUnique).mockResolvedValueOnce({ score: 9 } as any);
      vi.mocked(prisma.assignmentScore.upsert).mockResolvedValueOnce({ score: 10, passed: true } as any);

      const result = await updateAssignmentScore('a1', 'u1', true);

      expect(result).toEqual({ score: 10, targetScore: 10, passed: true });
      expect(prisma.assignmentScore.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: { score: 10, passed: true }
      }));
    });

    it('does not increment score if incorrect', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValueOnce({ id: 'a1', classId: 'c1', targetScore: 10 } as any);
      vi.mocked(prisma.classMember.findUnique).mockResolvedValueOnce({ classId: 'c1', userId: 'u1' } as any);
      vi.mocked(prisma.assignmentScore.findUnique).mockResolvedValueOnce({ score: 5 } as any);
      vi.mocked(prisma.assignmentScore.upsert).mockResolvedValueOnce({ score: 5, passed: false } as any);

      const result = await updateAssignmentScore('a1', 'u1', false);

      expect(result.score).toBe(5);
      expect(result.passed).toBe(false);
    });
  });

  describe('updateImmersionAssignmentScore', () => {
    it('returns null if assignment not found', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValueOnce(null);
      const result = await updateImmersionAssignmentScore('a1', 'u1', 5);
      expect(result).toBeNull();
    });

    it('adds correctCount to existing score', async () => {
      vi.mocked(prisma.assignment.findUnique).mockResolvedValueOnce({ id: 'a1', classId: 'c1', targetScore: 20 } as any);
      vi.mocked(prisma.classMember.findUnique).mockResolvedValueOnce({ classId: 'c1', userId: 'u1' } as any);
      vi.mocked(prisma.assignmentScore.findUnique).mockResolvedValueOnce({ score: 10 } as any);
      vi.mocked(prisma.assignmentScore.upsert).mockResolvedValueOnce({ score: 15, passed: false } as any);

      const result = await updateImmersionAssignmentScore('a1', 'u1', 5);

      expect(result).toEqual({ score: 15, targetScore: 20, passed: false });
      expect(prisma.assignmentScore.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: { score: 15, passed: false }
      }));
    });
  });
});
