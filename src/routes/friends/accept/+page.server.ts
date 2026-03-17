import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ url, locals }) => {
  const session = await locals.auth();
  const token = url.searchParams.get('token');

  if (!token) {
    throw redirect(303, '/friends');
  }

  if (!session?.user?.id) {
    // Store the intended destination and redirect to login
    throw redirect(303, `/login?redirect=/friends/accept?token=${token}`);
  }

  // Look up the inviter by token
  const inviter = await prisma.user.findUnique({
    where: { friendInviteToken: token },
    select: { id: true, username: true, name: true, image: true }
  });

  if (!inviter) {
    return { error: 'Invalid or expired invite link', inviter: null, alreadyFriends: false };
  }

  if (inviter.id === session.user.id) {
    return { error: 'This is your own invite link.', inviter: null, alreadyFriends: false };
  }

  // Check existing relationship
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { initiatorId: session.user.id, receiverId: inviter.id },
        { initiatorId: inviter.id, receiverId: session.user.id }
      ]
    }
  });

  return {
    token,
    inviter,
    existing: existing ? true : null,
    error: null
  };
};
