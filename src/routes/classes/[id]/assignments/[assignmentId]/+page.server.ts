import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	const { id: classId, assignmentId } = params;

	// Verify class and get assignment with member scores
	const classDetails = await prisma.class.findUnique({
		where: { id: classId },
		include: {
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							username: true
						}
					}
				},
				orderBy: {
					createdAt: 'asc'
				}
			}
		}
	});

	if (!classDetails) {
		error(404, 'Class not found');
	}

	// Check if current user is teacher
	const currentUserMember = classDetails.members.find((m) => m.userId === locals.user?.id);
	if (!currentUserMember || currentUserMember.role !== 'TEACHER') {
		error(403, 'Only teachers can view assignment details');
	}

	const assignment = await prisma.assignment.findUnique({
		where: { id: assignmentId },
		include: {
			scores: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							username: true
						}
					}
				},
				orderBy: {
					score: 'desc'
				}
			}
		}
	});

	if (!assignment || assignment.classId !== classId) {
		error(404, 'Assignment not found');
	}

	return {
		assignment,
		classDetails
	};
};