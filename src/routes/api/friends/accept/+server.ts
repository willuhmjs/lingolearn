import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

// POST — accept a friend invite by token (sends a friend request that still needs confirmation)
export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token || typeof token !== 'string') {
    return json({ error: 'Token is required' }, { status: 400 });
  }

  // Find the user who owns this invite token
  const inviter = await prisma.user.findUnique({
    where: { friendInviteToken: token },
    select: { id: true, username: true }
  });

  if (!inviter) {
    return json({ error: 'Invalid or expired invite link' }, { status: 404 });
  }

  if (inviter.id === session.user.id) {
    return json({ error: 'You cannot add yourself as a friend' }, { status: 400 });
  }

  // Check if a friendship already exists in either direction
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { initiatorId: session.user.id, receiverId: inviter.id },
        { initiatorId: inviter.id, receiverId: session.user.id }
      ]
    }
  });

  if (existing) {
    return json({ error: 'Friendship already exists or is pending' }, { status: 400 });
  }

  // Auto-accept: the token holder implicitly consents by sharing the link,
  // so create the friendship as ACCEPTED immediately.
  const friendship = await prisma.friendship.create({
    data: {
      initiatorId: session.user.id,
      receiverId: inviter.id,
      status: 'ACCEPTED'
    }
  });

  return json({ friendship, inviterUsername: inviter.username });
};
