import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getSiteSettings } from '$lib/server/settings';
import { checkUsernameAppropriate } from '$lib/server/llm';
import { getDailyUsage, DAILY_TOKEN_QUOTA } from '$lib/server/aiQuota';
import { CefrService } from '$lib/server/cefrService';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login');
  }

  const [user, settings, userProgress, aiUsage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: locals.user.id },
      select: {
        passwordHash: true,
        useLocalLlm: true,
        llmBaseUrl: true,
        llmApiKey: true,
        llmModel: true,
        theme: true,
        totalXp: true,
        streakFreezes: true,
        fsrsRetention: true
      }
    }),
    getSiteSettings(),
    prisma.userProgress.findMany({
      where: { userId: locals.user.id },
      include: { language: true }
    }),
    getDailyUsage(locals.user.id)
  ]);

  const languageProgress = await Promise.all(
    userProgress.map(async (p) => {
      const cefrProgress = await CefrService.getCefrProgress(locals.user!.id, p.languageId);
      return {
        languageId: p.languageId,
        languageName: p.language.name,
        flag: p.language.flag,
        cefrLevel: p.cefrLevel,
        cefrProgress
      };
    })
  );

  return {
    user: { ...locals.user, ...user },
    hasPassword: !!user?.passwordHash,
    localLoginEnabled: settings.localLoginEnabled,
    languageProgress,
    aiUsage: {
      tokensUsed: aiUsage?.tokensUsed ?? 0,
      goodWillTokens: aiUsage?.goodWillTokens ?? 0,
      effectiveUsage: aiUsage?.effectiveUsage ?? 0,
      dailyQuota: DAILY_TOKEN_QUOTA
    }
  };
};

const usernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(31, 'Username must be at most 31 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username may only contain letters, numbers, underscores, and hyphens'
    )
});

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(128)
});

export const actions: Actions = {
  updateUsername: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const data = Object.fromEntries(formData);
    const parsed = usernameSchema.safeParse(data);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid username';
      return fail(400, { usernameError: message });
    }

    const { username } = parsed.data;

    if (username === locals.user.username) {
      return fail(400, { usernameError: 'That is already your username' });
    }

    // Check classroom-friendliness via LLM
    const check = await checkUsernameAppropriate(username);
    if (!check.approved) {
      const message = check.reason
        ? `Username not allowed: ${check.reason}`
        : 'That username is not appropriate for a classroom environment.';
      return fail(400, { usernameError: message, usernameSuggestion: check.suggestion || null });
    }

    try {
      await prisma.user.update({
        where: { id: locals.user.id },
        data: { username }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return fail(400, { usernameError: 'That username is already taken' });
      }
      throw error;
    }

    return { usernameSuccess: 'Username updated successfully' };
  },

  updatePassword: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login');
    }

    const settings = await getSiteSettings();
    if (!settings.localLoginEnabled) {
      return fail(403, { error: 'Password updates are disabled because local login is disabled.' });
    }

    const formData = await request.formData();
    const data = Object.fromEntries(formData);
    const parsed = passwordSchema.safeParse(data);

    if (!parsed.success) {
      return fail(400, { error: 'Invalid input. Password must be at least 8 characters.' });
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: locals.user.id }
    });

    if (!user) {
      return fail(404, { error: 'User not found' });
    }

    if (user.passwordHash) {
      if (!currentPassword) {
        return fail(400, { error: 'Current password is required' });
      }
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        return fail(400, { error: 'Incorrect current password' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: locals.user.id },
      data: { passwordHash }
    });

    return { success: 'Password updated successfully' };
  },

  updateTheme: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const theme = formData.get('theme');

    if (!theme || typeof theme !== 'string' || !['default', 'dark'].includes(theme)) {
      return fail(400, { themeError: 'Invalid theme selected' });
    }

    await prisma.user.update({
      where: { id: locals.user.id },
      data: { theme }
    });

    return { themeSuccess: 'Theme updated successfully' };
  },

  updateLlmSettings: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login');
    }

    const formData = await request.formData();
    const useLocalLlm = formData.get('useLocalLlm') === 'on';
    const llmBaseUrl = formData.get('llmBaseUrl')?.toString() || null;
    const llmApiKey = formData.get('llmApiKey')?.toString() || null;
    const llmModel = formData.get('llmModel')?.toString() || null;

    try {
      await prisma.user.update({
        where: { id: locals.user.id },
        data: {
          useLocalLlm,
          llmBaseUrl,
          llmApiKey,
          llmModel
        }
      });

      return { llmSuccess: 'LLM settings updated successfully' };
    } catch (error) {
      console.error('Error updating LLM settings:', error);
      return fail(500, { llmError: 'Failed to update LLM settings' });
    }
  },

  updateFsrsRetention: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');

    const formData = await request.formData();
    const raw = formData.get('fsrsRetention');
    const value = parseFloat(raw?.toString() ?? '');
    if (isNaN(value) || value < 0.7 || value > 0.97) {
      return fail(400, { fsrsRetentionError: 'Retention must be between 0.70 and 0.97' });
    }

    await prisma.user.update({
      where: { id: locals.user.id },
      data: { fsrsRetention: value }
    });

    return { fsrsRetentionSuccess: 'Review frequency updated' };
  },

  deleteAccount: async ({ locals, cookies }) => {
    if (!locals.user) {
      throw redirect(303, '/login');
    }

    // Prisma will cascade delete UserVocabulary, UserGrammarRule, Accounts, Sessions
    // due to the onDelete: Cascade in the schema
    await prisma.user.delete({
      where: { id: locals.user.id }
    });

    // Clear auth cookies using Auth.js standard session cookie names
    // This ensures the user is logged out
    cookies.delete('authjs.session-token', { path: '/' });
    cookies.delete('authjs.csrf-token', { path: '/' });
    cookies.delete('authjs.callback-url', { path: '/' });

    // We could also call the signout endpoint, but redirecting to / with a cleared cookie usually works well
    // and we don't want to get stuck in a weird state.

    throw redirect(303, '/login');
  }
};
