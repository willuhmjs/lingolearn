import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { timezone } = await request.json();

  if (!timezone || typeof timezone !== 'string' || timezone.length > 100) {
    return json({ error: 'Invalid timezone' }, { status: 400 });
  }

  // Only set timezone once — don't overwrite if already saved
  const user = await prisma.user.findUnique({
    where: { id: locals.user.id },
    select: { timezone: true }
  });

  if (user?.timezone) {
    return json({ ok: true, alreadySet: true });
  }

  await prisma.user.update({
    where: { id: locals.user.id },
    data: { timezone }
  });

  return json({ ok: true });
}
