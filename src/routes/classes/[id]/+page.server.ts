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
							username: true
						}
					}
				},
				orderBy: {
					createdAt: 'asc'
				}
			},
			assignments: {
				include: {
					scores: true
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

	return {
		classDetails,
		currentUserRole: currentUserMember.role
	};
};
