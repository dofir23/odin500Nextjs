function rowDateKey(row) {
  const d = row?.Date ?? row?.date ?? row?.market_date;
  if (d && typeof d === 'object' && d.value != null) return String(d.value);
  return String(d || '');
}

function pickClose(row) {
  if (!row || typeof row !== 'object') return null;
  const candidates = [row.Close, row.close, row.close_price, row.price, row.Adj_Close, row.adj_close];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Latest close from GET /api/market/ohlc (rows ordered by Date DESC). */
export function latestCloseFromOhlcPayload(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => rowDateKey(b).localeCompare(rowDateKey(a)));
  for (const row of sorted) {
    const close = pickClose(row);
    if (close != null) return close;
  }
  return null;
}

export function formatLatestClosePrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
