// Starts the AI-managed-portfolio rebalance job. Off by default — see ENABLE_AI_REBALANCE.
// Pattern: services/paperJobRunner.js

const { runAiRebalanceJob } = require('../jobs/aiRebalanceJob');

const ENABLE = process.env.ENABLE_AI_REBALANCE === '1';
/** Loop ticks daily by default; each account only actually rebalances once its own cadence elapses. */
const INTERVAL_MS = Number(process.env.AI_REBALANCE_INTERVAL_MS || 86400000);

let timer = null;
let running = false;

async function runAiRebalanceOnce() {
  if (running) return;
  running = true;
  const started = Date.now();
  try {
    const info = await runAiRebalanceJob();
    if (info.count > 0) {
      console.log(
        `[ai-rebalance] ok in ${Date.now() - started}ms (due=${info.count}, ok=${info.ok}, failed=${info.failed})`
      );
    }
  } catch (err) {
    console.error('[ai-rebalance] failed:', err?.message || err);
  } finally {
    running = false;
  }
}

function startAiRebalanceRunner() {
  if (!ENABLE) {
    console.log('[ai-rebalance] disabled (set ENABLE_AI_REBALANCE=1 to enable; default is off)');
    return;
  }

  const ms = Number.isFinite(INTERVAL_MS) && INTERVAL_MS > 0 ? INTERVAL_MS : 86400000;

  void runAiRebalanceOnce();
  timer = setInterval(() => {
    void runAiRebalanceOnce();
  }, ms);
  if (typeof timer?.unref === 'function') timer.unref();

  console.log(`[ai-rebalance] started (interval=${ms}ms)`);
}

module.exports = { startAiRebalanceRunner, runAiRebalanceOnce };
