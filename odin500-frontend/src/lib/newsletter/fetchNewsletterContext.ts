import { formatReturnPct, pickDynamicReturn } from '@/seo/performanceSnippet';

const INDEX_TICKERS = [
  { label: 'S&P 500', ticker: 'SPX' },
  { label: 'Nasdaq-100', ticker: 'NDX' },
  { label: 'S&P 500 ETF', ticker: 'SPY' },
  { label: 'Nasdaq-100 ETF', ticker: 'QQQ' }
];

const SECTOR_TICKERS = [
  { label: 'Technology (XLK)', ticker: 'XLK' },
  { label: 'Financials (XLF)', ticker: 'XLF' },
  { label: 'Energy (XLE)', ticker: 'XLE' },
  { label: 'Healthcare (XLV)', ticker: 'XLV' },
  { label: 'Industrials (XLI)', ticker: 'XLI' }
];

export type NewsletterReturnRow = {
  label: string;
  ticker: string;
  lastWeek: number | null;
  lastMonth: number | null;
  ytd: number | null;
};

export type NewsletterSignalSummary = {
  longL1: number;
  longL2: number;
  shortS1: number;
  shortS2: number;
  total: number;
};

export type NewsletterMoverRow = {
  symbol: string;
  name: string;
  returnPct: number | null;
};

export type NewsletterGenerationContext = {
  asOfDate: string;
  indices: NewsletterReturnRow[];
  sectors: NewsletterReturnRow[];
  topSectors: NewsletterReturnRow[];
  bottomSectors: NewsletterReturnRow[];
  signals: NewsletterSignalSummary | null;
  topGainers: NewsletterMoverRow[];
  topLosers: NewsletterMoverRow[];
};

import { API_ORIGIN } from '@/lib/env';

function apiBase() {
  return API_ORIGIN.replace(/\/$/, '');
}

async function postJson(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickFromBatch(batch: Record<string, unknown> | null, ticker: string) {
  if (!batch) return null;
  const u = ticker.toUpperCase();
  if (batch.batch === true && batch.byTicker && typeof batch.byTicker === 'object') {
    const row = (batch.byTicker as Record<string, unknown>)[u] as
      | Record<string, unknown>
      | undefined;
    if (!row || row.success === false) return null;
    return row;
  }
  if (String(batch.ticker || '').toUpperCase() === u) return batch;
  return null;
}

function rowFromPayload(
  label: string,
  ticker: string,
  payload: Record<string, unknown> | null
): NewsletterReturnRow {
  const rec = pickFromBatch(payload, ticker);
  const data =
    rec && typeof rec.data === 'object' ? (rec.data as Record<string, unknown>) : rec;
  const perf =
    data && typeof data.performance === 'object'
      ? (data.performance as Record<string, unknown>)
      : undefined;

  return {
    label,
    ticker,
    lastWeek: pickDynamicReturn(perf, 'Last Week'),
    lastMonth: pickDynamicReturn(perf, 'Last Month'),
    ytd: pickDynamicReturn(perf, 'Year to Date (YTD)')
  };
}

function primaryReturn(row: NewsletterReturnRow) {
  return row.lastWeek ?? row.lastMonth ?? row.ytd;
}

function summarizeSignals(rows: unknown[]): NewsletterSignalSummary | null {
  if (!rows.length) return null;
  const summary = { longL1: 0, longL2: 0, shortS1: 0, shortS2: 0, total: rows.length };
  for (const raw of rows) {
    const r = raw as Record<string, unknown>;
    const sig = String(r.signal ?? r.odin_signal ?? r.odinsignal ?? r.signal_bucket ?? '')
      .toUpperCase()
      .trim();
    if (sig === 'L1') summary.longL1 += 1;
    else if (sig === 'L2') summary.longL2 += 1;
    else if (sig === 'S1') summary.shortS1 += 1;
    else if (sig === 'S2') summary.shortS2 += 1;
  }
  return summary;
}

function rowsFromTickerDetails(payload: Record<string, unknown> | null): unknown[] {
  if (!payload) return [];
  const data = payload.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { rows?: unknown[] }).rows)) {
    return (data as { rows: unknown[] }).rows;
  }
  if (Array.isArray(payload.rows)) return payload.rows;
  return [];
}

function moverReturn(row: Record<string, unknown>): number | null {
  const raw =
    row.return_pct ?? row.returnPct ?? row.change_pct ?? row.changePercent ?? row.change;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function moversFromPayload(payload: Record<string, unknown> | null): NewsletterMoverRow[] {
  const points = Array.isArray(payload?.points) ? payload.points : [];
  return points
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        symbol: String(r.symbol ?? r.ticker ?? '').toUpperCase(),
        name: String(r.company_name ?? r.companyName ?? r.name ?? '').trim(),
        returnPct: moverReturn(r)
      };
    })
    .filter((r) => r.symbol);
}

/** Compact market snapshot for newsletter AI / template generation. */
export async function fetchNewsletterContext(): Promise<NewsletterGenerationContext | null> {
  const tickers = [...INDEX_TICKERS, ...SECTOR_TICKERS].map((r) => r.ticker);
  const [returnsPayload, detailsPayload, moversPayload] = await Promise.all([
    postJson('/api/market/ticker-returns', { tickers, batch: true }),
    postJson('/api/market/ticker-details', { index: 'SP500', period: 'last-date' }),
    postJson('/api/market/index-market-movers', { index: 'SP500', period: 'last-date' })
  ]);

  if (!returnsPayload) return null;

  const asOfDate = String(
    returnsPayload.asOfDate ||
      (pickFromBatch(returnsPayload, 'SPX') as { data?: { asOfDate?: string } } | null)?.data
        ?.asOfDate ||
      new Date().toISOString().slice(0, 10)
  ).slice(0, 10);

  const indices = INDEX_TICKERS.map((r) => rowFromPayload(r.label, r.ticker, returnsPayload));
  const sectors = SECTOR_TICKERS.map((r) => rowFromPayload(r.label, r.ticker, returnsPayload));

  if (!indices.some((r) => primaryReturn(r) != null)) return null;

  const ranked = [...sectors].sort((a, b) => (primaryReturn(b) ?? -999) - (primaryReturn(a) ?? -999));
  const signalRows = rowsFromTickerDetails(detailsPayload);
  const movers = moversFromPayload(moversPayload).filter((m) => m.returnPct != null);
  const sortedMovers = [...movers].sort((a, b) => (b.returnPct ?? 0) - (a.returnPct ?? 0));

  return {
    asOfDate,
    indices,
    sectors,
    topSectors: ranked.slice(0, 2),
    bottomSectors: ranked.slice(-2).reverse(),
    signals: summarizeSignals(signalRows),
    topGainers: sortedMovers.slice(0, 3),
    topLosers: sortedMovers.slice(-3).reverse()
  };
}

export function formatContextForPrompt(ctx: NewsletterGenerationContext) {
  const fmtRow = (r: NewsletterReturnRow) => {
    const bits: string[] = [];
    const w = r.lastWeek != null ? `1W ${formatReturnPct(r.lastWeek)}` : null;
    const m = r.lastMonth != null ? `1M ${formatReturnPct(r.lastMonth)}` : null;
    const y = r.ytd != null ? `YTD ${formatReturnPct(r.ytd)}` : null;
    if (w) bits.push(w);
    if (m) bits.push(m);
    if (y) bits.push(y);
    return `${r.label} (${r.ticker}): ${bits.join(', ') || 'n/a'}`;
  };

  const lines = [
    `As of date: ${ctx.asOfDate}`,
    '',
    'Indices & ETFs:',
    ...ctx.indices.map(fmtRow),
    '',
    'Strongest sectors:',
    ...ctx.topSectors.map(fmtRow),
    '',
    'Weakest sectors:',
    ...ctx.bottomSectors.map(fmtRow)
  ];

  if (ctx.signals) {
    lines.push(
      '',
      `Odin signals (S&P 500 sample, n=${ctx.signals.total}): L1=${ctx.signals.longL1}, L2=${ctx.signals.longL2}, S1=${ctx.signals.shortS1}, S2=${ctx.signals.shortS2}`
    );
  }

  if (ctx.topGainers.length) {
    lines.push(
      '',
      'Top S&P 500 gainers (session/window):',
      ...ctx.topGainers.map(
        (m) =>
          `${m.symbol}${m.name ? ` (${m.name})` : ''}: ${m.returnPct != null ? formatReturnPct(m.returnPct) : 'n/a'}`
      )
    );
  }

  if (ctx.topLosers.length) {
    lines.push(
      '',
      'Top S&P 500 losers:',
      ...ctx.topLosers.map(
        (m) =>
          `${m.symbol}${m.name ? ` (${m.name})` : ''}: ${m.returnPct != null ? formatReturnPct(m.returnPct) : 'n/a'}`
      )
    );
  }

  return lines.join('\n');
}
