import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

function generateInviteCode(length = 6) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const classId = params.id;

		// Verify the user is a TEACHER in this class
		const member = await prisma.classMember.findUnique({
			where: {
				classId_userId: { classId, userId: locals.user.id }
			}
		});

		if (!member || member.role !== 'TEACHER') {
			return json({ error: 'Forbidden: Only teachers can reset the invite code' }, { status: 403 });
		}

		// Generate a new unique code
		let newCode = generateInviteCode();
		let codeExists = true;
		while (codeExists) {
			const existingClass = await prisma.class.findUnique({ where: { inviteCode: newCode } });
			if (!existingClass) {
				codeExists = false;
			} else {
				newCode = generateInviteCode();
			}
		}

		const updatedClass = await prisma.class.update({
			where: { id: classId },
			data: { inviteCode: newCode }
		});

		return json({ success: true, inviteCode: updatedClass.inviteCode });
	} catch (error) {
		console.error('Failed to reset invite code:', error);
		return json({ error: 'Failed to reset invite code' }, { status: 500 });
	}
};
