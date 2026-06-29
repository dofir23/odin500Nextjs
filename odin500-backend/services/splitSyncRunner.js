const { runSplitSync } = require('../jobs/splitSyncJob');
const { runPaperSplitAdjustmentJob } = require('../jobs/paperSplitAdjustmentJob');

const ENABLE = process.env.ENABLE_SPLIT_SYNC !== '0';
/** Default: once per day. */
const INTERVAL_MS = Number(process.env.SPLITS_SYNC_INTERVAL_MS || 86400000);

let timer = null;
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  const started = Date.now();
  try {
    const info = await runSplitSync();
    if (info.skipped) {
      console.log(`[split-sync] skipped (${info.reason})`);
      return;
    }
    console.log(
      `[split-sync] ok in ${Date.now() - started}ms (since=${info.since}, fetched=${info.fetched}, inserted=${info.inserted})`
    );
    const adj = await runPaperSplitAdjustmentJob();
    if (!adj.skipped && adj.adjusted > 0) {
      console.log(`[paper-split-adjust] applied ${adj.adjusted} adjustment(s) after split sync`);
    }
  } catch (err) {
    console.error('[split-sync] failed:', err?.message || err);
  } finally {
    running = false;
  }
}

function startSplitSyncRunner() {
  if (!ENABLE) {
    console.log('[split-sync] disabled (set ENABLE_SPLIT_SYNC=0 to disable; default is on when MASSIVE_API_KEY is set)');
    return;
  }
  if (!process.env.MASSIVE_API_KEY) {
    console.log('[split-sync] disabled (MASSIVE_API_KEY not set — add to .env and restart the server)');
    return;
  }
  const ms = Number.isFinite(INTERVAL_MS) && INTERVAL_MS > 0 ? INTERVAL_MS : 86400000;
  void runOnce();
  timer = setInterval(() => {
    void runOnce();
  }, ms);
  if (typeof timer?.unref === 'function') timer.unref();
  console.log(`[split-sync] started (${ms}ms interval)`);
}

module.exports = { startSplitSyncRunner, runSplitSyncOnce: runOnce };
