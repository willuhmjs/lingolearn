import { z } from 'zod';
import { prisma } from '$lib/server/prisma';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import bcrypt from 'bcrypt';
import { encrypt } from '$lib/server/crypto';
import { Prisma } from '@prisma/client';
import { getSiteSettings } from '$lib/server/settings';
import { checkUsernameAppropriate } from '$lib/server/llm';

const signupSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(31, 'Username must be at most 31 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username may only contain letters, numbers, underscores, and hyphens'
    ),
  email: z.email().max(128),
  password: z.string().max(128)
});

export const load: PageServerLoad = async () => {
  const settings = await getSiteSettings();
  return { localLoginEnabled: settings.localLoginEnabled };
};

export const actions = {
  default: async (event) => {
    const settings = await getSiteSettings();
    if (!settings.localLoginEnabled) {
      return fail(403, { error: 'Local signup is disabled' });
    }

    const formData = await event.request.formData();
    const data = Object.fromEntries(formData);

    const parsed = signupSchema.safeParse(data);
    if (!parsed.success) {
      return fail(400, { error: 'Invalid input' });
    }

    const { username, email, password } = parsed.data;

    // Check username is classroom-friendly via LLM
    const usernameCheck = await checkUsernameAppropriate(username);
    if (!usernameCheck.approved) {
      const suggestion = usernameCheck.suggestion || null;
      const message = usernameCheck.reason
        ? `Username not allowed: ${usernameCheck.reason}`
        : 'That username is not appropriate for a classroom environment.';
      return fail(400, { error: message, usernameSuggestion: suggestion });
    }

    // Hash and encrypt password
    const rawHash = await bcrypt.hash(password, 10);
    const passwordHash = encrypt(rawHash);

    // Create user — rely on DB unique constraints for race-condition safety.
    // Role assignment runs in the same transaction to eliminate TOCTOU.
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            email,
            passwordHash,
            role: 'USER'
          }
        });
        const count = await tx.user.count();
        if (count === 1) {
          return tx.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' }
          });
        }
        return user;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.includes('email')) {
          return fail(400, { error: 'An account with this email already exists' });
        }
        if (target.includes('username')) {
          return fail(400, { error: 'This username is already taken' });
        }
        return fail(400, { error: 'Username or email already exists' });
      }
      throw error;
    }

    throw redirect(302, '/login');
  }
} satisfies Actions;
