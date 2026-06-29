// Portfolio equity snapshots for all paper accounts (interval: paperJobRunner, default daily).
// Pattern: services/snapshotRefresher.js (setInterval from index.js).

const supabaseService = require('../config/supabaseService');
const {
  enrichLotsWithPnl,
  aggregateLotsToPositions,
  summarizeAccountMetrics
} = require('../services/paper/pnlCalculator');

async function runPaperSnapshot() {
  const { data: accounts, error } = await supabaseService.from('paper_accounts').select('id, cash_balance');
  if (error) throw error;
  if (!accounts?.length) return { count: 0 };

  let inserted = 0;
  for (const account of accounts) {
    const { data: lots, error: posErr } = await supabaseService
      .from('paper_position_lots')
      .select('*')
      .eq('account_id', account.id)
      .eq('status', 'open')
      .gt('remaining_qty', 0);

    if (posErr) {
      console.warn('[paper-snapshot] positions error:', posErr.message);
      continue;
    }

    const enrichedLots = await enrichLotsWithPnl(lots || []);
    const positions = aggregateLotsToPositions(enrichedLots);
    const { data: closedTrades } = await supabaseService
      .from('paper_trades_closed')
      .select('net_realized_pnl')
      .eq('account_id', account.id);
    const metrics = summarizeAccountMetrics(account, positions, closedTrades || []);
    const now = new Date().toISOString();

    const { error: insErr } = await supabaseService.from('paper_portfolio_snapshots').insert({
      account_id: account.id,
      equity: metrics.equity,
      cash: account.cash_balance,
      snapshot_at: now
    });

    if (insErr) {
      console.warn('[paper-snapshot] insert error:', insErr.message);
      continue;
    }
    inserted += 1;
  }

  return { count: inserted };
}

module.exports = { runPaperSnapshot };
