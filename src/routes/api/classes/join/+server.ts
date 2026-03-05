import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { inviteCode } = await request.json();

		if (!inviteCode || typeof inviteCode !== 'string') {
			return json({ error: 'Invite code is required' }, { status: 400 });
		}

		// Enforce user membership limit
		const joinedClassesCount = await prisma.classMember.count({
			where: { userId: locals.user.id }
		});

		if (joinedClassesCount >= 20) {
			return json({ error: 'Maximum classes joined limit reached (20)' }, { status: 403 });
		}

		const targetClass = await prisma.class.findUnique({
			where: { inviteCode },
			include: {
				members: {
					where: {
						userId: locals.user.id
					}
				},
				_count: {
					select: { members: true }
				}
			}
		});

		if (!targetClass) {
			return json({ error: 'Invalid invite code' }, { status: 404 });
		}

		if (targetClass.members.length > 0) {
			return json({ error: 'You are already a member of this class' }, { status: 400 });
		}

		if (targetClass._count.members >= 20) {
			return json({ error: 'This class has reached the maximum number of members (20)' }, { status: 403 });
		}

		const classMember = await prisma.classMember.create({
			data: {
				classId: targetClass.id,
				userId: locals.user.id,
				role: 'STUDENT'
			}
		});

		return json({ success: true, class: targetClass });
	} catch (error) {
		console.error('Failed to join class:', error);
		return json({ error: 'Failed to join class' }, { status: 500 });
	}
};
