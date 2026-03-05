import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { name, description, primaryLanguage } = await request.json();

		if (!name || typeof name !== 'string') {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		// Generate a 6-character alphanumeric invite code
		const generateInviteCode = () => {
			const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
			let code = '';
			for (let i = 0; i < 6; i++) {
				code += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return code;
		};

		let inviteCode = generateInviteCode();
		let isUnique = false;

		// Ensure invite code uniqueness
		while (!isUnique) {
			const existingClass = await prisma.class.findUnique({
				where: { inviteCode }
			});
			if (!existingClass) {
				isUnique = true;
			} else {
				inviteCode = generateInviteCode();
			}
		}

		const newClass = await prisma.class.create({
			data: {
				name,
				description: description || null,
				primaryLanguage: primaryLanguage || 'international',
				inviteCode,
				members: {
					create: {
						userId: locals.user.id,
						role: 'TEACHER'
					}
				}
			}
		});

		return json({ class: newClass });
	} catch (error) {
		console.error('Failed to create class:', error);
		return json({ error: 'Failed to create class' }, { status: 500 });
	}
};
