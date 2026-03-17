import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { randomBytes } from 'crypto';
import type { RequestHandler } from './$types';

// GET — return (or generate) the current user's invite token
export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { friendInviteToken: true }
  });

  if (!user) {
    return json({ error: 'User not found' }, { status: 404 });
  }

  if (user.friendInviteToken) {
    return json({ token: user.friendInviteToken });
  }

  // Generate a new token
  const token = randomBytes(16).toString('hex');
  await prisma.user.update({
    where: { id: session.user.id },
    data: { friendInviteToken: token }
  });

  return json({ token });
};
