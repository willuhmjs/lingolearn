import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	let cefrLevel = 'A1';

	if (locals.user.activeLanguage?.id) {
		const progress = await prisma.userProgress.findUnique({
			where: {
				userId_languageId: {
					userId: locals.user.id,
					languageId: locals.user.activeLanguage.id
				}
			}
		});

		if (progress) {
			if (!progress.hasOnboarded) {
				throw redirect(302, '/onboarding');
			}
			cefrLevel = progress.cefrLevel;
		} else {
			throw redirect(302, '/onboarding');
		}
	} else {
		throw redirect(302, '/onboarding');
	}

	// Load assignment context if assignmentId is provided
	const assignmentId = url.searchParams.get('assignmentId');
	let assignment = null;
	let assignmentScore = null;

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
			}
		}
	}

	return {
		cefrLevel,
		language: locals.user.activeLanguage,
		assignment,
		assignmentScore
	};
};
