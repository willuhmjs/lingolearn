/**
 * Rolling average tracker for generate-lesson response times.
 * Stores the last MAX_SAMPLES timings both in-memory and in the
 * SiteSettings singleton row so the average survives server restarts.
 */

import { prisma } from '$lib/server/prisma';

const MAX_SAMPLES = 20;

/** Default estimate (ms) when no data has been recorded yet. */
export const DEFAULT_LOAD_MS = 9000;

let samples: number[] = [];
let initialized = false;

/** Call once at server startup (e.g. from hooks.server.ts) to load stored samples. */
export async function initLoadTimeStat(): Promise<void> {
	if (initialized) return;
	try {
		const settings = await prisma.siteSettings.findUnique({
			where: { id: 'singleton' },
			select: { loadTimeSamples: true }
		});
		if (settings?.loadTimeSamples?.length) {
			samples = settings.loadTimeSamples.slice(-MAX_SAMPLES);
		}
		initialized = true;
		console.log(`[loadTimeStat] initialized with ${samples.length} stored sample(s), avg: ${getAverageLoadTime()}ms`);
	} catch (err) {
		console.error('[loadTimeStat] failed to load from DB, starting fresh:', err);
		initialized = true;
	}
}

export async function recordLoadTime(ms: number): Promise<void> {
	samples.push(ms);
	if (samples.length > MAX_SAMPLES) {
		samples.shift();
	}

	const avg = getAverageLoadTime();
	console.log(`[loadTimeStat] recorded load time: ${ms}ms | rolling avg (${samples.length}/${MAX_SAMPLES} samples): ${avg}ms`);

	try {
		await prisma.siteSettings.upsert({
			where: { id: 'singleton' },
			update: { loadTimeSamples: samples },
			create: { id: 'singleton', loadTimeSamples: samples }
		});
	} catch (err) {
		console.error('[loadTimeStat] failed to persist load time:', err);
	}
}

/** Returns the rolling average in milliseconds, or DEFAULT_LOAD_MS if no samples yet. */
export function getAverageLoadTime(): number {
	if (samples.length === 0) return DEFAULT_LOAD_MS;
	const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
	return Math.round(avg);
}

export function getSampleCount(): number {
	return samples.length;
}
