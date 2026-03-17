import { error } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { ClassRole } from '@prisma/client';

/**
 * Ensures a user is a member of a class and optionally checks if they have a specific role.
 * Throws a 404 error if the class does not exist or the user is not a member.
 * Throws a 403 error if the user does not have the required role.
 *
 * @param classId The ID of the class to check
 * @param userId The ID of the user to check
 * @param requiredRole (Optional) The required role (e.g., 'TEACHER', 'STUDENT')
 * @returns The class member record if authorized
 */
export async function requireClassRole(classId: string, userId: string, requiredRole?: ClassRole) {
  const member = await prisma.classMember.findUnique({
    where: {
      classId_userId: {
        classId,
        userId
      }
    }
  });

  if (!member) {
    throw error(404, 'Class not found or you are not a member');
  }

  if (requiredRole && member.role !== requiredRole) {
    throw error(403, `Requires ${requiredRole} role`);
  }

  return member;
}
