/**
 * Rolling average tracker for generate-lesson response times.
 * Public AI timings are stored globally in SiteSettings (in-memory + DB).
 * Local AI timings are stored per-user in User.localLoadTimeSamples (DB only),
 * since each user runs their own hardware/model with different performance.
 */

import { prisma } from '$lib/server/prisma';

const MAX_SAMPLES = 20;

/** Default estimate (ms) when no data has been recorded yet. */
export const DEFAULT_LOAD_MS = 9000;

let publicSamples: number[] = [];
let initialized = false;

/** Call once at server startup (e.g. from hooks.server.ts) to load stored public samples. */
export async function initLoadTimeStat(): Promise<void> {
  if (initialized) return;
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 'singleton' },
      select: { loadTimeSamples: true }
    });
    if (settings?.loadTimeSamples?.length) {
      publicSamples = settings.loadTimeSamples.slice(-MAX_SAMPLES);
    }
    initialized = true;
    console.log(
      `[loadTimeStat] initialized with ${publicSamples.length} public stored sample(s), avg: ${getAverageLoadTime()}ms`
    );
  } catch (err) {
    console.error('[loadTimeStat] failed to load from DB, starting fresh:', err);
    initialized = true;
  }
}

/** Record a public AI load time into the global rolling average. */
export async function recordLoadTime(ms: number): Promise<void> {
  publicSamples.push(ms);
  if (publicSamples.length > MAX_SAMPLES) {
    publicSamples.shift();
  }

  const avg = getAverageLoadTime();
  console.log(
    `[loadTimeStat] recorded public load time: ${ms}ms | rolling avg (${publicSamples.length}/${MAX_SAMPLES} samples): ${avg}ms`
  );

  try {
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      update: { loadTimeSamples: publicSamples },
      create: { id: 'singleton', loadTimeSamples: publicSamples }
    });
  } catch (err) {
    console.error('[loadTimeStat] failed to persist public load time:', err);
  }
}

/** Record a local AI load time for a specific user. */
export async function recordUserLocalLoadTime(userId: string, ms: number): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { localLoadTimeSamples: true }
    });
    const samples = (user?.localLoadTimeSamples ?? []).slice(-MAX_SAMPLES);
    samples.push(ms);
    if (samples.length > MAX_SAMPLES) {
      samples.shift();
    }
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    console.log(
      `[loadTimeStat] recorded local load time for user ${userId}: ${ms}ms | rolling avg (${samples.length}/${MAX_SAMPLES} samples): ${Math.round(avg)}ms`
    );
    await prisma.user.update({
      where: { id: userId },
      data: { localLoadTimeSamples: samples }
    });
  } catch (err) {
    console.error('[loadTimeStat] failed to persist local load time for user:', err);
  }
}

/** Returns the global public AI rolling average, or DEFAULT_LOAD_MS if no samples yet. */
export function getAverageLoadTime(): number {
  if (publicSamples.length === 0) return DEFAULT_LOAD_MS;
  const avg = publicSamples.reduce((a, b) => a + b, 0) / publicSamples.length;
  return Math.round(avg);
}

export function getSampleCount(): number {
  return publicSamples.length;
}

/** Returns the per-user local AI rolling average, or DEFAULT_LOAD_MS if no samples yet. */
export async function getUserLocalAverage(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { localLoadTimeSamples: true }
    });
    const samples = user?.localLoadTimeSamples ?? [];
    if (samples.length === 0) return DEFAULT_LOAD_MS;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    return Math.round(avg);
  } catch {
    return DEFAULT_LOAD_MS;
  }
}

export async function getUserLocalSampleCount(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { localLoadTimeSamples: true }
    });
    return user?.localLoadTimeSamples?.length ?? 0;
  } catch {
    return 0;
  }
}
