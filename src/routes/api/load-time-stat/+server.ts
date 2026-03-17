import { json } from '@sveltejs/kit';
import {
  getAverageLoadTime,
  getSampleCount,
  recordLoadTime,
  getUserLocalAverage,
  getUserLocalSampleCount,
  recordUserLocalLoadTime
} from '$lib/server/loadTimeStat';

// Throttle: one contribution per user per 60 seconds to prevent stat poisoning.
const userLastContribution = new Map<string, number>();
const CONTRIBUTION_THROTTLE_MS = 60_000;

export async function GET({ locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isLocalMode = !!locals.user.useLocalLlm;

  if (isLocalMode) {
    const [averageMs, sampleCount] = await Promise.all([
      getUserLocalAverage(locals.user.id),
      getUserLocalSampleCount(locals.user.id)
    ]);
    return json({ averageMs, sampleCount, isLocalMode });
  }

  return json({
    averageMs: getAverageLoadTime(),
    sampleCount: getSampleCount(),
    isLocalMode
  });
}

export async function POST({ locals, request }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { loadTimeMs } = await request.json();

    if (
      typeof loadTimeMs !== 'number' ||
      isNaN(loadTimeMs) ||
      loadTimeMs < 0 ||
      loadTimeMs > 60000
    ) {
      return json({ error: 'Invalid load time value' }, { status: 400 });
    }

    // Throttle: accept at most one sample per user per minute
    const now = Date.now();
    const last = userLastContribution.get(locals.user.id);
    if (last && now - last < CONTRIBUTION_THROTTLE_MS) {
      return json({ success: true, throttled: true });
    }
    userLastContribution.set(locals.user.id, now);

    const isLocalMode = !!locals.user.useLocalLlm;
    if (isLocalMode) {
      await recordUserLocalLoadTime(locals.user.id, loadTimeMs);
    } else {
      await recordLoadTime(loadTimeMs);
    }
    return json({ success: true, isLocalMode });
  } catch {
    return json({ error: 'Invalid payload' }, { status: 400 });
  }
}
