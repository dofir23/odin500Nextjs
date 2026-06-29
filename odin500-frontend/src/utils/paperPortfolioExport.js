function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, rows) {
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** @param {object[]} positions */
export function exportPositionsCsv(positions, accountName = 'portfolio') {
  const header = ['Symbol', 'Long qty', 'Short qty', 'Net qty', 'Last price', 'Market value', 'Unrealized PnL'];
  const lines = [header.map(csvEscape).join(',')];
  for (const p of positions || []) {
    lines.push(
      [
        p.ticker,
        p.long_qty ?? 0,
        p.short_qty ?? 0,
        p.net_qty ?? 0,
        p.current_price ?? '',
        p.market_value ?? '',
        p.unrealized_pnl ?? ''
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  const safe = String(accountName || 'portfolio').replace(/[^\w.-]+/g, '_');
  downloadCsv(`odin500-positions-${safe}.csv`, lines);
}

/** @param {object[]} trades */
export function exportClosedTradesCsv(trades, accountName = 'portfolio') {
  const header = ['Action', 'Symbol', 'Qty', 'Avg entry', 'Avg exit', 'Fees', 'Net PnL', 'Closed at'];
  const lines = [header.map(csvEscape).join(',')];
  for (const t of trades || []) {
    lines.push(
      [
        t.action,
        t.ticker,
        t.qty_closed,
        t.avg_entry_price,
        t.avg_exit_price,
        t.total_fees,
        t.net_realized_pnl,
        t.closed_at
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  const safe = String(accountName || 'portfolio').replace(/[^\w.-]+/g, '_');
  downloadCsv(`odin500-closed-trades-${safe}.csv`, lines);
}

/** @param {object[]} summaries */
export function exportAccountsSummaryCsv(summaries) {
  const header = [
    'Account',
    'Portfolio value',
    'Total return',
    'Total return %',
    'Open PnL',
    'Closed PnL',
    'Positions',
    'Automated'
  ];
  const lines = [header.map(csvEscape).join(',')];
  for (const a of summaries || []) {
    lines.push(
      [
        a.name,
        a.equity,
        a.total_return,
        a.total_return_pct,
        a.unrealized_pnl_total,
        a.realized_pnl_total,
        a.positions_count,
        a.is_automated ? 'Yes' : 'No'
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  downloadCsv('odin500-portfolio-comparison.csv', lines);
}
