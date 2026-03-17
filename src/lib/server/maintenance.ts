/**
 * Self-managed maintenance jobs.
 *
 * Each job has an in-memory last-run timestamp. When `runMaintenanceIfDue()` is
 * called (from hooks.server.ts on every authenticated request) it checks each
 * job's interval, fires any overdue jobs as non-blocking background promises,
 * and immediately returns — so it adds zero latency to the request.
 *
 * If a job fails it logs the error and resets its timestamp so it will be
 * retried on the next request that comes in after the interval has elapsed again.
 * This makes the system entirely self-healing with no external scheduler.
 */

import { prisma } from './prisma';
import { CefrService } from './cefrService';
import { optimizeFsrsWeightsForUser } from './fsrsOptimizer';
import { runHlrFit } from './hlr';
import { runPfaFit } from './pfa';
import { runErrorCoMatrixFit } from './errorCoMatrix';

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

/** ELO decay: once per day (ms) */
const ELO_DECAY_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** FSRS weight optimization: once per day (ms) */
const FSRS_OPTIMIZE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** HLR weight fitting: once per day (ms) */
const HLR_FIT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** PFA parameter fitting: once per day (ms) */
const PFA_FIT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Error co-occurrence matrix fitting: once per day (ms) */
const ERROR_CO_MATRIX_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** ReviewLog prune: once per day (ms) — keeps the last 365 days of rows */
const REVIEW_LOG_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Chat message prune: once per day — keeps last 90 days */
const MESSAGE_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** AI usage prune: once per day — keeps last 30 days */
const AI_USAGE_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Live session prune: once per day — keeps finished sessions for 90 days */
const LIVE_SESSION_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// In-memory last-run timestamps (reset to 0 on process start so every job
// runs once shortly after boot, then on its regular interval thereafter).
// ---------------------------------------------------------------------------

let lastEloDecay = 0;
let lastFsrsOptimize = 0;
let lastHlrFit = 0;
let lastPfaFit = 0;
let lastErrorCoMatrixFit = 0;
let lastReviewLogPrune = 0;
let lastMessagePrune = 0;
let lastAiUsagePrune = 0;
let lastLiveSessionPrune = 0;

// ---------------------------------------------------------------------------
// Individual jobs
// ---------------------------------------------------------------------------

async function runFsrsOptimization(): Promise<void> {
  const progresses = await prisma.userProgress.findMany({
    where: { hasOnboarded: true },
    select: { userId: true }
  });

  // Deduplicate userIds (a user can have progress for multiple languages)
  const userIds = [...new Set(progresses.map((p) => p.userId))];

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  for (const userId of userIds) {
    try {
      const result = await optimizeFsrsWeightsForUser(userId);
      if (result) succeeded++;
      else skipped++;
    } catch (err) {
      console.error(`[maintenance] FSRS optimize failed user=${userId}:`, err);
      failed++;
    }
  }
  console.log(
    `[maintenance] FSRS optimization complete: ${succeeded} optimized, ${skipped} skipped (insufficient data), ${failed} failed / ${userIds.length} total`
  );
}

async function runEloDecay(): Promise<void> {
  const progresses = await prisma.userProgress.findMany({
    where: { hasOnboarded: true },
    select: { userId: true, languageId: true }
  });

  let succeeded = 0;
  let failed = 0;
  for (const { userId, languageId } of progresses) {
    try {
      await CefrService.applyEloDecay(userId, languageId);
      succeeded++;
    } catch (err) {
      console.error(`[maintenance] ELO decay failed user=${userId} lang=${languageId}:`, err);
      failed++;
    }
  }
  console.log(
    `[maintenance] ELO decay complete: ${succeeded} ok, ${failed} failed / ${progresses.length} total`
  );
}

async function pruneReviewLogs(): Promise<void> {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (prisma as any).reviewLog.deleteMany({
    where: { createdAt: { lt: cutoff } }
  });
  console.log(`[maintenance] ReviewLog prune: deleted ${result.count} rows older than 1 year`);
}

async function pruneMessages(): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  // Delete sessions (cascades to messages) that haven't been touched in 90 days.
  const result = await prisma.conversationSession.deleteMany({
    where: { updatedAt: { lt: cutoff } }
  });
  console.log(
    `[maintenance] ConversationSession prune: deleted ${result.count} sessions older than 90 days (messages cascade)`
  );
}

async function pruneAiUsage(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.userAiUsage.deleteMany({
    where: { date: { lt: cutoff } }
  });
  console.log(`[maintenance] UserAiUsage prune: deleted ${result.count} rows older than 30 days`);
}

async function pruneLiveSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  // Cascade deletes LiveSessionParticipant rows too.
  const result = await prisma.liveSession.deleteMany({
    where: { status: 'finished', updatedAt: { lt: cutoff } }
  });
  console.log(
    `[maintenance] LiveSession prune: deleted ${result.count} finished sessions older than 90 days`
  );
}

// ---------------------------------------------------------------------------
// Public entry point — call from hooks.server.ts on every authenticated request
// ---------------------------------------------------------------------------

/**
 * Checks each maintenance job's interval and fires any overdue jobs as
 * non-blocking background promises. Returns immediately — zero request latency.
 */
export function runMaintenanceIfDue(): void {
  const now = Date.now();

  if (now - lastEloDecay > ELO_DECAY_INTERVAL_MS) {
    lastEloDecay = now;
    runEloDecay().catch((err) => {
      console.error('[maintenance] ELO decay job failed:', err);
      lastEloDecay = 0; // reset so it retries next time
    });
  }

  if (now - lastFsrsOptimize > FSRS_OPTIMIZE_INTERVAL_MS) {
    lastFsrsOptimize = now;
    runFsrsOptimization().catch((err) => {
      console.error('[maintenance] FSRS optimization job failed:', err);
      lastFsrsOptimize = 0;
    });
  }

  if (now - lastHlrFit > HLR_FIT_INTERVAL_MS) {
    lastHlrFit = now;
    runHlrFit().catch((err) => {
      console.error('[maintenance] HLR fit job failed:', err);
      lastHlrFit = 0;
    });
  }

  if (now - lastPfaFit > PFA_FIT_INTERVAL_MS) {
    lastPfaFit = now;
    runPfaFit().catch((err) => {
      console.error('[maintenance] PFA fit job failed:', err);
      lastPfaFit = 0;
    });
  }

  if (now - lastErrorCoMatrixFit > ERROR_CO_MATRIX_INTERVAL_MS) {
    lastErrorCoMatrixFit = now;
    runErrorCoMatrixFit().catch((err) => {
      console.error('[maintenance] Error co-occurrence matrix fit failed:', err);
      lastErrorCoMatrixFit = 0;
    });
  }

  if (now - lastReviewLogPrune > REVIEW_LOG_PRUNE_INTERVAL_MS) {
    lastReviewLogPrune = now;
    pruneReviewLogs().catch((err) => {
      console.error('[maintenance] ReviewLog prune failed:', err);
      lastReviewLogPrune = 0;
    });
  }

  if (now - lastMessagePrune > MESSAGE_PRUNE_INTERVAL_MS) {
    lastMessagePrune = now;
    pruneMessages().catch((err) => {
      console.error('[maintenance] Message prune failed:', err);
      lastMessagePrune = 0;
    });
  }

  if (now - lastAiUsagePrune > AI_USAGE_PRUNE_INTERVAL_MS) {
    lastAiUsagePrune = now;
    pruneAiUsage().catch((err) => {
      console.error('[maintenance] AI usage prune failed:', err);
      lastAiUsagePrune = 0;
    });
  }

  if (now - lastLiveSessionPrune > LIVE_SESSION_PRUNE_INTERVAL_MS) {
    lastLiveSessionPrune = now;
    pruneLiveSessions().catch((err) => {
      console.error('[maintenance] LiveSession prune failed:', err);
      lastLiveSessionPrune = 0;
    });
  }
}
