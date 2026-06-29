/**
 * Deduplicate ticker-detail rows by symbol (keeps first occurrence).
 * API `/api/market/ticker-details` can return the same symbol more than once.
 */
export function tickerRowSymbol(row) {
  if (!row || typeof row !== 'object') return '';
  const r = row;
  return String(r.symbol ?? r.ticker ?? r.Symbol ?? '')
    .toUpperCase()
    .trim();
}

export function dedupeTickerDetailRows(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const sym = tickerRowSymbol(row);
    if (sym) {
      if (seen.has(sym)) continue;
      seen.add(sym);
    }
    out.push(row);
  }
  return out;
}
