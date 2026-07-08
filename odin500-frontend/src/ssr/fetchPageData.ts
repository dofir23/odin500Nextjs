import { MARKET_SERIES } from '@/components/marketSeriesRegistry.js';
import {
  buildValsFromBatch,
  chunkTickerList,
  normalizeTickerReturnsPayload,
  returnTableSections,
  uniqueMarketSummaryTickers
} from '@/utils/marketReturnsTable.js';
import { fetchNewsPageData, type NewsPageInitialData } from '@/ssr/fetchNews';
import { getMarketJson, postMarketJson } from '@/ssr/serverMarketFetch';
import { rowDateToTimeKey } from '@/utils/chartData.js';

const RAIL_SNAPSHOT_SERIES = MARKET_SERIES.map((s) => ({ key: s.key, ticker: s.ticker }));

const SUMMARY_RETURNS_DEFS = [
  { key: 'SPX', label: 'S&P 500' },
  { key: 'DJI', label: 'Dow Jones' },
  { key: 'NDX', label: 'Nasdaq-100' },
  { key: 'XLK', label: 'Technology' },
  { key: 'XLE', label: 'Energy' },
  { key: 'XLV', label: 'Healthcare' },
  { key: 'XLI', label: 'Industrials' }
];

const INDEX_ROUTE_MAP: Record<string, { apiIndex: string; ticker?: string }> = {
  sp500: { apiIndex: 'sp500', ticker: 'SPX' },
  'dow-jones': { apiIndex: 'Dow Jones', ticker: 'DJI' },
  'nasdaq-100': { apiIndex: 'Nasdaq 100', ticker: 'NDX' }
};

const SECTOR_TICKER_MAP: Record<string, string> = Object.fromEntries(
  MARKET_SERIES.filter((s) => s.group === 'sector').map((s) => [s.key.toLowerCase(), s.ticker])
);

export type HeatmapInitialData = {
  apiIndices: string[];
  periodOptions: Array<{ value: string; label: string }>;
  rows: unknown[];
  index: string;
  period: string;
};

export type MarketMoversInitialData = {
  points: unknown[];
  meta: {
    asOfDate: string;
    volumeNote: string;
    sessionNote: string;
    period: string;
  };
  index: string;
  period: string;
};

export type MarketDashboardInitialData = {
  timeframe: string;
  railSnapshot: Record<string, unknown> | null;
  heatmapThumb: unknown[];
  watchlistRows: unknown[];
  summaryReturns: Record<string, Record<string, number | undefined>>;
};

export type IndexPageInitialData = {
  slug: string;
  isSector: boolean;
  asOfDate: string;
  indexPayload: Record<string, unknown> | null;
  fullChartSeries: Array<{ date: string; close: number }>;
  returnsSpy: Record<string, unknown> | null;
};

export type TickerPageInitialData = {
  symbol: string;
  returnsSym: Record<string, unknown> | null;
  returnsSpy: Record<string, unknown> | null;
  asOfDate: string;
  ohlcRows?: unknown[];
  ohlcSignalRows?: unknown[];
};

export type OdinSignalsInitialData = {
  indexRows: unknown[];
  index: string;
  period: string;
};

export type { NewsPageInitialData };

export type ReturnTableInitialData = {
  vals: Record<string, Record<string, number | undefined>>;
};

export type StatisticDataInitialData = {
  symbol: string;
  ohlcRows: unknown[];
  dataCoverage: { minDate: string; maxDate: string };
};

export type StockSplitsInitialData = {
  splits: unknown[];
  syncStatus: Record<string, unknown> | null;
  days: string;
  indexId: string;
};

export type TickerReportInitialData = {
  symbol: string;
  year: number;
  month: number | null;
  report: Record<string, unknown> | null;
  isAnnual: boolean;
};

export type RelativeStrengthInitialData = {
  symbol: string;
  seriesData: Record<string, unknown[]>;
  fetchRange: { start: string; end: string };
};

export type AnnualTickerInitialData = {
  symbol: string;
  annualReturnsRaw: unknown[];
  annualReturnsBenchRaw: unknown[];
  dynamicSym: unknown[];
  dynamicSpy: unknown[];
  statsRows: unknown[];
  statsRowsSpy: unknown[];
  asOfDate: string;
};

export type QuarterlyTickerInitialData = {
  symbol: string;
  quarterlyReturnsRaw: unknown[];
  quarterlyReturnsBenchRaw: unknown[];
  monthlyReturnsRaw: unknown[];
  dynamicSym: unknown[];
  dynamicSpy: unknown[];
  statsRows: unknown[];
  statsRowsSpy: unknown[];
  asOfDate: string;
};

export type PeriodicTickerInitialData = {
  symbol: string;
  periodMode: 'monthly' | 'weekly' | 'daily';
  primaryReturnsRaw: unknown[];
  benchmarkReturnsRaw: unknown[];
  dynamicSym: unknown[];
  dynamicSpy: unknown[];
  statsRows: unknown[];
  statsRowsSpy: unknown[];
  asOfDate: string;
};

const RETURNS_DEFAULT_START = '2017-01-01';
const BENCHMARK = 'SPY';
const PRIORITY_SECTION_IDS = new Set(['us', 'index']);

function sanitizeSymbol(symbol: string, fallback = 'AAPL') {
  const sym = String(symbol || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 20);
  return sym || fallback;
}

function statisticHistoryStartDate(endDate) {
  const end = endDate || new Date().toISOString().slice(0, 10);
  const d = new Date(`${end}T12:00:00`);
  d.setFullYear(d.getFullYear() - 35);
  return d.toISOString().slice(0, 10);
}

function ohlcRowsFromPayload(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  if (Array.isArray(payload.data)) return payload.data;
  const inner = payload.data as Record<string, unknown> | undefined;
  if (inner && Array.isArray(inner.data)) return inner.data;
  return [];
}

function chartSeriesFromOhlcRows(rows: unknown[]) {
  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      const date = rowDateToTimeKey(row);
      const close = Number(row.Close ?? row.close ?? row.AdjClose ?? row.adjClose);
      if (!date || !Number.isFinite(close)) return null;
      return { date, close };
    })
    .filter(Boolean) as Array<{ date: string; close: number }>;
}

async function serverFetchTickerReturnsBatch(tickers: string[]) {
  const unique = [...new Set(tickers.map((t) => String(t || '').toUpperCase().trim()).filter(Boolean))];
  if (!unique.length) return { batch: true, byTicker: {} };
  const chunks = chunkTickerList(unique);
  const parts = await Promise.all(
    chunks.map((chunk) => postMarketJson('/api/market/ticker-returns', { tickers: chunk, batch: true }))
  );
  const byTicker: Record<string, unknown> = {};
  for (const part of parts) {
    if (part) Object.assign(byTicker, normalizeTickerReturnsPayload(part).byTicker || {});
  }
  return { success: true, batch: true, byTicker };
}

function tickerCoreBody(symbol: string) {
  const end = new Date().toISOString().slice(0, 10);
  return {
    ticker: symbol,
    customStartDate: RETURNS_DEFAULT_START,
    customEndDate: end
  };
}

function mergeTickerReturnsPayload(
  prev: Record<string, unknown> | null,
  patch: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!patch || patch.success === false) return prev;
  if (!prev) return patch;
  const pPrev = (prev.performance as Record<string, unknown>) || {};
  const pNext = (patch.performance as Record<string, unknown>) || {};
  const pick = (key: string) => {
    const nextVal = pNext[key];
    const prevVal = pPrev[key];
    if (nextVal === undefined) return prevVal;
    if (
      Array.isArray(nextVal) &&
      nextVal.length === 0 &&
      Array.isArray(prevVal) &&
      prevVal.length > 0
    ) {
      return prevVal;
    }
    return nextVal;
  };
  return {
    ...prev,
    ...patch,
    ticker: patch.ticker ?? prev.ticker,
    asOfDate: patch.asOfDate ?? prev.asOfDate,
    success: true,
    performance: {
      dynamicPeriods: pick('dynamicPeriods') ?? [],
      predefinedPeriods: pick('predefinedPeriods') ?? [],
      annualReturns: pick('annualReturns') ?? [],
      quarterlyReturns: pick('quarterlyReturns') ?? [],
      monthlyReturns: pick('monthlyReturns') ?? [],
      customRange: pick('customRange') ?? []
    }
  };
}

import { dedupeTickerDetailRows } from '@/utils/dedupeTickerRows.js';

function rowsFromTickerDetails(payload: Record<string, unknown> | null) {
  const data = payload?.data;
  return dedupeTickerDetailRows(Array.isArray(data) ? data : []);
}

export async function fetchHeatmapPageData(
  index = 'Dow Jones',
  period = 'last-date'
): Promise<HeatmapInitialData | null> {
  const [indicesRes, periodsRes, detailsRes] = await Promise.all([
    getMarketJson('/api/market/indices'),
    getMarketJson('/api/market/period-options'),
    postMarketJson('/api/market/ticker-details', { index, period })
  ]);

  const apiIndices = Array.isArray(indicesRes?.indices) ? (indicesRes.indices as string[]) : [];
  const periodOptions = Array.isArray(periodsRes?.periods)
    ? (periodsRes.periods as Array<{ value: string; label: string }>)
    : [];
  const rows = rowsFromTickerDetails(detailsRes);

  if (!rows.length && !apiIndices.length) return null;

  return { apiIndices, periodOptions, rows, index, period };
}

export async function fetchMarketMoversPageData(
  index = 'SP500',
  period = 'last-date'
): Promise<MarketMoversInitialData | null> {
  const payload = await postMarketJson('/api/market/index-market-movers', { index, period });
  if (!payload) return null;

  const points = Array.isArray(payload.points) ? payload.points : [];
  return {
    points,
    meta: {
      asOfDate: String(payload.asOfDate || ''),
      volumeNote: String(payload.volumeNote || ''),
      sessionNote: String(payload.sessionNote || ''),
      period: String(payload.period || period)
    },
    index,
    period
  };
}

async function fetchTickerReturnsBatch(tickers: string[]) {
  const payload = await postMarketJson('/api/market/ticker-returns', {
    tickers,
    batch: true
  });
  return normalizeTickerReturnsPayload(payload);
}

export async function fetchMarketDashboardData(
  timeframe = '6M'
): Promise<MarketDashboardInitialData | null> {
  const summaryTickers = uniqueMarketSummaryTickers(SUMMARY_RETURNS_DEFS);

  const [railRes, heatmapRes, watchlistRes, returnsRes] = await Promise.all([
    postMarketJson('/api/market/market-rail-snapshot', {
      timeframe,
      series: RAIL_SNAPSHOT_SERIES
    }),
    postMarketJson('/api/market/ticker-details', { index: 'Dow Jones', period: 'last-date' }),
    summaryTickers.length ? fetchTickerReturnsBatch(summaryTickers) : Promise.resolve(null)
  ]);

  const railSnapshot =
    railRes?.success && railRes.byKey ? (railRes.byKey as Record<string, unknown>) : null;
  const heatmapThumb = rowsFromTickerDetails(heatmapRes);
  const watchlistRows = rowsFromTickerDetails(watchlistRes);
  const summaryReturns = (
    returnsRes ? buildValsFromBatch(returnsRes, SUMMARY_RETURNS_DEFS) : {}
  ) as Record<string, Record<string, number | undefined>>;

  if (!railSnapshot && !heatmapThumb.length && !Object.keys(summaryReturns).length) {
    return null;
  }

  return {
    timeframe,
    railSnapshot,
    heatmapThumb,
    watchlistRows,
    summaryReturns
  };
}

export async function fetchIndexPageData(
  slug: string,
  isSector = false
): Promise<IndexPageInitialData | null> {
  if (isSector) {
    const sectorKey = slug.toLowerCase();
    const ticker = SECTOR_TICKER_MAP[sectorKey] || 'XLK';
    const [retRes, ohlcRes, spyRes] = await Promise.all([
      postMarketJson('/api/market/ticker-returns', { ticker }),
      getMarketJson(`/api/market/ohlc?symbol=${encodeURIComponent(ticker)}&limit=4000`),
      postMarketJson('/api/market/ticker-returns', { ticker: 'SPY' })
    ]);
    if (!retRes && !ohlcRes) return null;

    const retData =
      retRes && typeof retRes === 'object'
        ? ((retRes.data as Record<string, unknown> | undefined) ?? retRes)
        : {};
    const ohlcRows = ohlcRowsFromPayload(ohlcRes);
    const fullChartSeries = chartSeriesFromOhlcRows(ohlcRows);

    const asOfDate = String(
      retData.asOfDate ||
        (fullChartSeries.length ? fullChartSeries[fullChartSeries.length - 1].date : '') ||
        new Date().toISOString().slice(0, 10)
    ).slice(0, 10);

    return {
      slug: sectorKey,
      isSector: true,
      asOfDate,
      indexPayload: {
        officialIndexTicker: ticker,
        ticker,
        asOfDate,
        performance: retData.performance,
        seriesMode: 'Sector ETF',
        syntheticCloseSeries: fullChartSeries
      },
      fullChartSeries,
      returnsSpy: spyRes
        ? ((spyRes.data as Record<string, unknown> | undefined) ?? spyRes)
        : null
    };
  }

  const route = INDEX_ROUTE_MAP[slug] || INDEX_ROUTE_MAP.sp500;
  const idxRes = await postMarketJson('/api/market/index-returns', { index: route.apiIndex });
  if (!idxRes) return null;

  const asOfDate = String(idxRes.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  let fullChartSeries = Array.isArray(idxRes.syntheticCloseSeries)
    ? (idxRes.syntheticCloseSeries as Array<{ date: string; close: number }>)
    : [];

  if (route.ticker) {
    const ohlcRes = await getMarketJson(
      `/api/market/ohlc?symbol=${encodeURIComponent(route.ticker)}&limit=4000`
    );
    const ohlcRows = ohlcRowsFromPayload(ohlcRes);
    fullChartSeries = chartSeriesFromOhlcRows(ohlcRows);
  }

  const spyRes = await postMarketJson('/api/market/ticker-returns', { ticker: 'SPY' });

  return {
    slug,
    isSector: false,
    asOfDate,
    indexPayload: {
      ...idxRes,
      officialIndexTicker: route.ticker || null,
      ticker: route.ticker || null,
      syntheticCloseSeries: fullChartSeries
    },
    fullChartSeries,
    returnsSpy: spyRes
  };
}

export async function fetchTickerPageData(symbol: string): Promise<TickerPageInitialData | null> {
  const sym = sanitizeSymbol(symbol);
  const body = tickerCoreBody(sym);
  const end = body.customEndDate;
  const oneYearStart = new Date(`${end}T12:00:00`);
  oneYearStart.setFullYear(oneYearStart.getFullYear() - 1);
  const ohlcStart = oneYearStart.toISOString().slice(0, 10);

  const [coreRes, spyRes, annualRes, quarterlyRes, monthlyRes, signalRes] = await Promise.all([
    postMarketJson('/api/market/ticker-core-returns', body),
    postMarketJson('/api/market/ticker-core-returns', { ...body, ticker: BENCHMARK }),
    postMarketJson('/api/market/ticker-annual-returns', body),
    postMarketJson('/api/market/ticker-quarterly-returns', body),
    postMarketJson('/api/market/ticker-monthly-returns', body),
    postMarketJson('/api/market/ohlc-signals-indicator', {
      ticker: sym,
      start_date: ohlcStart,
      end_date: end
    })
  ]);

  if (!coreRes && !spyRes) return null;

  let returnsSym: Record<string, unknown> | null = coreRes;
  for (const patch of [annualRes, quarterlyRes, monthlyRes]) {
    returnsSym = mergeTickerReturnsPayload(returnsSym, patch);
  }

  const signalRows = ohlcRowsFromPayload(signalRes);

  return {
    symbol: sym,
    returnsSym,
    returnsSpy: spyRes,
    asOfDate: String(returnsSym?.asOfDate || coreRes?.asOfDate || end).slice(0, 10),
    ohlcRows: signalRows,
    ohlcSignalRows: signalRows
  };
}

export async function fetchOdinSignalsPageData(
  index = 'SP500',
  period = 'last-date'
): Promise<OdinSignalsInitialData | null> {
  const detailsRes = await postMarketJson('/api/market/ticker-details', { index, period });
  const indexRows = rowsFromTickerDetails(detailsRes);
  if (!indexRows.length) return null;
  return { indexRows, index, period };
}

export { fetchNewsPageData };

export async function fetchReturnTablePageData(): Promise<ReturnTableInitialData | null> {
  const sections = returnTableSections();
  const prioritySections = sections.filter((s) => PRIORITY_SECTION_IDS.has(s.id));
  const priorityDefs = prioritySections.flatMap((section) =>
    section.subsections?.length
      ? section.subsections.flatMap((sub) => sub.rows || [])
      : section.rows || []
  );
  const priorityTickers = uniqueMarketSummaryTickers(priorityDefs);
  if (!priorityTickers.length) return null;
  const payload = await serverFetchTickerReturnsBatch(priorityTickers);
  const vals = buildValsFromBatch(payload, priorityDefs) as Record<
    string,
    Record<string, number | undefined>
  >;
  return { vals };
}

export async function fetchStatisticDataPageData(
  symbol = 'AAPL'
): Promise<StatisticDataInitialData | null> {
  const sym = sanitizeSymbol(symbol);
  const endDate = new Date().toISOString().slice(0, 10);
  const payload = await postMarketJson('/api/market/ohlc-signals-indicator', {
    ticker: sym,
    start_date: statisticHistoryStartDate(endDate),
    end_date: endDate
  });
  const rows = ohlcRowsFromPayload(payload);
  if (!rows.length) return null;
  const minDate = rowDateToTimeKey(rows[rows.length - 1] as Record<string, unknown>) || '';
  const maxDate = rowDateToTimeKey(rows[0] as Record<string, unknown>) || '';
  return {
    symbol: sym,
    ohlcRows: rows,
    dataCoverage: { minDate, maxDate }
  };
}

export async function fetchStockSplitsPageData(
  days = '90',
  indexId = 'all'
): Promise<StockSplitsInitialData | null> {
  const [recentRes, statusRes] = await Promise.all([
    getMarketJson(
      `/api/splits/recent?days=${encodeURIComponent(days)}&limit=200&index=${encodeURIComponent(indexId)}`
    ),
    getMarketJson('/api/splits/status')
  ]);
  const splits = Array.isArray(recentRes?.splits) ? recentRes.splits : [];
  return {
    splits,
    syncStatus: (statusRes as Record<string, unknown>) || null,
    days,
    indexId
  };
}

export async function fetchTickerReportPageData(
  symbol: string,
  year?: number,
  month?: number | null
): Promise<TickerReportInitialData | null> {
  const sym = sanitizeSymbol(symbol);
  const y = year && year > 2000 ? year : new Date().getFullYear();
  const isAnnual = month == null;
  const path =
    `/api/reports/ticker/${encodeURIComponent(sym.toLowerCase())}?year=${encodeURIComponent(String(y))}` +
    (isAnnual ? '' : `&month=${encodeURIComponent(String(month || 1))}`);
  const payload = await getMarketJson(path);
  const report = (payload?.report as Record<string, unknown>) || null;
  return {
    symbol: sym,
    year: y,
    month: isAnnual ? null : month || 1,
    report,
    isAnnual
  };
}

function normalizeRsOhlcRows(rows: unknown[]) {
  if (!Array.isArray(rows)) return [];
  const byTime = new Map<number, { t: number; close: number; iso: string }>();
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const iso = String(r?.Date ?? r?.date ?? r?.TradeDate ?? '').slice(0, 10);
    const close = Number(r?.AdjClose ?? r?.adjClose ?? r?.Close ?? r?.close);
    const t = Date.parse(`${iso}T12:00:00`);
    if (!iso || !Number.isFinite(t) || !Number.isFinite(close) || close <= 0) continue;
    byTime.set(t, { t, close, iso });
  }
  return Array.from(byTime.values()).sort((a, b) => a.t - b.t);
}

export async function fetchRelativeStrengthPageData(
  symbol = 'AAPL'
): Promise<RelativeStrengthInitialData | null> {
  const sym = sanitizeSymbol(symbol);
  const currentYear = new Date().getFullYear();
  const fetchRange = { start: `${currentYear - 4}-01-01`, end: `${currentYear}-12-31` };
  const payload = await postMarketJson('/api/market/ohlc-signals-indicator', {
    ticker: sym,
    start_date: fetchRange.start,
    end_date: fetchRange.end
  });
  const rows = normalizeRsOhlcRows(ohlcRowsFromPayload(payload));
  if (!rows.length) return null;
  return {
    symbol: sym,
    seriesData: { [sym]: rows },
    fetchRange
  };
}

export async function fetchStatisticAnnualPageData(
  symbol = 'AAPL'
): Promise<AnnualTickerInitialData | null> {
  const sym = sanitizeSymbol(symbol);
  const body = tickerCoreBody(sym);
  const end = body.customEndDate;
  const oneYearStart = new Date(`${end}T12:00:00`);
  oneYearStart.setFullYear(oneYearStart.getFullYear() - 1);
  const oneYearStartIso = oneYearStart.toISOString().slice(0, 10);

  const [annualRes, annualBenchRes, coreSymRes, coreSpyRes, ohlcSymRes, ohlcSpyRes] =
    await Promise.all([
      postMarketJson('/api/market/ticker-annual-returns', body),
      postMarketJson('/api/market/ticker-annual-returns', { ...body, ticker: BENCHMARK }),
      postMarketJson('/api/market/ticker-core-returns', body),
      postMarketJson('/api/market/ticker-core-returns', { ...body, ticker: BENCHMARK }),
      getMarketJson(
        `/api/market/ohlc?symbol=${encodeURIComponent(sym)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`
      ),
      getMarketJson(
        `/api/market/ohlc?symbol=${encodeURIComponent(BENCHMARK)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`
      )
    ]);

  const annualPerf = (annualRes?.performance as Record<string, unknown>) || {};
  const annualBenchPerf = (annualBenchRes?.performance as Record<string, unknown>) || {};
  const coreSymPerf = (coreSymRes?.performance as Record<string, unknown>) || {};
  const coreSpyPerf = (coreSpyRes?.performance as Record<string, unknown>) || {};

  return {
    symbol: sym,
    annualReturnsRaw: Array.isArray(annualPerf.annualReturns) ? annualPerf.annualReturns : [],
    annualReturnsBenchRaw: Array.isArray(annualBenchPerf.annualReturns)
      ? annualBenchPerf.annualReturns
      : [],
    dynamicSym: Array.isArray(coreSymPerf.dynamicPeriods) ? coreSymPerf.dynamicPeriods : [],
    dynamicSpy: Array.isArray(coreSpyPerf.dynamicPeriods) ? coreSpyPerf.dynamicPeriods : [],
    statsRows: ohlcRowsFromPayload(ohlcSymRes),
    statsRowsSpy: ohlcRowsFromPayload(ohlcSpyRes),
    asOfDate: String(annualRes?.asOfDate || end).slice(0, 10)
  };
}

export async function fetchStatisticQuarterlyPageData(
  symbol = 'AAPL'
): Promise<QuarterlyTickerInitialData | null> {
  const sym = sanitizeSymbol(symbol);
  const body = tickerCoreBody(sym);
  const end = body.customEndDate;
  const oneYearStart = new Date(`${end}T12:00:00`);
  oneYearStart.setFullYear(oneYearStart.getFullYear() - 1);
  const oneYearStartIso = oneYearStart.toISOString().slice(0, 10);

  const [qRes, qBenchRes, mRes, coreSymRes, coreSpyRes, ohlcSymRes, ohlcSpyRes] = await Promise.all([
    postMarketJson('/api/market/ticker-quarterly-returns', body),
    postMarketJson('/api/market/ticker-quarterly-returns', { ...body, ticker: BENCHMARK }),
    postMarketJson('/api/market/ticker-monthly-returns', body),
    postMarketJson('/api/market/ticker-core-returns', body),
    postMarketJson('/api/market/ticker-core-returns', { ...body, ticker: BENCHMARK }),
    getMarketJson(
      `/api/market/ohlc?symbol=${encodeURIComponent(sym)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`
    ),
    getMarketJson(
      `/api/market/ohlc?symbol=${encodeURIComponent(BENCHMARK)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`
    )
  ]);

  const qPerf = (qRes?.performance as Record<string, unknown>) || {};
  const qBenchPerf = (qBenchRes?.performance as Record<string, unknown>) || {};
  const mPerf = (mRes?.performance as Record<string, unknown>) || {};
  const coreSymPerf = (coreSymRes?.performance as Record<string, unknown>) || {};
  const coreSpyPerf = (coreSpyRes?.performance as Record<string, unknown>) || {};

  return {
    symbol: sym,
    quarterlyReturnsRaw: Array.isArray(qPerf.quarterlyReturns) ? qPerf.quarterlyReturns : [],
    quarterlyReturnsBenchRaw: Array.isArray(qBenchPerf.quarterlyReturns)
      ? qBenchPerf.quarterlyReturns
      : [],
    monthlyReturnsRaw: Array.isArray(mPerf.monthlyReturns) ? mPerf.monthlyReturns : [],
    dynamicSym: Array.isArray(coreSymPerf.dynamicPeriods) ? coreSymPerf.dynamicPeriods : [],
    dynamicSpy: Array.isArray(coreSpyPerf.dynamicPeriods) ? coreSpyPerf.dynamicPeriods : [],
    statsRows: ohlcRowsFromPayload(ohlcSymRes),
    statsRowsSpy: ohlcRowsFromPayload(ohlcSpyRes),
    asOfDate: String(qRes?.asOfDate || end).slice(0, 10)
  };
}

function weeklyOhlcFromPayload(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  const data = payload.data as Record<string, unknown> | undefined;
  if (data && Array.isArray(data.weeklyOHLC)) return data.weeklyOHLC;
  if (Array.isArray(payload.weeklyOHLC)) return payload.weeklyOHLC;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function fetchStatisticPeriodicPageData(
  symbol = 'AAPL',
  periodMode: 'monthly' | 'weekly' | 'daily' = 'monthly'
): Promise<PeriodicTickerInitialData | null> {
  const sym = sanitizeSymbol(symbol);
  const body = tickerCoreBody(sym);
  const end = body.customEndDate;
  const oneYearStart = new Date(`${end}T12:00:00`);
  oneYearStart.setFullYear(oneYearStart.getFullYear() - 1);
  const oneYearStartIso = oneYearStart.toISOString().slice(0, 10);
  const dailyStart = oneYearStartIso;
  const dailyEnd = end;

  const primaryReq =
    periodMode === 'weekly'
      ? postMarketJson('/api/market/weekly-ohlc', {
          ticker: sym,
          start_date: RETURNS_DEFAULT_START,
          end_date: end
        })
      : periodMode === 'daily'
        ? getMarketJson(
            `/api/market/ohlc?symbol=${encodeURIComponent(sym)}&start_date=${encodeURIComponent(dailyStart)}&end_date=${encodeURIComponent(dailyEnd)}&limit=400`
          )
        : postMarketJson('/api/market/ticker-monthly-returns', body);

  const benchmarkReq =
    periodMode === 'weekly'
      ? postMarketJson('/api/market/weekly-ohlc', {
          ticker: BENCHMARK,
          start_date: RETURNS_DEFAULT_START,
          end_date: end
        })
      : periodMode === 'daily'
        ? getMarketJson(
            `/api/market/ohlc?symbol=${encodeURIComponent(BENCHMARK)}&start_date=${encodeURIComponent(dailyStart)}&end_date=${encodeURIComponent(dailyEnd)}&limit=400`
          )
        : postMarketJson('/api/market/ticker-monthly-returns', { ...body, ticker: BENCHMARK });

  const [primaryRes, benchRes, coreSymRes, coreSpyRes, ohlcSymRes, ohlcSpyRes] = await Promise.all([
    primaryReq,
    benchmarkReq,
    postMarketJson('/api/market/ticker-core-returns', body),
    postMarketJson('/api/market/ticker-core-returns', { ...body, ticker: BENCHMARK }),
    getMarketJson(
      `/api/market/ohlc?symbol=${encodeURIComponent(sym)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`
    ),
    getMarketJson(
      `/api/market/ohlc?symbol=${encodeURIComponent(BENCHMARK)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`
    )
  ]);

  const primaryPerf = (primaryRes?.performance as Record<string, unknown>) || {};
  const benchPerf = (benchRes?.performance as Record<string, unknown>) || {};
  const coreSymPerf = (coreSymRes?.performance as Record<string, unknown>) || {};
  const coreSpyPerf = (coreSpyRes?.performance as Record<string, unknown>) || {};

  let primaryReturnsRaw: unknown[] = [];
  let benchmarkReturnsRaw: unknown[] = [];

  if (periodMode === 'weekly') {
    primaryReturnsRaw = weeklyOhlcFromPayload(primaryRes);
    benchmarkReturnsRaw = weeklyOhlcFromPayload(benchRes);
  } else if (periodMode === 'daily') {
    primaryReturnsRaw = ohlcRowsFromPayload(primaryRes);
    benchmarkReturnsRaw = ohlcRowsFromPayload(benchRes);
  } else {
    primaryReturnsRaw = Array.isArray(primaryPerf.monthlyReturns) ? primaryPerf.monthlyReturns : [];
    benchmarkReturnsRaw = Array.isArray(benchPerf.monthlyReturns) ? benchPerf.monthlyReturns : [];
  }

  return {
    symbol: sym,
    periodMode,
    primaryReturnsRaw,
    benchmarkReturnsRaw,
    dynamicSym: Array.isArray(coreSymPerf.dynamicPeriods) ? coreSymPerf.dynamicPeriods : [],
    dynamicSpy: Array.isArray(coreSpyPerf.dynamicPeriods) ? coreSpyPerf.dynamicPeriods : [],
    statsRows: ohlcRowsFromPayload(ohlcSymRes),
    statsRowsSpy: ohlcRowsFromPayload(ohlcSpyRes),
    asOfDate: String(coreSymRes?.asOfDate || end).slice(0, 10)
  };
}
