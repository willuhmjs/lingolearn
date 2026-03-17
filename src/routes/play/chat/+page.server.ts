import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  const assignmentId = url.searchParams.get('assignmentId');
  let assignment = null;
  let assignmentScore = null;
  let activeLanguage = locals.user.activeLanguage;

  if (assignmentId) {
    assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        class: {
          select: { id: true, name: true }
        }
      }
    });

    if (assignment) {
      const member = await prisma.classMember.findUnique({
        where: {
          classId_userId: {
            classId: assignment.classId,
            userId: locals.user.id
          }
        }
      });

      if (!member) {
        assignment = null;
      } else {
        assignmentScore = await prisma.assignmentScore.findUnique({
          where: {
            assignmentId_userId: {
              assignmentId,
              userId: locals.user.id
            }
          }
        });

        if (assignment.language && assignment.language !== 'international') {
          const assignmentLanguage = await prisma.language.findUnique({
            where: { code: assignment.language }
          });
          if (assignmentLanguage) {
            activeLanguage = assignmentLanguage;
          }
        }
      }
    }
  }

  let cefrLevel = 'A1';

  if (activeLanguage?.id) {
    const progress = await prisma.userProgress.findUnique({
      where: {
        userId_languageId: {
          userId: locals.user.id,
          languageId: activeLanguage.id
        }
      }
    });

    if (progress) {
      if (!progress.hasOnboarded) {
        throw redirect(302, `/onboarding?languageId=${activeLanguage.id}`);
      }
      cefrLevel = progress.cefrLevel;
    } else {
      if (assignment) {
        cefrLevel = assignment.targetCefrLevel || 'A1';
      } else {
        throw redirect(302, `/onboarding?languageId=${activeLanguage.id}`);
      }
    }
  } else {
    throw redirect(302, '/onboarding');
  }

  return {
    cefrLevel,
    language: activeLanguage,
    assignment,
    assignmentScore
  };
};
