import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ initiatorId: session.user.id }, { receiverId: session.user.id }]
      },
      include: {
        initiator: {
          select: { id: true, username: true, name: true, image: true }
        },
        receiver: {
          select: { id: true, username: true, name: true, image: true }
        }
      }
    });

    return json({ friendships });
  } catch (error) {
    console.error('Failed to fetch friends:', error);
    return json({ error: 'Failed to fetch friends' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { receiverUsername } = await request.json();

    if (!receiverUsername) {
      return json({ error: 'Receiver username is required' }, { status: 400 });
    }

    const receiver = await prisma.user.findUnique({
      where: { username: receiverUsername }
    });

    if (!receiver) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    if (receiver.id === session.user.id) {
      return json({ error: 'You cannot add yourself as a friend' }, { status: 400 });
    }

    // Check if friendship already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: session.user.id, receiverId: receiver.id },
          { initiatorId: receiver.id, receiverId: session.user.id }
        ]
      }
    });

    if (existing) {
      return json({ error: 'Friendship already exists or is pending' }, { status: 400 });
    }

    const friendship = await prisma.friendship.create({
      data: {
        initiatorId: session.user.id,
        receiverId: receiver.id,
        status: 'PENDING'
      }
    });

    return json({ friendship });
  } catch (error) {
    console.error('Failed to send friend request:', error);
    return json({ error: 'Failed to send friend request' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { friendshipId, status } = await request.json();

    if (!friendshipId || !['ACCEPTED', 'DECLINED', 'BLOCKED'].includes(status)) {
      return json({ error: 'Invalid data' }, { status: 400 });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return json({ error: 'Friendship not found' }, { status: 404 });
    }

    // Only the receiver can accept/decline a pending request
    // Or either party can block? Let's say only the person receiving the request can accept/decline.
    if (friendship.receiverId !== session.user.id && status !== 'BLOCKED') {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status }
    });

    return json({ friendship: updated });
  } catch (error) {
    console.error('Failed to update friendship:', error);
    return json({ error: 'Failed to update friendship' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { friendshipId } = await request.json();

    if (!friendshipId) {
      return json({ error: 'Friendship ID is required' }, { status: 400 });
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return json({ error: 'Friendship not found' }, { status: 404 });
    }

    if (friendship.initiatorId !== session.user.id && friendship.receiverId !== session.user.id) {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.friendship.delete({
      where: { id: friendshipId }
    });

    return json({ success: true });
  } catch (error) {
    console.error('Failed to delete friendship:', error);
    return json({ error: 'Failed to delete friendship' }, { status: 500 });
  }
};
