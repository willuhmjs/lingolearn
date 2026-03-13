import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requireClassRole } from '$lib/server/classAuth';
import { randomBytes } from 'crypto';

function generateInviteCode(length = 6) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const bytes = randomBytes(length);
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars[bytes[i] % chars.length];
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
		if (locals.user.role !== 'ADMIN') {
			await requireClassRole(classId, locals.user.id, 'TEACHER');
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
