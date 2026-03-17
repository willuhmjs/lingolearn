import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    redirect(302, '/login');
  }

  const classId = params.id;

  const classDetails = await prisma.class.findUnique({
    where: {
      id: classId
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              totalXp: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      },
      assignments: {
        include: {
          scores: true,
          game: {
            select: {
              id: true,
              title: true,
              isPublished: true,
              _count: { select: { questions: true } }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  if (!classDetails) {
    error(404, 'Class not found');
  }

  // Check if the current user is a member of this class
  const currentUserMember = classDetails.members.find((m) => m.userId === locals.user?.id);

  if (!currentUserMember) {
    error(403, 'You are not a member of this class');
  }

  let languages: any[] = [];
  let teacherGames: Array<{
    id: string;
    title: string;
    language: string;
    isPublished: boolean;
    _count: { questions: number };
  }> = [];
  if (currentUserMember.role === 'TEACHER') {
    [languages, teacherGames] = await Promise.all([
      prisma.language.findMany({
        include: {
          grammarRules: {
            orderBy: [{ level: 'asc' }, { title: 'asc' }]
          }
        }
      }),
      prisma.game.findMany({
        where: {
          OR: [{ creatorId: locals.user!.id }, { isPublished: true }]
        },
        select: {
          id: true,
          title: true,
          language: true,
          isPublished: true,
          _count: { select: { questions: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);
  }

  return {
    classDetails,
    currentUserRole: currentUserMember.role,
    languages,
    teacherGames
  };
};
