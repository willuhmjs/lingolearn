import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export async function DELETE({ params, locals }) {
	if (!locals.user || locals.user.role !== 'ADMIN') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await prisma.vocabulary.delete({
			where: { id: params.id }
		});
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting vocabulary:', error);
		return json({ error: 'Failed to delete vocabulary' }, { status: 500 });
	}
}
