import { json } from '@sveltejs/kit';
import {
  getAverageLoadTime,
  getSampleCount,
  getUserLocalAverage,
  getUserLocalSampleCount
} from '$lib/server/loadTimeStat';

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
