const { listDueAiManagedAccounts, rebalanceAccount } = require('../services/paper/aiRebalancer');

/** Rebalances every AI-managed account whose cadence has elapsed. Off by default — see services/aiRebalanceRunner.js. */
async function runAiRebalanceJob() {
  const due = await listDueAiManagedAccounts();
  if (!due.length) return { count: 0, ok: 0, failed: 0 };

  let ok = 0;
  let failed = 0;
  for (const account of due) {
    try {
      const result = await rebalanceAccount(account);
      if (result.status === 'ok' || result.status === 'partial') ok += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error(`[ai-rebalance] account ${account.id} failed:`, err?.message || err);
    }
  }
  return { count: due.length, ok, failed };
}

module.exports = { runAiRebalanceJob };
