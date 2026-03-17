import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { CefrService } from '$lib/server/cefrService';
import type { RequestEvent } from '@sveltejs/kit';

export async function PUT({ params, request, locals }: RequestEvent) {
  if (!locals.user || locals.user.role !== 'ADMIN') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const { username, email, role, progress } = body;

    // Validate role
    if (role && !['USER', 'ADMIN'].includes(role)) {
      return json({ error: 'Invalid role. Must be USER or ADMIN.' }, { status: 400 });
    }

    // Prevent admin from removing their own admin role
    if (id === locals.user!.id && role && role !== 'ADMIN') {
      return json({ error: 'You cannot remove your own admin role.' }, { status: 400 });
    }

    const updateData: Record<string, string | boolean> = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;

    // Snapshot existing CEFR levels before the transaction so we can compute mastery changes
    const progressUpdates =
      progress && Array.isArray(progress)
        ? progress.filter(
            (p: { languageId?: string; cefrLevel?: string }) => p.languageId && p.cefrLevel
          )
        : [];

    const existingProgressRecords =
      progressUpdates.length > 0
        ? await prisma.userProgress.findMany({
            where: {
              userId: id!,
              languageId: { in: progressUpdates.map((p: { languageId: string }) => p.languageId) }
            },
            select: { languageId: true, cefrLevel: true }
          })
        : [];

    const oldLevelMap = new Map(existingProgressRecords.map((r) => [r.languageId, r.cefrLevel]));

    // Run in a transaction if we are updating user progress
    const [user] = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: id! },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true
        }
      });

      if (progressUpdates.length > 0) {
        for (const p of progressUpdates) {
          await tx.userProgress.upsert({
            where: {
              userId_languageId: {
                userId: id!,
                languageId: p.languageId
              }
            },
            update: {
              cefrLevel: p.cefrLevel,
              hasOnboarded: Boolean(p.hasOnboarded ?? false)
            },
            create: {
              userId: id!,
              languageId: p.languageId,
              cefrLevel: p.cefrLevel,
              hasOnboarded: Boolean(p.hasOnboarded ?? true)
            }
          });
        }
      }

      return [u];
    });

    // Apply grammar mastery changes outside the transaction (can be slow for large data sets)
    for (const p of progressUpdates) {
      const oldLevel = oldLevelMap.get(p.languageId);
      await CefrService.applyGrammarMasteryForLevel(id!, p.languageId, p.cefrLevel, oldLevel);
    }

    return json({ user });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: { target?: string[] } };
      if (prismaError.code === 'P2002') {
        const target = prismaError.meta?.target?.[0] || 'field';
        return json({ error: `A user with that ${target} already exists.` }, { status: 409 });
      }
      if (prismaError.code === 'P2025') {
        return json({ error: 'User not found.' }, { status: 404 });
      }
    }
    console.error('Failed to update user:', error);
    return json({ error: 'Failed to update user.' }, { status: 500 });
  }
}

export async function DELETE({ params, locals }: RequestEvent) {
  if (!locals.user || locals.user.role !== 'ADMIN') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  // Prevent admin from deleting themselves
  if (id === locals.user!.id) {
    return json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string };
      if (prismaError.code === 'P2025') {
        return json({ error: 'User not found.' }, { status: 404 });
      }
    }
    console.error('Failed to delete user:', error);
    return json({ error: 'Failed to delete user.' }, { status: 500 });
  }
}
