/**
 * @param {Array<{ net_realized_pnl?: number, gross_realized_pnl?: number, qty_closed?: number, ticker?: string }>} trades
 */
export function computeClosedTradesAnalytics(trades) {
  const list = trades || [];
  const withPnl = list.filter((t) => Number.isFinite(Number(t.net_realized_pnl)));
  const wins = withPnl.filter((t) => Number(t.net_realized_pnl) > 0);
  const losses = withPnl.filter((t) => Number(t.net_realized_pnl) < 0);
  const totalNet = withPnl.reduce((s, t) => s + Number(t.net_realized_pnl), 0);
  const avgWin =
    wins.length > 0 ? wins.reduce((s, t) => s + Number(t.net_realized_pnl), 0) / wins.length : null;
  const avgLoss =
    losses.length > 0
      ? losses.reduce((s, t) => s + Number(t.net_realized_pnl), 0) / losses.length
      : null;

  let best = null;
  let worst = null;
  for (const t of withPnl) {
    const pnl = Number(t.net_realized_pnl);
    if (!best || pnl > Number(best.net_realized_pnl)) best = t;
    if (!worst || pnl < Number(worst.net_realized_pnl)) worst = t;
  }

  const winRate = withPnl.length > 0 ? (wins.length / withPnl.length) * 100 : null;
  const profitFactor =
    losses.length > 0
      ? wins.reduce((s, t) => s + Number(t.net_realized_pnl), 0) /
        Math.abs(losses.reduce((s, t) => s + Number(t.net_realized_pnl), 0))
      : wins.length > 0
        ? null
        : null;

  return {
    totalTrades: withPnl.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalNet: Math.round(totalNet * 100) / 100,
    avgWin: avgWin != null ? Math.round(avgWin * 100) / 100 : null,
    avgLoss: avgLoss != null ? Math.round(avgLoss * 100) / 100 : null,
    profitFactor: profitFactor != null && Number.isFinite(profitFactor) ? Math.round(profitFactor * 100) / 100 : null,
    best,
    worst
  };
}
