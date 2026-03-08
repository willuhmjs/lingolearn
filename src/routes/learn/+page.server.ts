import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Load assignment context if assignmentId is provided
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
			// Verify the user is a member of this class
			const member = await prisma.classMember.findUnique({
				where: {
					classId_userId: {
						classId: assignment.classId,
						userId: locals.user.id
					}
				}
			});
			if (!member) {
				assignment = null; // Hide assignment if user is not a member
			} else {
				assignmentScore = await prisma.assignmentScore.findUnique({
					where: {
						assignmentId_userId: {
							assignmentId,
							userId: locals.user.id
						}
					}
				});

				// Use assignment's language instead of user's active language if it's not international
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
			// If playing an assignment, they might not have onboarded for this language yet
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
