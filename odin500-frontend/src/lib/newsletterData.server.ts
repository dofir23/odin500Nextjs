import 'server-only';
import { postMarketJson } from '@/ssr/serverMarketFetch';
import { formatReturnPct, pickDynamicReturn } from '@/seo/performanceSnippet';

const INDEX_TICKERS = [
  { label: 'S&P 500', ticker: 'SPX' },
  { label: 'Dow Jones', ticker: 'DJI' },
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

export type NewsletterIndexRow = {
  label: string;
  ticker: string;
  oneMonth: number | null;
  ytd: number | null;
  sixMonth: number | null;
};

export type NewsletterMarketSnapshot = {
  asOfDate: string;
  indices: NewsletterIndexRow[];
  sectors: NewsletterIndexRow[];
};

function pickFromBatch(
  batch: Record<string, unknown> | null,
  ticker: string
): Record<string, unknown> | null {
  if (!batch) return null;
  const u = ticker.toUpperCase();
  if (batch.batch === true && batch.byTicker && typeof batch.byTicker === 'object') {
    const row = (batch.byTicker as Record<string, unknown>)[u] as Record<string, unknown> | undefined;
    if (!row || row.success === false) return null;
    return row as Record<string, unknown>;
  }
  if (String(batch.ticker || '').toUpperCase() === u) return batch;
  return null;
}

function rowFromPayload(
  label: string,
  ticker: string,
  payload: Record<string, unknown> | null
): NewsletterIndexRow {
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
    oneMonth: pickDynamicReturn(perf, 'Last Month'),
    ytd: pickDynamicReturn(perf, 'Year to Date (YTD)'),
    sixMonth: pickDynamicReturn(perf, 'Last 6 months')
  };
}

/** Live index & sector returns from Odin500 market API for newsletter tables. */
export async function fetchNewsletterMarketSnapshot(): Promise<NewsletterMarketSnapshot | null> {
  const tickers = [...INDEX_TICKERS, ...SECTOR_TICKERS].map((r) => r.ticker);
  const payload = await postMarketJson('/api/market/ticker-returns', {
    tickers,
    batch: true
  });

  if (!payload) return null;

  const asOfDate = String(
    payload.asOfDate ||
      (pickFromBatch(payload, 'SPX') as { data?: { asOfDate?: string } } | null)?.data?.asOfDate ||
      new Date().toISOString().slice(0, 10)
  ).slice(0, 10);

  const indices = INDEX_TICKERS.map((r) => rowFromPayload(r.label, r.ticker, payload));
  const sectors = SECTOR_TICKERS.map((r) => rowFromPayload(r.label, r.ticker, payload));

  if (!indices.some((r) => r.oneMonth != null || r.ytd != null)) return null;

  return { asOfDate, indices, sectors };
}

function fmtPct(n: number | null) {
  if (n == null) return '—';
  return formatReturnPct(n);
}

/** Markdown table block appended to each newsletter issue body. */
export function buildNewsletterDataMarkdown(snapshot: NewsletterMarketSnapshot, weekLabel: string) {
  const lines = [
    `## Odin500 market data (${weekLabel})`,
    '',
    `*Figures from Odin500 live market API. As of ${snapshot.asOfDate}.*`,
    '',
    '### Key indices & ETFs',
    '',
    '| Benchmark | Ticker | 1M | YTD | 6M |',
    '| --- | --- | --- | --- | --- |',
    ...snapshot.indices.map(
      (r) => `| ${r.label} | ${r.ticker} | ${fmtPct(r.oneMonth)} | ${fmtPct(r.ytd)} | ${fmtPct(r.sixMonth)} |`
    ),
    '',
    '### Sector ETFs',
    '',
    '| Sector | Ticker | 1M | YTD | 6M |',
    '| --- | --- | --- | --- | --- |',
    ...snapshot.sectors.map(
      (r) => `| ${r.label} | ${r.ticker} | ${fmtPct(r.oneMonth)} | ${fmtPct(r.ytd)} | ${fmtPct(r.sixMonth)} |`
    ),
    '',
    'Explore live charts on the [market dashboard](/market), [heatmap](/heatmap), and [return table](/return-table).'
  ];

  return lines.join('\n');
}
