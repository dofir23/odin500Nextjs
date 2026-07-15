// Starts paper background jobs (snapshot daily, pending limit orders every 4h by default).
// Pattern: services/snapshotRefresher.js

const { runPaperSnapshot } = require('../jobs/paperSnapshotJob');
const { checkPendingOrders } = require('../jobs/pendingOrderWatcher');
const { runStrategiesOnce } = require('./paper/strategyRunner');
const { runPaperSplitAdjustmentJob } = require('../jobs/paperSplitAdjustmentJob');

const ENABLE = process.env.ENABLE_PAPER_JOBS === '1';
/** Default: once per day (86_400_000 ms). Override with PAPER_SNAPSHOT_INTERVAL_MS. */
const SNAPSHOT_MS = Number(process.env.PAPER_SNAPSHOT_INTERVAL_MS || 86400000);
/** Default: every 4 hours (14_400_000 ms). Override with PAPER_PENDING_ORDER_MS. */
const PENDING_MS = Number(process.env.PAPER_PENDING_ORDER_MS || 14400000);
/** Default 1 hour — Odin signals/prices update on a daily cadence; override via PAPER_STRATEGY_INTERVAL_MS. */
const STRATEGY_MS = Number(process.env.PAPER_STRATEGY_INTERVAL_MS || 3600000);

/** Default: every 6 hours. Override with PAPER_SPLIT_ADJUST_MS. */
const SPLIT_ADJUST_MS = Number(process.env.PAPER_SPLIT_ADJUST_MS || 21600000);

let snapshotTimer = null;
let pendingTimer = null;
let strategyTimer = null;
let splitAdjustTimer = null;
let snapshotRunning = false;
let pendingRunning = false;
let strategyRunning = false;
let splitAdjustRunning = false;

async function runSnapshotOnce() {
  if (snapshotRunning) return;
  snapshotRunning = true;
  const started = Date.now();
  try {
    const info = await runPaperSnapshot();
    console.log(
      `[paper-snapshot] ok in ${Date.now() - started}ms (accounts=${info.count})`
    );
  } catch (err) {
    console.error('[paper-snapshot] failed:', err?.message || err);
  } finally {
    snapshotRunning = false;
  }
}

async function runPendingOnce() {
  if (pendingRunning) return;
  pendingRunning = true;
  try {
    const info = await checkPendingOrders();
    if (info.filled > 0) {
      console.log(`[paper-pending-watcher] filled ${info.filled} order(s)`);
    }
  } catch (err) {
    console.error('[paper-pending-watcher] failed:', err?.message || err);
  } finally {
    pendingRunning = false;
  }
}

async function runStrategiesLoopOnce() {
  if (strategyRunning) return;
  strategyRunning = true;
  try {
    const out = await runStrategiesOnce();
    if (out.triggered > 0 || out.failed > 0) {
      console.log(`[paper-strategy-runner] triggered=${out.triggered} failed=${out.failed}`);
    }
  } catch (err) {
    console.error('[paper-strategy-runner] failed:', err?.message || err);
  } finally {
    strategyRunning = false;
  }
}

async function runSplitAdjustOnce() {
  if (splitAdjustRunning) return;
  splitAdjustRunning = true;
  try {
    const info = await runPaperSplitAdjustmentJob();
    if (!info.skipped && info.adjusted > 0) {
      console.log(`[paper-split-adjust] adjusted ${info.adjusted} lot/order row(s)`);
    }
  } catch (err) {
    console.error('[paper-split-adjust] failed:', err?.message || err);
  } finally {
    splitAdjustRunning = false;
  }
}

function startPaperJobs() {
  if (!ENABLE) {
    console.log('[paper-jobs] disabled (set ENABLE_PAPER_JOBS=1 to enable; default is off to reduce BigQuery cost)');
    return;
  }

  const snapMs = Number.isFinite(SNAPSHOT_MS) && SNAPSHOT_MS > 0 ? SNAPSHOT_MS : 86400000;
  const pendMs = Number.isFinite(PENDING_MS) && PENDING_MS > 0 ? PENDING_MS : 14400000;
  const stratMs = Number.isFinite(STRATEGY_MS) && STRATEGY_MS > 0 ? STRATEGY_MS : 3600000;
  const splitAdjMs = Number.isFinite(SPLIT_ADJUST_MS) && SPLIT_ADJUST_MS > 0 ? SPLIT_ADJUST_MS : 21600000;

  void runSnapshotOnce();
  snapshotTimer = setInterval(() => {
    void runSnapshotOnce();
  }, snapMs);
  if (typeof snapshotTimer?.unref === 'function') snapshotTimer.unref();

  void runPendingOnce();
  pendingTimer = setInterval(() => {
    void runPendingOnce();
  }, pendMs);
  if (typeof pendingTimer?.unref === 'function') pendingTimer.unref();

  void runStrategiesLoopOnce();
  strategyTimer = setInterval(() => {
    void runStrategiesLoopOnce();
  }, stratMs);
  if (typeof strategyTimer?.unref === 'function') strategyTimer.unref();

  void runSplitAdjustOnce();
  splitAdjustTimer = setInterval(() => {
    void runSplitAdjustOnce();
  }, splitAdjMs);
  if (typeof splitAdjustTimer?.unref === 'function') splitAdjustTimer.unref();

  console.log(`[paper-jobs] started (snapshot=${snapMs}ms, pending=${pendMs}ms, strategy=${stratMs}ms, splitAdjust=${splitAdjMs}ms)`);
}

module.exports = { startPaperJobs };
