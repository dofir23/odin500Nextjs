'use client';
import { finnhubToken, companyProfileDataKey } from '../lib/env.js';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from '@/navigation/appRouterCompat.jsx';
import { ChartInfoTip } from '../components/ChartInfoTip.jsx';
import { TickerSignalLadder } from '../components/TickerSignalLadder.jsx';
import { CHART_INFO_TIPS } from '../components/chartInfoTips.js';
import { FigmaPagination } from '../components/FigmaPagination.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerMonthlyReturnsChart } from '../components/TickerMonthlyReturnsChart.jsx';
import { TickerSection23Section24 } from '../components/TickerSection23Section24.jsx';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';
import { useMediaChartHeight } from '../hooks/useMediaChartHeight.js';
import { useWatchlistDock } from '../context/WatchlistDockContext.jsx';
import { ReturnsChartFiltersMenu } from '../components/ReturnsChartFiltersMenu.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import TradingChartLoader from '../components/TradingChartLoader.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import {
  IconChartTypeDropdown,
  TICKER_CHART_TYPE_OPTIONS,
  TickerLightweightChart
} from '../components/TickerLightweightChart.jsx';
import {fetchJsonCached, getAuthToken, canFetchMarketData} from '../store/apiStore.js';
import {
  getRouteNavigationEpoch,
  isAbortError,
  isRouteNavigationStale,
  yieldToMain
} from '../navigation/routeNavigationAbort.js';
import { rowDateToTimeKey, mapRowsToCandles } from '../utils/chartData.js';
import { mapSplitsToChartMarkers, snapMarkersToNearestCandle } from '../utils/splitChartMarkers.js';
import { readRowSignal, toSignalBucket } from '../utils/odinSignalTreemap.js';
import { toDateInput } from '../utils/misc.js';
import {
  DEFAULT_TICKER_ROUTE_SYMBOL,
  replaceTickerPathname,
  resolveTickerPageSymbol,
  sanitizeTickerPageInput
} from '../utils/tickerUrlSync.js';
import { pickRelatedByCategory, RELATED_INDEX_LINKS } from '../utils/relatedTickers.js';
import { notifyChartFullscreenLayout } from '../utils/chartFullscreenLayout.js';
import { formatRelativePerfPct } from '../utils/marketCalculations.js';
import { fmtAbsSigned, fmtPctSigned, fmtPrice, fmtVolumeCompact } from '../utils/formatDisplayNumber.js';
import { sectorFieldToEtfSlug } from '../utils/sectorEtfMatch.js';
import { ModalCloseIcon } from '../components/ModalCloseIcon.jsx';
import { TickerSplitBanner } from '../components/TickerSplitBanner.jsx';
import { ReturnsChartClickableHeading } from '../components/ReturnsChartClickableTitle.jsx';
import { ReturnsChartPieIcon } from '../components/returnsChartToolbarIcons.jsx';
import { ReturnsChartToolbar, ReturnsChartToolbarIconButton } from '../components/ReturnsChartToolbar.jsx';
import { ReturnsChartIcoDownload } from '../components/returnsChartToolbarIcons.jsx';
import { ChartFullscreenToggleIcon } from '../components/ChartFullscreenToggleIcon.jsx';
import { coerceDateRange, dateInputBounds } from '../utils/dateRangeConstraints.js';
import { ChartSnapshotExportModal } from '../components/ChartSnapshotExportModal.jsx';
import { useGatedCsvDownload } from '../hooks/useGatedCsvDownload.js';
import { useIsLoggedIn } from '../hooks/useIsLoggedIn.js';
import { usePaperPositions } from '../hooks/usePaperPositions.js';
import { applyTickerChartSnapshotCloneFixes, useChartSnapshotExport } from '../hooks/useChartSnapshotExport.js';
import { buildRelativeStrengthTickerHref } from '../utils/relativeStrengthNavigation.js';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';

const TIMEFRAMES = ['1D', '5D', '1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y', '20Y'];
/** Must stay ≤ backend `OHLC_SIGNALS_MAX_RANGE_DAYS` (default 40000). */
const MAX_SIGNAL_RANGE_DAYS = 40000;
const BENCHMARK = 'SPY';
/** Stable fallback so effects keyed on `dynamicPeriods` do not loop on `|| []`. */
const EMPTY_DYNAMIC_PERIODS = Object.freeze([]);

/** Main-chart resize scope id (session-only height; not persisted across refresh). */
const CHART_USER_H_KEY = 'odin_ticker_chart_h';
/** Max drag height; min height follows {@link useMediaChartHeight} (layout default per breakpoint). */
const CHART_H_MAX = 800;

const RESIZE_KEY_ANNUAL_FIGMA = 'odin_ticker_resize_annual_figma';
const RESIZE_KEY_QUARTERLY_FIGMA = 'odin_ticker_resize_quarterly_figma';
const RESIZE_KEY_MONTHLY = 'odin_ticker_resize_monthly';
const RESIZE_KEY_MONTHLY_ADV = 'odin_ticker_resize_monthly_waterfall';
const RETURNS_DEFAULT_START = '2018-01-01';
/** Long-window returns for Benchmark vs Ticker section (matches section table range). */
const TABLE_LONG_START_DATE = '2005-01-01';
/** Default section benchmark ticker when group is S&P 500 (`TickerSection23Section24` GROUPS[0]). */
const SECTION_LONG_DEFAULT_BENCHMARK = 'SPX';

const MAX_NEWS_ITEMS = 120;
const NEWS_PAGE_SIZE = 5;
const FINNHUB_BASE = 'https://finnhub.io/api/v1/company-news';
const FINNHUB_TOKEN = finnhubToken();
const COMPANY_OVERVIEW_BASE = 'https://www.alphavantage.co/query';
const COMPANY_PROFILE_DATA_KEY = companyProfileDataKey();
const companyOverviewCache = new Map();
const companyOverviewInflight = new Map();
const FALLBACK_TICKER_NEWS = [
  {
    id: 'ticker-news-fallback-1',
    title: 'Company-specific headline feed unavailable; showing placeholder item.',
    source: 'Odin Ticker Desk',
    time: 'sample',
    url: ''
  }
];

const PERF_COLS = [
  { label: '1M', period: 'Last Month' },
  { label: '3M', period: 'Last 3 months' },
  { label: 'YTD', period: 'Year to Date (YTD)' },
  { label: '1Y', period: 'Last 1 year' }
];

/** Maps comparison table row → `dynamicPeriods[].period` name (null = computed from OHLC). */
const COMPARE_ROWS = [
  { key: '1D', period: 'Last date' },
  { key: '5D', period: 'Week' },
  { key: 'MTD', period: null, mtd: true },
  { key: '1M', period: 'Last Month' },
  { key: 'QTD', period: null, qtd: true },
  { key: '3M', period: 'Last 3 months' },
  { key: '6M', period: 'Last 6 months' },
  { key: 'YTD', period: 'Year to Date (YTD)' },
  { key: '1Y', period: 'Last 1 year' },
  { key: '3Y', period: 'Last 3 years' },
  { key: '5Y', period: 'Last 5 years' },
  { key: '10Y', period: 'Last 10 years' },
  { key: '20Y', period: 'Last 20 years' }
];

const RELATIVE_INDEX_OPTIONS = [
  /** Official index tickers via ticker-core-returns (matches TickerSection23Section24 / long table). */
  { key: 'sp500', label: 'S&P 500', apiIndex: 'sp500', ticker: 'SPX' },
  { key: 'dow-jones', label: 'Dow Jones', apiIndex: 'Dow Jones', ticker: 'DJI' },
  { key: 'nasdaq-100', label: 'Nasdaq 100', apiIndex: 'Nasdaq 100', ticker: 'NDX' }
];
const RELATIVE_INDEX_DROPDOWN_OPTIONS = RELATIVE_INDEX_OPTIONS.map((o) => ({ id: o.key, label: o.label }));
function yesterdayIsoForLongTable() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateInput(d);
}

/** Resolve one ticker payload from single or batched `/ticker-returns` response. */
function pickTickerReturnsFromPayload(payload, ticker) {
  const u = String(ticker || '').toUpperCase().trim();
  if (!payload || !u) return null;
  if (payload.batch === true && payload.byTicker && payload.byTicker[u] != null) {
    const row = payload.byTicker[u];
    if (row && row.success === false) return null;
    return row;
  }
  if (!payload.batch && String(payload.ticker || '').toUpperCase() === u) return payload;
  return null;
}

/** True when SSR/core payload already includes chart period series. */
function hasPeriodChartData(returnsSym) {
  const perf = returnsSym?.performance;
  return Boolean(
    perf?.annualReturns?.length && perf?.quarterlyReturns?.length && perf?.monthlyReturns?.length
  );
}

/** Merge partial `ticker-*-returns` / `ticker-core-returns` payloads into one `returnsSym`-style object. */
function mergeTickerReturns(prev, patch) {
  if (!patch || patch.success === false) return prev;
  const pPrev = prev?.performance || {};
  const pNext = patch.performance || {};
  const pick = (key) => {
    const nextVal = pNext[key];
    const prevVal = pPrev[key];
    if (nextVal === undefined) return prevVal;
    if (Array.isArray(nextVal) && nextVal.length === 0 && Array.isArray(prevVal) && prevVal.length > 0) return prevVal;
    return nextVal;
  };
  return {
    ...prev,
    ...patch,
    ticker: patch.ticker ?? prev?.ticker,
    asOfDate: patch.asOfDate ?? prev?.asOfDate,
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

function pickNum(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      const n = Number(row[key]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtCompact(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1
  }).format(n);
}

function alphaProfileIrlink(site) {
  const raw = String(site || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = String(u.hostname || '').replace(/^www\./i, '').trim();
    if (!host) return '';
    return `https://investor.${host}`;
  } catch {
    return '';
  }
}

async function fetchCompanyOverviewOnce(symbol) {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym || !COMPANY_PROFILE_DATA_KEY) return null;
  if (companyOverviewCache.has(sym)) return companyOverviewCache.get(sym);
  if (companyOverviewInflight.has(sym)) return companyOverviewInflight.get(sym);
  const qs = new URLSearchParams({
    function: 'OVERVIEW',
    symbol: sym,
    apikey: COMPANY_PROFILE_DATA_KEY
  });
  const req = (async () => {
    try {
      const res = await fetch(`${COMPANY_OVERVIEW_BASE}?${qs.toString()}`);
      const payload = await res.json();
      console.log('[TickerPage] company overview API response', { symbol: sym, payload });
      if (payload?.Information || payload?.Note || payload?.ErrorMessage) {
        return companyOverviewCache.get(sym) || null;
      }
      const normalized = payload && typeof payload === 'object' ? payload : null;
      if (normalized) companyOverviewCache.set(sym, normalized);
      return normalized;
    } catch (error) {
      console.log('[TickerPage] company overview API error', { symbol: sym, error: String(error?.message || error) });
      return companyOverviewCache.get(sym) || null;
    } finally {
      companyOverviewInflight.delete(sym);
    }
  })();
  companyOverviewInflight.set(sym, req);
  return req;
}

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function toIso(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Cap how far `start` can be before `end` so inclusive calendar-day span ≤ `maxInclusiveDays`
 * (matches backend ohlc-signals-indicator: floor((end-start)/1d)+1 ≤ max).
 */
function clampStartToMaxDays(start, end, maxInclusiveDays) {
  const maxDiffMs = (maxInclusiveDays - 1) * 86400000;
  const diff = end.getTime() - start.getTime();
  if (diff <= maxDiffMs) return start;
  return new Date(end.getTime() - maxDiffMs);
}

/**
 * First calendar date in a backward walk from `endIso` until `sessionCount` Mon–Fri
 * sessions have been included (the end date counts if it is a weekday).
 */
function startDateForLastTradingSessions(endIso, sessionCount) {
  const end = new Date(String(endIso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(end.getTime()) || sessionCount < 1) return String(endIso).slice(0, 10);
  let d = new Date(end);
  let counted = 0;
  for (;;) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) counted += 1;
    if (counted >= sessionCount) break;
    d.setDate(d.getDate() - 1);
  }
  return toIso(d);
}

/**
 * @param {string} tf
 * @param {string} endIso as-of / chart end (YYYY-MM-DD)
 * @param {{ min: string, max: string } | null} [bounds] first/last OHLC dates from `/api/market/ohlc-ticker-bounds` (for ALL)
 */
function rangeForTimeframe(tf, endIso, bounds = null) {
  const end = new Date(String(endIso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(end.getTime()) || !String(endIso || '').trim()) {
    return { start: '', end: '' };
  }
  const endStr = String(endIso).slice(0, 10);
  if (tf === '1D') {
    const startStr = startDateForLastTradingSessions(endStr, 3);
    const startD = new Date(startStr + 'T12:00:00');
    const capped = clampStartToMaxDays(startD, end, MAX_SIGNAL_RANGE_DAYS);
    return { start: toIso(capped), end: endStr };
  }
  if (tf === '5D') {
    const startStr = startDateForLastTradingSessions(endStr, 5);
    const startD = new Date(startStr + 'T12:00:00');
    const capped = clampStartToMaxDays(startD, end, MAX_SIGNAL_RANGE_DAYS);
    return { start: toIso(capped), end: endStr };
  }
  const start = new Date(end);
  switch (tf) {
    case 'MTD':
      start.setTime(new Date(end.getFullYear(), end.getMonth(), 1).getTime());
      break;
    case '1M':
      start.setDate(end.getDate() - 35);
      break;
    case 'QTD':
      start.setTime(new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1).getTime());
      break;
    case '3M':
      start.setDate(end.getDate() - 95);
      break;
    case '6M':
      start.setDate(end.getDate() - 185);
      break;
    case 'YTD':
      start.setTime(new Date(end.getFullYear(), 0, 1).getTime());
      break;
    case '1Y':
      start.setDate(end.getDate() - 370);
      break;
    case '3Y':
      start.setDate(end.getDate() - 1100);
      break;
    case '5Y':
      start.setDate(end.getDate() - 1825);
      break;
    case '10Y': {
      const t = new Date(end);
      t.setFullYear(t.getFullYear() - 10);
      start.setTime(t.getTime());
      break;
    }
    case '20Y': {
      const t = new Date(end);
      t.setFullYear(t.getFullYear() - 20);
      start.setTime(t.getTime());
      break;
    }
    case 'ALL':
      if (bounds?.min) {
        const minD = new Date(String(bounds.min).slice(0, 10) + 'T12:00:00');
        if (!Number.isNaN(minD.getTime())) {
          start.setTime(minD.getTime() > end.getTime() ? end.getTime() : minD.getTime());
        } else {
          start.setDate(end.getDate() - (MAX_SIGNAL_RANGE_DAYS - 1));
        }
      } else {
        start.setDate(end.getDate() - (MAX_SIGNAL_RANGE_DAYS - 1));
      }
      break;
    default:
      start.setDate(end.getDate() - 370);
  }
  const capped = clampStartToMaxDays(start, end, MAX_SIGNAL_RANGE_DAYS);
  return { start: toIso(capped), end: endStr };
}

/** User custom chart range: validate, order, cap span, cap end to dataset as-of. */
function normalizeCustomChartRange(startStr, endStr, asOfIso) {
  const ns = String(startStr || '').trim();
  const ne = String(endStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ns) || !/^\d{4}-\d{2}-\d{2}$/.test(ne)) return null;
  let sd = new Date(ns + 'T12:00:00');
  let ed = new Date(ne + 'T12:00:00');
  if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) return null;
  const coerced = coerceDateRange(ns, ne);
  sd = new Date(coerced.start + 'T12:00:00');
  ed = new Date(coerced.end + 'T12:00:00');
  const cap = new Date(String(asOfIso || '').slice(0, 10) + 'T12:00:00');
  if (!Number.isNaN(cap.getTime()) && ed > cap) ed = cap;
  const capped = clampStartToMaxDays(sd, ed, MAX_SIGNAL_RANGE_DAYS);
  return { start: toIso(capped), end: toIso(ed) };
}

function sortRowsAsc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = rowDateToTimeKey(a);
    const tb = rowDateToTimeKey(b);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

function toIsoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function recentRange(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function fmtNewsTime(unixSec) {
  const ts = Number(unixSec);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function mapTickerNewsRow(row, symbol) {
  if (!row || typeof row !== 'object') return null;
  const title = String(row.headline || '').trim();
  const id = row.id != null ? `${symbol}-${row.id}` : `${symbol}-${row.url || title}`;
  if (!title || !id) return null;
  return {
    id,
    title,
    source: String(row.source || 'Finnhub').trim() || 'Finnhub',
    time: fmtNewsTime(row.datetime) || '',
    url: String(row.url || '').trim()
  };
}

async function fetchTickerNews(symbol, days = 10) {
  if (!FINNHUB_TOKEN) return [];
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return [];
  const { from, to } = recentRange(days);
  const qs = new URLSearchParams({ symbol: sym, from, to, token: FINNHUB_TOKEN });
  const res = await fetch(`${FINNHUB_BASE}?${qs.toString()}`);
  if (!res.ok) throw new Error(`News request failed (${res.status})`);
  const payload = await res.json();
  const list = Array.isArray(payload) ? payload : [];
  return list.map((r) => mapTickerNewsRow(r, sym)).filter(Boolean).slice(0, MAX_NEWS_ITEMS);
}

function annualizedVol(closes) {
  if (!closes || closes.length < 5) return null;
  const lr = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) lr.push(Math.log(b / a));
  }
  if (lr.length < 2) return null;
  const mean = lr.reduce((s, x) => s + x, 0) / lr.length;
  const varSample = lr.reduce((s, x) => s + (x - mean) ** 2, 0) / (lr.length - 1);
  const daily = Math.sqrt(varSample);
  return Math.round(daily * Math.sqrt(252) * 100 * 10) / 10;
}

function pickDynamic(dynamicPeriods, periodName) {
  if (!periodName || !Array.isArray(dynamicPeriods)) return null;
  const row = dynamicPeriods.find((r) => r.period === periodName);
  return row && row.totalReturn != null ? Number(row.totalReturn) : null;
}

function periodReturnFromRows(sortedAsc, startFilter) {
  if (!sortedAsc.length) return null;
  const last = sortedAsc[sortedAsc.length - 1];
  const lastClose = pickNum(last, ['Close', 'close']);
  const first = sortedAsc.find(startFilter);
  if (!first) return null;
  const firstClose = pickNum(first, ['Close', 'close']);
  if (firstClose == null || lastClose == null || firstClose === 0) return null;
  return ((lastClose - firstClose) / firstClose) * 100;
}

function mtdFromRows(sortedAsc) {
  if (!sortedAsc.length) return null;
  const last = sortedAsc[sortedAsc.length - 1];
  const lastIso = rowDateToTimeKey(last);
  if (!lastIso) return null;
  const lastD = new Date(lastIso + 'T12:00:00');
  return periodReturnFromRows(sortedAsc, (r) => {
    const iso = rowDateToTimeKey(r);
    if (!iso) return false;
    const d = new Date(iso + 'T12:00:00');
    return d.getFullYear() === lastD.getFullYear() && d.getMonth() === lastD.getMonth();
  });
}

function qtdFromRows(sortedAsc) {
  if (!sortedAsc.length) return null;
  const last = sortedAsc[sortedAsc.length - 1];
  const lastIso = rowDateToTimeKey(last);
  if (!lastIso) return null;
  const lastD = new Date(lastIso + 'T12:00:00');
  const q = Math.floor(lastD.getMonth() / 3);
  const qStart = new Date(lastD.getFullYear(), q * 3, 1);
  return periodReturnFromRows(sortedAsc, (r) => {
    const iso = rowDateToTimeKey(r);
    if (!iso) return false;
    const d = new Date(iso + 'T12:00:00');
    return d >= qStart;
  });
}

function ohlcRowsFromPayload(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function IconFlagUs({ className }) {
  return (
    <svg className={className} viewBox="0 0 21 14" aria-hidden width="21" height="14">
      <rect width="21" height="14" fill="#b22234" rx="1" />
      <path fill="#fff" d="M0 2h21v2H0V2zm0 4h21v2H0V6zm0 4h21v2H0v-2z" />
      <rect x="0" y="0" width="9" height="8" fill="#3c3b6e" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <circle key={`${row}-${col}`} cx={1 + col * 1.6} cy={1 + row * 1.6} r="0.45" fill="#fff" />
        ))
      )}
    </svg>
  );
}

function IconBell({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2z" />
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 5 3 9H3c0-4 3-2 3-9" />
    </svg>
  );
}

function IconPlus({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconPencil({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

/** Document / notes (Figma “My Notes”). */
function IconDocument({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronRight({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartTypeToolbarDropdown({ chartType, onChartTypeChange }) {
  return (
    <ThemedDropdown
      className="ticker-page__chart-type-dd"
      value={chartType}
      options={TICKER_CHART_TYPE_OPTIONS}
      onChange={onChartTypeChange}
      title="Chart type"
      ariaLabelPrefix="Chart type"
      labelFallback="Line"
      icon={<IconChartTypeDropdown className="app-dropdown__chart-type-icon" />}
    />
  );
}

// function ChartToolbarIcons() {
//   const c = 'ticker-chart-toolbar__ico';
//   return (
//     <div className="ticker-chart-toolbar__icons" aria-hidden>
//       <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
//         <path d="M3 21l6-6 4 4 8-8M21 7V3h-4" />
//       </svg>
//       <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
//         <path d="M4 20L20 4M4 4v4m0-4h4M20 20v-4m0 4h-4" />
//       </svg>
//       <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
//         <rect x="4" y="4" width="16" height="16" rx="1" />
//         <path d="M4 12h16M12 4v16" />
//       </svg>
//       <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
//         <path d="M4 18h16M4 12h10M4 6h14" />
//       </svg>
//       <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
//         <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
//       </svg>
//     </div>
//   );
// }

function pctClass(n) {
  if (n == null || !Number.isFinite(n)) return '';
  if (n > 0) return 'ticker-num--up';
  if (n < 0) return 'ticker-num--down';
  return '';
}

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').TickerPageInitialData | null} [props.initialData]
 */
export default function TickerPage({ initialData = null }) {
  const location = useLocation();
  const { symbol: symbolParam } = useParams();
  const navigate = useNavigate();
  const watchlistDock = useWatchlistDock();
  const [activeSymbol, setActiveSymbol] = useState(() => sanitizeTickerPageInput(symbolParam) || 'AAPL');
  const sym = activeSymbol;
  const canonicalSym = String(sym || 'AAPL').toLowerCase();
  const ssrSeed =
    initialData?.symbol &&
    String(initialData.symbol).toUpperCase() === String(sym).toUpperCase()
      ? initialData
      : null;

  const onAddTickerToWatchlist = useCallback(() => {
    const ticker = String(sym || '').toUpperCase().trim();
    watchlistDock.open();
    try {
      if (ticker) sessionStorage.setItem('watchlist_add_symbol', ticker);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('watchlist:add-ticker', { detail: { symbol: ticker } }));
  }, [watchlistDock, sym]);

  useEffect(() => {
    const next = resolveTickerPageSymbol(symbolParam);
    setActiveSymbol((prev) => (prev === next ? prev : next));
  }, [symbolParam]);

  useEffect(() => {
    for (const key of [CHART_USER_H_KEY, RESIZE_KEY_ANNUAL_FIGMA, RESIZE_KEY_QUARTERLY_FIGMA, RESIZE_KEY_MONTHLY]) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const [authVersion, setAuthVersion] = useState(0);
  const [timeframe, setTimeframe] = useState('1Y');
  const [chartLoading, setChartLoading] = useState(false);
  const [metaBusy, setMetaBusy] = useState(() => {
    if (!ssrSeed?.returnsSym) return true;
    return !hasPeriodChartData(ssrSeed.returnsSym);
  });
  const [error, setError] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => ssrSeed?.asOfDate || '');
  const [symbolRefreshToken, setSymbolRefreshToken] = useState(0);
  const [tickerReturnsDebug, setTickerReturnsDebug] = useState(null);
  const [apiTimings, setApiTimings] = useState({
    chartMs: null,
    coreMs: null,
    metaMs: null,
    ohlcHits: 0,
    ohlcMisses: 0
  });

  const [ohlcRows, setOhlcRows] = useState([]);
  const [returnsSym, setReturnsSym] = useState(() => ssrSeed?.returnsSym ?? null);
  const [returnsSpy, setReturnsSpy] = useState(() => ssrSeed?.returnsSpy ?? null);
  const [detailRows, setDetailRows] = useState([]);
  const [statsRows, setStatsRows] = useState(() =>
    ssrSeed?.ohlcRows?.length ? sortRowsAsc(ssrSeed.ohlcRows) : []
  );
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [tailRows, setTailRows] = useState(() =>
    ssrSeed?.ohlcRows?.length ? sortRowsAsc(ssrSeed.ohlcRows).slice(-8) : []
  );
  const [relativeIndexKey, setRelativeIndexKey] = useState('sp500');
  const [relativeTickerSymbol, setRelativeTickerSymbol] = useState(sym);
  const [relativeIndexSeriesByKey, setRelativeIndexSeriesByKey] = useState({});
  const [relativeTickerSeriesBySymbol, setRelativeTickerSeriesBySymbol] = useState({});
  const [relativeCompareBusy, setRelativeCompareBusy] = useState(false);
  /** Benchmark symbol for long-range table section; synced from `TickerSection23Section24` group. */
  const [benchForLongTable, setBenchForLongTable] = useState(SECTION_LONG_DEFAULT_BENCHMARK);
  const [longRangeTickerReturns, setLongRangeTickerReturns] = useState(null);
  const [longRangeBenchReturns, setLongRangeBenchReturns] = useState(null);
  const [longRangeBusy, setLongRangeBusy] = useState(false);
  const [newsPage, setNewsPage] = useState(1);
  const [chartHoverOhlc, setChartHoverOhlc] = useState(null);
  const [tickerNewsBusy, setTickerNewsBusy] = useState(false);
  const [tickerNewsError, setTickerNewsError] = useState('');
  const [tickerNewsItems, setTickerNewsItems] = useState([]);
  const [companyOverview, setCompanyOverview] = useState(null);
  const [companyOverviewBusy, setCompanyOverviewBusy] = useState(false);
  const [companyOverviewExpanded, setCompanyOverviewExpanded] = useState(false);
  const [splitSummary, setSplitSummary] = useState(null);
  const [chartSplits, setChartSplits] = useState([]);
  const liveNews = useMemo(
    () => (tickerNewsItems.length ? tickerNewsItems.slice(0, MAX_NEWS_ITEMS) : FALLBACK_TICKER_NEWS),
    [tickerNewsItems]
  );
  const [appliedCustomRange, setAppliedCustomRange] = useState(null);
  const [draftChartStart, setDraftChartStart] = useState('');
  const [draftChartEnd, setDraftChartEnd] = useState('');
  const customRangeBounds = useMemo(
    () => dateInputBounds(draftChartStart, draftChartEnd, { globalMax: asOfDate }),
    [draftChartStart, draftChartEnd, asOfDate]
  );
  const [isCustomRangePopupOpen, setIsCustomRangePopupOpen] = useState(false);
  const [mainChartType, setMainChartType] = useState('area');
  const [ohlcTickerBounds, setOhlcTickerBounds] = useState(/** @type {{ min: string, max: string } | null} */ (null));

  const chartBodyRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartPlotHostRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const ohlcWindowCacheRef = useRef(new Map());
  const mediaChartHeight = useMediaChartHeight();
  const mediaHRef = useRef(mediaChartHeight);
  mediaHRef.current = mediaChartHeight;

  const mainChartResize = useTickerPlotResize(
    CHART_USER_H_KEY,
    mediaChartHeight,
    mediaChartHeight,
    CHART_H_MAX,
    false
  );
  const [chartFs, setChartFs] = useState(false);
  const [fsPlotH, setFsPlotH] = useState(0);

  const chartApiRange = useMemo(() => {
    if (appliedCustomRange?.start && appliedCustomRange?.end) {
      const n = normalizeCustomChartRange(appliedCustomRange.start, appliedCustomRange.end, asOfDate);
      return n || rangeForTimeframe(timeframe, asOfDate, ohlcTickerBounds);
    }
    return rangeForTimeframe(timeframe, asOfDate, ohlcTickerBounds);
  }, [appliedCustomRange, timeframe, asOfDate, ohlcTickerBounds]);

  useEffect(() => {
    if (appliedCustomRange) return;
    const r = rangeForTimeframe(timeframe, asOfDate, ohlcTickerBounds);
    setDraftChartStart(r.start);
    setDraftChartEnd(r.end);
  }, [timeframe, asOfDate, appliedCustomRange, ohlcTickerBounds]);

  useEffect(() => {
    const onAuth = () => setAuthVersion((v) => v + 1);
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, []);

  const onSymbolChange = useCallback((next) => {
    const s = sanitizeTickerPageInput(next);
    const fallback = DEFAULT_TICKER_ROUTE_SYMBOL;
    const target = s || fallback;
    if (target === sym) return;
    setSymbolRefreshToken((v) => v + 1);
    setActiveSymbol(target);
    replaceTickerPathname(target);
  }, [sym]);

  const onCustomRangeDateChange = useCallback(
    (nextStart, nextEnd) => {
      setDraftChartStart(nextStart);
      setDraftChartEnd(nextEnd);
      const n = normalizeCustomChartRange(nextStart, nextEnd, asOfDate);
      if (!n) return;
      setAppliedCustomRange(n);
      setDraftChartStart(n.start);
      setDraftChartEnd(n.end);
    },
    [asOfDate]
  );

  useEffect(() => {
    if (!isCustomRangePopupOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsCustomRangePopupOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCustomRangePopupOpen]);

  const onSectionBenchmarkSymbolChange = useCallback((b) => {
    setBenchForLongTable(String(b || SECTION_LONG_DEFAULT_BENCHMARK).toUpperCase().trim());
  }, []);

  const fetchOhlcRowsCached = useCallback(async ({ symbol, startDate, endDate, limit = 400, ttlMs = 10 * 60 * 1000 }) => {
    const symU = String(symbol || '').toUpperCase().trim();
    if (!symU) return [];
    const key = [symU, String(startDate || ''), String(endDate || ''), String(limit)].join('|');
    if (ohlcWindowCacheRef.current.has(key)) {
      setApiTimings((prev) => ({ ...prev, ohlcHits: prev.ohlcHits + 1 }));
      return ohlcWindowCacheRef.current.get(key);
    }
    setApiTimings((prev) => ({ ...prev, ohlcMisses: prev.ohlcMisses + 1 }));
    const pathParts = ['/api/market/ohlc?symbol=' + encodeURIComponent(symU)];
    if (startDate) pathParts.push('&start_date=' + encodeURIComponent(startDate));
    if (endDate) pathParts.push('&end_date=' + encodeURIComponent(endDate));
    if (limit) pathParts.push('&limit=' + encodeURIComponent(String(limit)));
    const rowsRes = await fetchJsonCached({
      path: pathParts.join(''),
      method: 'GET',
      ttlMs
    });
    const rows = sortRowsAsc(ohlcRowsFromPayload(rowsRes.data));
    ohlcWindowCacheRef.current.set(key, rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) {
      if (!ssrSeed) {
        setError('Unable to load ticker data.');
        setMetaBusy(false);
        setOhlcRows([]);
        setReturnsSym(null);
        setReturnsSpy(null);
        setLongRangeTickerReturns(null);
        setLongRangeBenchReturns(null);
        setDetailRows([]);
        setStatsRows([]);
        setStatsRowsSpy([]);
        setTailRows([]);
        setOhlcTickerBounds(null);
        setTickerReturnsDebug(null);
      }
      return () => {
        cancelled = true;
      };
    }
    ohlcWindowCacheRef.current.clear();

    const hasCoreSym = Boolean(ssrSeed?.returnsSym);
    const hasCoreSpy = Boolean(ssrSeed?.returnsSpy);
    const needsPeriodFetches = !hasPeriodChartData(ssrSeed?.returnsSym);

    (async () => {
      const coreStartedAt = performance.now();
      if (!hasCoreSym || needsPeriodFetches) setMetaBusy(true);
      setError('');
      const returnsDefaultEnd = toDateInput(new Date());
      const symU = String(sym || '').toUpperCase().trim();

      /** 1Y OHLC stats window seeded from calendar “today” so OHLC requests run in parallel with ticker-returns. */
      const seedEnd = returnsDefaultEnd;
      const seedAsOfD = new Date(seedEnd + 'T12:00:00');
      const seedStart365 = new Date(seedAsOfD);
      seedStart365.setFullYear(seedStart365.getFullYear() - 1);
      const seedStartIso = toIso(seedStart365);

      const clearBusyWhenVisible = () => {
        if (!stale()) setMetaBusy(false);
      };

      const tasks = [];

      const defaultRangeBody = {
        customStartDate: RETURNS_DEFAULT_START,
        customEndDate: returnsDefaultEnd
      };

      const patchSymReturns = (data) => {
        if (stale() || !data) return;
        setReturnsSym((prev) => mergeTickerReturns(prev, data));
        const asOf = data.asOfDate || seedEnd;
        setAsOfDate(String(asOf).slice(0, 10));
      };
      const patchSpyReturns = (data) => {
        if (stale() || !data) return;
        setReturnsSpy((prev) => mergeTickerReturns(prev, data));
      };

      if (!hasCoreSym) {
        tasks.push(
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body: { ticker: symU, ...defaultRangeBody },
            ttlMs: 5 * 60 * 1000
          })
            .then(async (resCore) => {
              if (stale()) return;
              const h = resCore?.headers || null;
              setTickerReturnsDebug({
                source: h?.['x-ticker-returns-source'] || (resCore?.fromCache ? 'frontend-cache' : 'unknown'),
                cacheHit: h?.['x-cache-hit'] || (resCore?.fromCache ? '1' : '0'),
                computeMs: h?.['x-compute-ms'] || '',
                cacheKey: h?.['x-cache-key'] || '',
                mode: 'core-sym',
                symbol: symU
              });
              patchSymReturns(resCore.data);

              const endFromReturns = String(resCore.data?.asOfDate || seedEnd).slice(0, 10);
              if (endFromReturns !== seedEnd) {
                const asOfD = new Date(endFromReturns + 'T12:00:00');
                const start365 = new Date(asOfD);
                start365.setFullYear(start365.getFullYear() - 1);
                const startIso = toIso(start365);
                try {
                  const [symStatsRows, spyStatsRows] = await Promise.all([
                    fetchOhlcRowsCached({
                      symbol: symU,
                      startDate: startIso,
                      endDate: endFromReturns,
                      limit: 400
                    }),
                    fetchOhlcRowsCached({
                      symbol: BENCHMARK,
                      startDate: startIso,
                      endDate: endFromReturns,
                      limit: 400
                    })
                  ]);
                  if (stale()) return;
                  setStatsRows(symStatsRows);
                  setStatsRowsSpy(spyStatsRows);
                  setTailRows(symStatsRows.slice(-8));
                } catch {
                  /* keep seeded stats rows */
                }
              }
              clearBusyWhenVisible();
            })
            .catch((e) => {
              if (!stale()) {
                setReturnsSym(null);
                setError((prev) => prev || e?.message || 'Failed to load returns');
              }
            })
        );
      }

      if (!hasCoreSpy) {
        tasks.push(
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body: { ticker: BENCHMARK, ...defaultRangeBody },
            ttlMs: 5 * 60 * 1000
          })
            .then((res) => {
              if (stale()) return;
              patchSpyReturns(res.data);
              clearBusyWhenVisible();
            })
            .catch(() => {
              if (!stale()) setReturnsSpy(null);
            })
        );
      }

      if (needsPeriodFetches) {
        tasks.push(
          fetchJsonCached({
            path: '/api/market/ticker-annual-returns',
            method: 'POST',
            body: { ticker: symU, ...defaultRangeBody },
            ttlMs: 5 * 60 * 1000
          })
            .then((res) => {
              if (stale()) return;
              patchSymReturns(res.data);
              clearBusyWhenVisible();
            })
            .catch(() => {
              /* non-fatal: core tables still work */
            })
        );
        tasks.push(
          fetchJsonCached({
            path: '/api/market/ticker-quarterly-returns',
            method: 'POST',
            body: { ticker: symU, ...defaultRangeBody },
            ttlMs: 5 * 60 * 1000
          })
            .then((res) => {
              if (stale()) return;
              patchSymReturns(res.data);
              clearBusyWhenVisible();
            })
            .catch(() => {})
        );
        tasks.push(
          fetchJsonCached({
            path: '/api/market/ticker-monthly-returns',
            method: 'POST',
            body: { ticker: symU, ...defaultRangeBody },
            ttlMs: 5 * 60 * 1000
          })
            .then((res) => {
              if (stale()) return;
              patchSymReturns(res.data);
              clearBusyWhenVisible();
            })
            .catch(() => {})
        );
      }

      if (!ssrSeed?.ohlcRows?.length) {
        tasks.push(
          Promise.all([
            fetchOhlcRowsCached({
              symbol: symU,
              startDate: seedStartIso,
              endDate: seedEnd,
              limit: 400
            }),
            fetchOhlcRowsCached({
              symbol: BENCHMARK,
              startDate: seedStartIso,
              endDate: seedEnd,
              limit: 400
            })
          ])
            .then(([symStatsRows, spyStatsRows]) => {
              if (stale()) return;
              setStatsRows(symStatsRows);
              setStatsRowsSpy(spyStatsRows);
              setTailRows(symStatsRows.slice(-8));
              clearBusyWhenVisible();
            })
            .catch(() => {
              if (!stale()) {
                setStatsRows([]);
                setStatsRowsSpy([]);
                setTailRows([]);
              }
            })
        );
      }

      await Promise.allSettled(tasks);
      if (!stale()) {
        setMetaBusy(false);
        setApiTimings((prev) => ({ ...prev, coreMs: Math.round(performance.now() - coreStartedAt) }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, authVersion, symbolRefreshToken, fetchOhlcRowsCached, ssrSeed]);

  /** Lazy metadata load so chart/returns render first. */
  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) {
      setDetailRows([]);
      return () => {
        cancelled = true;
      };
    }
    const t = setTimeout(() => {
      void (async () => {
        const metaStartedAt = performance.now();
        try {
          const detailsRes = await fetchJsonCached({
            path: '/api/market/ticker-details',
            method: 'POST',
            body: { index: 'sp500', period: 'last-1-year' },
            ttlMs: 30 * 60 * 1000
          });
          if (stale()) return;
          const d = detailsRes.data;
          setDetailRows(Array.isArray(d?.data) ? d.data : []);
          setApiTimings((prev) => ({ ...prev, metaMs: Math.round(performance.now() - metaStartedAt) }));
        } catch {
          if (!stale()) setDetailRows([]);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [sym, authVersion, symbolRefreshToken]);

  /** Second (and final) ticker-returns request on load: long table window for page symbol + active section benchmark. */
  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) {
      setLongRangeTickerReturns(null);
      setLongRangeBenchReturns(null);
      setLongRangeBusy(false);
      return () => {
        cancelled = true;
      };
    }
    const symU = String(sym || '').toUpperCase().trim();
    const benchU = String(benchForLongTable || '').toUpperCase().trim();
    if (!symU || !benchU) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setLongRangeBusy(true);
      try {
        const longEnd = yesterdayIsoForLongTable();
        const longBody = {
          customStartDate: TABLE_LONG_START_DATE,
          customEndDate: longEnd
        };
        const [symRes, benchRes] = await Promise.all([
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body: { ticker: symU, ...longBody },
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body: { ticker: benchU, ...longBody },
            ttlMs: 5 * 60 * 1000
          })
        ]);
        if (stale()) return;
        const h = symRes?.headers || null;
        setTickerReturnsDebug({
          source: h?.['x-ticker-returns-source'] || (symRes?.fromCache ? 'frontend-cache' : 'unknown'),
          cacheHit: h?.['x-cache-hit'] || (symRes?.fromCache ? '1' : '0'),
          computeMs: h?.['x-compute-ms'] || '',
          cacheKey: h?.['x-cache-key'] || '',
          mode: 'long-range-table',
          symbol: symU
        });
        setLongRangeTickerReturns(
          pickTickerReturnsFromPayload(symRes.data, symU) || (symRes.data?.ticker ? symRes.data : null)
        );
        setLongRangeBenchReturns(
          pickTickerReturnsFromPayload(benchRes.data, benchU) || (benchRes.data?.ticker ? benchRes.data : null)
        );
      } catch {
        if (!stale()) {
          setLongRangeTickerReturns(null);
          setLongRangeBenchReturns(null);
        }
      } finally {
        if (!stale()) setLongRangeBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, benchForLongTable, authVersion, symbolRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) {
      setOhlcTickerBounds(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const { data } = await fetchJsonCached({
          path: '/api/market/ohlc-ticker-bounds?symbol=' + encodeURIComponent(sym),
          method: 'GET',
          ttlMs: 60 * 60 * 1000
        });
        if (stale()) return;
        if (data?.success && data.min_date && data.max_date) {
          setOhlcTickerBounds({ min: String(data.min_date).slice(0, 10), max: String(data.max_date).slice(0, 10) });
        } else {
          setOhlcTickerBounds(null);
        }
      } catch {
        if (!stale()) setOhlcTickerBounds(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym, authVersion, symbolRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    if (!canFetchMarketData() || !sym) {
      setSplitSummary(null);
      return undefined;
    }
    (async () => {
      try {
        const res = await fetchJsonCached({
          path: `/api/splits/ticker/${encodeURIComponent(sym)}?recent_days=365`,
          method: 'GET',
          ttlMs: 10 * 60 * 1000
        });
        if (cancelled) return;
        setSplitSummary(res?.data || null);
      } catch {
        if (!cancelled) setSplitSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym, authVersion]);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) {
      setChartLoading(false);
      setOhlcRows([]);
      return;
    }

    (async () => {
      const chartStartedAt = performance.now();
      setChartLoading(true);
      setOhlcRows([]);
      try {
        const { start, end } = chartApiRange;
        const ohlcRes = await fetchJsonCached({
          path: '/api/market/ohlc-signals-indicator',
          method: 'POST',
          body: { ticker: sym, start_date: start, end_date: end },
          ttlMs: 2 * 60 * 1000
        });
        if (stale()) return;
        const rows = Array.isArray(ohlcRes.data?.data) ? ohlcRes.data.data : [];
        setOhlcRows(sortRowsAsc(rows));
        setApiTimings((prev) => ({ ...prev, chartMs: Math.round(performance.now() - chartStartedAt) }));
      } catch (e) {
        if (isAbortError(e) || stale()) return;
        setError(e.message || 'Failed to load chart');
        setOhlcRows([]);
      } finally {
        if (!stale()) setChartLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, timeframe, asOfDate, authVersion, chartApiRange.start, chartApiRange.end, symbolRefreshToken]);

  useEffect(() => {
    setNewsPage(1);
  }, [sym]);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    setCompanyOverviewExpanded(false);
    if (!COMPANY_PROFILE_DATA_KEY) {
      console.log(
        '[TickerPage] company overview key missing. Set VITE_COMPANY_PROFILE_DATA_KEY in frontend .env'
      );
      setCompanyOverview(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setCompanyOverviewBusy(true);
      try {
        const symbol = String(sym || '').toUpperCase().trim();
        const payload = await fetchCompanyOverviewOnce(symbol);
        if (stale()) return;
        setCompanyOverview(payload && typeof payload === 'object' ? payload : null);
      } catch {
        if (!stale()) setCompanyOverview(null);
      } finally {
        if (!stale()) setCompanyOverviewBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym]);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    const symbol = String(sym || '').toUpperCase().trim();
    (async () => {
      setTickerNewsBusy(true);
      setTickerNewsError('');
      try {
        const rows = await fetchTickerNews(symbol, 10);
        if (stale()) return;
        setTickerNewsItems(rows.length ? rows : FALLBACK_TICKER_NEWS);
      } catch (e) {
        if (!stale()) {
          setTickerNewsError(e?.message || 'Failed to load ticker headlines.');
          setTickerNewsItems(FALLBACK_TICKER_NEWS);
        }
      } finally {
        if (!stale()) setTickerNewsBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym]);

  const newsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(liveNews.length / NEWS_PAGE_SIZE)),
    [liveNews.length]
  );
  const newsPageSafe = Math.min(Math.max(1, newsPage), newsTotalPages);
  const newsPageItems = useMemo(() => {
    const start = (newsPageSafe - 1) * NEWS_PAGE_SIZE;
    return liveNews.slice(start, start + NEWS_PAGE_SIZE);
  }, [liveNews, newsPageSafe]);

  const myDetail = useMemo(() => {
    const u = sym.toUpperCase();
    for (const r of detailRows) {
      const s = String(r.Symbol || r.symbol || '')
        .toUpperCase()
        .trim();
      if (s === u) return r;
    }
    return null;
  }, [detailRows, sym]);

  const company =
    String(myDetail?.Security || myDetail?.security || '').trim() || `${sym} — N/A`;
  const sector = String(myDetail?.Sector || myDetail?.sector || '').trim();
  const sectorDataSlug = useMemo(() => sectorFieldToEtfSlug(sector), [sector]);
  const industry = String(myDetail?.Industry || myDetail?.industry || '').trim();
  const indexLabel = String(myDetail?.Index || myDetail?.index || '').trim() || 'US';
  const companyOverviewName = String(companyOverview?.Name || '').trim() || company;
  const companyOverviewDescription = String(companyOverview?.Description || '').trim();
  const companyOverviewAddress = String(companyOverview?.Address || '').trim();
  const companyOverviewWebsite = String(companyOverview?.OfficialSite || '').trim();
  const companyOverviewIrWebsite = alphaProfileIrlink(companyOverviewWebsite) || companyOverviewWebsite;
  const companyOverviewDividendYield = numOrNull(companyOverview?.DividendYield);
  const companyOverviewBeta = numOrNull(companyOverview?.Beta);
  const companyOverview52Low = numOrNull(companyOverview?.['52WeekLow']);
  const companyOverview52High = numOrNull(companyOverview?.['52WeekHigh']);
  const companyOverviewMarketCap = numOrNull(companyOverview?.MarketCapitalization);
  const companyOverviewPe = numOrNull(companyOverview?.PERatio ?? companyOverview?.TrailingPE);
  const companyOverviewEps = numOrNull(companyOverview?.EPS ?? companyOverview?.DilutedEPSTTM);
  const companyOverviewSector = String(companyOverview?.Sector || '').trim();
  const companyOverviewIndustry = String(companyOverview?.Industry || '').trim();
  const companyOverviewExchange = String(companyOverview?.Exchange || '').trim();
  const companyOverviewDescriptionPreview = useMemo(() => {
    if (!companyOverviewDescription) return '';
    if (companyOverviewExpanded) return companyOverviewDescription;
    if (companyOverviewDescription.length <= 145) return companyOverviewDescription;
    return `${companyOverviewDescription.slice(0, 145).trimEnd()}...`;
  }, [companyOverviewDescription, companyOverviewExpanded]);

  const competitors = useMemo(
    () =>
      pickRelatedByCategory(
        detailRows,
        sym,
        sector,
        String(
          myDetail?.SubIndustry ||
            myDetail?.subIndustry ||
            myDetail?.subindustry ||
            myDetail?.Industry ||
            myDetail?.industry ||
            ''
        ).trim(),
        10
      ),
    [detailRows, sym, sector, myDetail]
  );

  const dynamicSym = returnsSym?.performance?.dynamicPeriods ?? EMPTY_DYNAMIC_PERIODS;
  const dynamicSpy = returnsSpy?.performance?.dynamicPeriods ?? EMPTY_DYNAMIC_PERIODS;
  const annualReturnsRaw = returnsSym?.performance?.annualReturns;
  const quarterlyReturnsRaw = returnsSym?.performance?.quarterlyReturns;
  const monthlyReturnsRaw = returnsSym?.performance?.monthlyReturns;
  /** Full series for annual chart; in-card start/end year dropdowns filter the visible range. */
  const annualReturnsForChart = useMemo(
    () => (Array.isArray(annualReturnsRaw) ? annualReturnsRaw : []),
    [annualReturnsRaw]
  );
  /** Full series for quarterly chart; in-card start/end year dropdowns filter the visible range. */
  const quarterlyReturnsForChart = useMemo(
    () => (Array.isArray(quarterlyReturnsRaw) ? quarterlyReturnsRaw : []),
    [quarterlyReturnsRaw]
  );
  const tickerSelectOptions = useMemo(() => {
    const base = [sym, BENCHMARK, ...(detailRows || []).map((r) => String(r.symbol || '').toUpperCase().trim())];
    return [...new Set(base.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [sym, detailRows]);
  const tickerRsDropdownOptions = useMemo(
    () => tickerSelectOptions.map((t) => ({ id: t, label: t })),
    [tickerSelectOptions]
  );

  const sortedChart = useMemo(() => sortRowsAsc(ohlcRows), [ohlcRows]);

  const chartSplitRange = useMemo(() => {
    if (!sortedChart.length) return null;
    const from = rowDateToTimeKey(sortedChart[0]);
    const to = rowDateToTimeKey(sortedChart[sortedChart.length - 1]);
    if (!from || !to) return null;
    return { from, to };
  }, [sortedChart]);

  useEffect(() => {
    let cancelled = false;
    if (!canFetchMarketData() || !sym || !chartSplitRange) {
      setChartSplits([]);
      return undefined;
    }
    (async () => {
      try {
        const res = await fetchJsonCached({
          path:
            `/api/splits?ticker=${encodeURIComponent(sym)}` +
            `&from=${encodeURIComponent(chartSplitRange.from)}` +
            `&to=${encodeURIComponent(chartSplitRange.to)}` +
            '&limit=50',
          method: 'GET',
          ttlMs: 10 * 60 * 1000
        });
        if (cancelled) return;
        const list = Array.isArray(res?.data?.splits) ? res.data.splits : [];
        setChartSplits(list);
      } catch {
        if (!cancelled) setChartSplits([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym, chartSplitRange, authVersion]);

  const splitChartMarkers = useMemo(() => {
    if (!chartSplits.length || !sortedChart.length) return [];
    const candles = mapRowsToCandles(sortedChart);
    const raw = mapSplitsToChartMarkers(chartSplits);
    return snapMarkersToNearestCandle(raw, candles);
  }, [chartSplits, sortedChart]);

  useEffect(() => {
    const sync = () => {
      const el = chartBodyRef.current;
      const d = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
      setChartFs(!!el && (document.fullscreenElement === el || d.webkitFullscreenElement === el));
      notifyChartFullscreenLayout();
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useLayoutEffect(() => {
    if (!chartFs) {
      setFsPlotH((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const el = chartPlotHostRef.current;
    if (!el) return;
    const apply = () => {
      const h = Math.round(el.clientHeight);
      const next = Math.max(mediaHRef.current, h);
      setFsPlotH((prev) => (prev === next ? prev : next));
    };
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, [chartFs, sortedChart.length, mainChartType, chartLoading]);

  const toggleChartFullscreen = useCallback(async () => {
    const el = chartBodyRef.current;
    if (!el) return;
    const d = /** @type {Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element | null }} */ (
      document
    );
    const fsEl = d.fullscreenElement ?? d.webkitFullscreenElement;
    try {
      if (fsEl === el) {
        if (d.exitFullscreen) await d.exitFullscreen();
        else d.webkitExitFullscreen?.();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        /** @type {{ webkitRequestFullscreen?: () => void }} */
        (el).webkitRequestFullscreen?.();
      }
    } catch {
      /* ignore */
    }
    notifyChartFullscreenLayout();
  }, []);

  const buildMainChartExportFilename = useCallback(
    () => buildTickerChartExportFilename('main-chart', sym),
    [sym]
  );

  const downloadMainChartCsv = useCallback(() => {
    if (!sortedChart.length) return;
    const rangeLabel = appliedCustomRange
      ? `${appliedCustomRange.start}_${appliedCustomRange.end}`
      : String(timeframe).toLowerCase();
    const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Signal'];
    const lines = [
      headers.join(','),
      ...sortedChart.map((r) => {
        const open = pickNum(r, ['Open', 'open']);
        const high = pickNum(r, ['High', 'high']);
        const low = pickNum(r, ['Low', 'low']);
        const close = pickNum(r, ['Close', 'close']);
        const volume = pickNum(r, ['Volume', 'volume', 'VOLUME']);
        const signal = r.signal != null && r.signal !== '' ? String(r.signal) : '';
        return [
          csvEscape(rowDateToTimeKey(r)),
          csvEscape(open ?? ''),
          csvEscape(high ?? ''),
          csvEscape(low ?? ''),
          csvEscape(close ?? ''),
          csvEscape(volume ?? ''),
          csvEscape(signal)
        ].join(',');
      })
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(sym || 'ticker').toUpperCase()}-ohlc-${rangeLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedChart, sym, timeframe, appliedCustomRange]);

  const loggedIn = useIsLoggedIn();
  const { positions: paperPositions } = usePaperPositions({ enabled: loggedIn });
  const paperChartPosition = useMemo(() => {
    if (!loggedIn) return null;
    const u = String(sym || '').toUpperCase();
    const row = paperPositions.find((p) => String(p.ticker || '').toUpperCase() === u);
    if (!row || !Number(row.qty)) return null;
    return {
      qty: Number(row.qty),
      avgCost: Number(row.avg_cost),
      currentPrice: row.current_price != null ? Number(row.current_price) : null,
      unrealizedPnl: row.unrealized_pnl != null ? Number(row.unrealized_pnl) : null,
      unrealizedPnlPct: row.unrealized_pnl_pct != null ? Number(row.unrealized_pnl_pct) : null
    };
  }, [loggedIn, paperPositions, sym]);
  const downloadMainChartCsvClick = useGatedCsvDownload(downloadMainChartCsv);
  const mainChartExportDisabled = chartLoading || metaBusy || !sortedChart.length;

  const {
    exportingSnapshot: chartExportingSnapshot,
    exportModalOpen: chartExportModalOpen,
    exportModalStatus: chartExportModalStatus,
    exportPreviewUrl: chartExportPreviewUrl,
    exportFilename: chartExportFilename,
    exportModalError: chartExportModalError,
    openExportModal: openChartExportModal,
    closeExportModal: closeChartExportModal,
    downloadFromExportModal: downloadChartExport
  } = useChartSnapshotExport({
    snapshotRootRef: chartBodyRef,
    plotHostRef: chartPlotHostRef,
    fullscreenTargetRef: chartBodyRef,
    buildFilename: buildMainChartExportFilename,
    disabled: mainChartExportDisabled,
    onclone: applyTickerChartSnapshotCloneFixes
  });

  const lastRow = sortedChart.length ? sortedChart[sortedChart.length - 1] : null;
  const prevRow = sortedChart.length > 1 ? sortedChart[sortedChart.length - 2] : null;
  const firstRow = sortedChart.length ? sortedChart[0] : null;
  const lastClose = lastRow ? pickNum(lastRow, ['Close', 'close']) : null;
  const prevClose = prevRow ? pickNum(prevRow, ['Close', 'close']) : null;
  const firstClose = firstRow ? pickNum(firstRow, ['Close', 'close']) : null;
  const chartRangeChgPct = periodReturnFromRows(sortedChart, () => true);
  const chartRangeChgAbs = lastClose != null && firstClose != null ? lastClose - firstClose : null;
  const dayChg =
    lastClose != null && prevClose != null && prevClose !== 0 ? ((lastClose - prevClose) / prevClose) * 100 : null;
  const dayAbs = lastClose != null && prevClose != null ? lastClose - prevClose : null;
  const lastSignal = readRowSignal(lastRow);
  const activeBucket = toSignalBucket(lastSignal);

  const statsSorted = useMemo(() => sortRowsAsc(statsRows), [statsRows]);
  const statsSpySorted = useMemo(() => sortRowsAsc(statsRowsSpy), [statsRowsSpy]);
  const highs = statsSorted.map((r) => pickNum(r, ['High', 'high'])).filter((v) => v != null);
  const lows = statsSorted.map((r) => pickNum(r, ['Low', 'low'])).filter((v) => v != null);
  const vols = statsSorted.map((r) => pickNum(r, ['Volume', 'volume', 'VOLUME'])).filter((v) => v != null);
  const statCloses = statsSorted.map((r) => pickNum(r, ['Close', 'close'])).filter((v) => v != null);

  const hi52 = highs.length ? Math.max(...highs) : null;
  const lo52 = lows.length ? Math.min(...lows) : null;
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
  const vola = annualizedVol(statCloses);

  const lastUpdatedIso = lastRow ? rowDateToTimeKey(lastRow) : asOfDate;
  const lastUpdatedFmt =
    lastUpdatedIso && !Number.isNaN(Date.parse(lastUpdatedIso))
      ? new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York',
          timeZoneName: 'short'
        }).format(new Date(lastUpdatedIso + 'T16:00:00'))
      : '—';

  useEffect(() => {
    if (!sym) return;
    console.log('[TickerPage Odin Signal]', {
      symbol: sym,
      lastTradingDay: lastUpdatedIso || null,
      signal: lastSignal,
      bucket: activeBucket,
      chartRange: chartApiRange
    });
  }, [sym, lastUpdatedIso, lastSignal, activeBucket, chartApiRange]);

  const tailSorted = useMemo(() => sortRowsAsc(tailRows), [tailRows]);
  const tLast = tailSorted.length ? tailSorted[tailSorted.length - 1] : null;
  const tPrev = tailSorted.length > 1 ? tailSorted[tailSorted.length - 2] : null;
  const tLastClose = tLast ? pickNum(tLast, ['Close', 'close']) : null;
  const tPrevClose = tPrev ? pickNum(tPrev, ['Close', 'close']) : null;
  const useTailForHeader = tailSorted.length >= 2 && tLastClose != null && tPrevClose != null;
  const headerClose = useTailForHeader ? tLastClose : lastClose;
  const headerPrev = useTailForHeader ? tPrevClose : prevClose;
  const headerChgPct =
    headerClose != null && headerPrev != null && headerPrev !== 0
      ? ((headerClose - headerPrev) / headerPrev) * 100
      : dayChg;
  const headerChgAbs =
    headerClose != null && headerPrev != null ? headerClose - headerPrev : dayAbs;

  const symMtd = mtdFromRows(statsSorted);
  const spyMtd = mtdFromRows(statsSpySorted);
  const symQtd = qtdFromRows(statsSorted);
  const spyQtd = qtdFromRows(statsSpySorted);

  useEffect(() => {
    setRelativeTickerSymbol(sym);
  }, [sym]);

  useEffect(() => {
    const symKey = String(sym || '').toUpperCase().trim();
    const nextSym = { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
    const nextBench = { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd };
    setRelativeTickerSeriesBySymbol((prev) => {
      const curSym = prev[symKey];
      const curBench = prev[BENCHMARK];
      if (
        curSym?.dynamicPeriods === dynamicSym &&
        curSym?.mtd === symMtd &&
        curSym?.qtd === symQtd &&
        curBench?.dynamicPeriods === dynamicSpy &&
        curBench?.mtd === spyMtd &&
        curBench?.qtd === spyQtd
      ) {
        return prev;
      }
      return { ...prev, [symKey]: nextSym, [BENCHMARK]: nextBench };
    });
  }, [sym, dynamicSym, symMtd, symQtd, dynamicSpy, spyMtd, spyQtd]);

  const loadRelativeTickerSeries = useCallback(
    async (tickerInput) => {
      const ticker = String(tickerInput || '').toUpperCase().trim();
      const symU = String(sym || '').toUpperCase().trim();
      if (!ticker || !canFetchMarketData()) return null;
      if (ticker === symU && returnsSym?.performance) {
        return {
          dynamicPeriods: returnsSym.performance.dynamicPeriods || [],
          mtd: symMtd,
          qtd: symQtd
        };
      }
      const returnsDefaultEnd = toDateInput(new Date());
      const ret = await fetchJsonCached({
        path: '/api/market/ticker-core-returns',
        method: 'POST',
        body: { ticker, customStartDate: RETURNS_DEFAULT_START, customEndDate: returnsDefaultEnd },
        ttlMs: 15 * 60 * 1000
      });
      const asOf = String(ret?.data?.asOfDate || asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const asOfD = new Date(asOf + 'T12:00:00');
      const start = new Date(asOfD);
      start.setFullYear(start.getFullYear() - 1);
      const startIso = toIso(start);
      const rows = await fetchOhlcRowsCached({
        symbol: ticker,
        startDate: startIso,
        endDate: asOf,
        limit: 400
      });
      return {
        benchmarkTicker: ticker,
        dynamicPeriods: ret?.data?.performance?.dynamicPeriods || [],
        mtd: mtdFromRows(rows),
        qtd: qtdFromRows(rows)
      };
    },
    [asOfDate, sym, returnsSym, symMtd, symQtd, fetchOhlcRowsCached]
  );

  const loadRelativeIndexSeries = useCallback(
    async (indexKey) => {
      if (!canFetchMarketData()) return null;
      const opt = RELATIVE_INDEX_OPTIONS.find((x) => x.key === indexKey) || RELATIVE_INDEX_OPTIONS[0];
      const proxyTicker = opt.ticker ? String(opt.ticker).trim().toUpperCase() : '';
      if (proxyTicker) {
        const series = await loadRelativeTickerSeries(proxyTicker);
        return series ? { ...series, benchmarkTicker: proxyTicker } : null;
      }
      const idx = await fetchJsonCached({
        path: '/api/market/index-returns',
        method: 'POST',
        body: { index: opt.apiIndex },
        ttlMs: 10 * 60 * 1000
      });
      const d = idx?.data || {};
      const asOf = String(d?.asOfDate || asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const asOfD = new Date(asOf + 'T12:00:00');
      const start = new Date(asOfD);
      start.setFullYear(start.getFullYear() - 1);
      const startIso = toIso(start);
      const symForOhlc =
        (d?.officialIndexTicker && String(d.officialIndexTicker).trim()) ||
        (d?.ticker && String(d.ticker).trim()) ||
        '';
      let rows = [];
      if (symForOhlc) {
        rows = await fetchOhlcRowsCached({
          symbol: symForOhlc,
          startDate: startIso,
          endDate: asOf,
          limit: 400
        });
      } else {
        const syntheticRows = sortRowsAsc(
          closeSeriesToChartRows(Array.isArray(d?.syntheticCloseSeries) ? d.syntheticCloseSeries : [])
        );
        rows = syntheticRows.filter((r) => {
          const iso = rowDateToTimeKey(r);
          return iso && iso >= startIso && iso <= asOf;
        });
      }
      return {
        benchmarkTicker: symForOhlc || null,
        dynamicPeriods: d?.performance?.dynamicPeriods || [],
        mtd: mtdFromRows(rows),
        qtd: qtdFromRows(rows)
      };
    },
    [asOfDate, fetchOhlcRowsCached, loadRelativeTickerSeries]
  );

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) return () => {};
    const indexOpt =
      RELATIVE_INDEX_OPTIONS.find((x) => x.key === relativeIndexKey) || RELATIVE_INDEX_OPTIONS[0];
    const expectedBenchTicker = indexOpt.ticker
      ? String(indexOpt.ticker).trim().toUpperCase()
      : '';
    const cachedIndex = relativeIndexSeriesByKey[relativeIndexKey];
    const needsIndex =
      !cachedIndex ||
      (expectedBenchTicker &&
        String(cachedIndex.benchmarkTicker || '').toUpperCase() !== expectedBenchTicker);
    const tickerKey = String(relativeTickerSymbol || '').toUpperCase().trim();
    const symKey = String(sym || '').toUpperCase().trim();
    const needsTicker = !!tickerKey && !relativeTickerSeriesBySymbol[tickerKey];
    const deferTickerUntilMainReturns = tickerKey !== '' && tickerKey === symKey && !returnsSym;
    if (!needsIndex && (!needsTicker || deferTickerUntilMainReturns)) return () => {};
    (async () => {
      setRelativeCompareBusy(true);
      try {
        if (needsIndex) {
          const idxSeries = await loadRelativeIndexSeries(relativeIndexKey);
          if (!cancelled && idxSeries) {
            setRelativeIndexSeriesByKey((prev) => ({ ...prev, [relativeIndexKey]: idxSeries }));
          }
        }
        if (needsTicker && !deferTickerUntilMainReturns) {
          const tkSeries = await loadRelativeTickerSeries(tickerKey);
          if (!cancelled && tkSeries) {
            setRelativeTickerSeriesBySymbol((prev) => ({ ...prev, [tickerKey]: tkSeries }));
          }
        }
      } finally {
        if (!stale()) setRelativeCompareBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    relativeIndexKey,
    relativeTickerSymbol,
    relativeIndexSeriesByKey,
    relativeTickerSeriesBySymbol,
    loadRelativeIndexSeries,
    loadRelativeTickerSeries,
    sym,
    returnsSym
  ]);

  const selectedIndexSeries = relativeIndexSeriesByKey[relativeIndexKey] || { dynamicPeriods: [], mtd: null, qtd: null };
  const selectedTickerKey = String(relativeTickerSymbol || '').toUpperCase().trim();
  const selectedTickerSeries =
    relativeTickerSeriesBySymbol[selectedTickerKey] || { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
  const selectedIndexLabel =
    RELATIVE_INDEX_OPTIONS.find((x) => x.key === relativeIndexKey)?.label || RELATIVE_INDEX_OPTIONS[0].label;
  const onOpenRelativeStrengthPage = useCallback(() => {
    navigate(buildRelativeStrengthTickerHref(relativeTickerSymbol || sym));
  }, [navigate, relativeTickerSymbol, sym]);

  const onOpenNewsPage = useCallback(() => {
    navigate(`/news?ticker=${encodeURIComponent(sym)}`);
  }, [navigate, sym]);

  const relativePerfCompareRows = useMemo(() => {
    return COMPARE_ROWS.map((row) => {
      const benchPct = row.period
        ? pickDynamic(selectedIndexSeries.dynamicPeriods, row.period)
        : row.mtd
          ? selectedIndexSeries.mtd
          : row.qtd
            ? selectedIndexSeries.qtd
            : null;
      const tickPct = row.period
        ? pickDynamic(selectedTickerSeries.dynamicPeriods, row.period)
        : row.mtd
          ? selectedTickerSeries.mtd
          : row.qtd
            ? selectedTickerSeries.qtd
            : null;
      const diff =
        benchPct != null && tickPct != null && Number.isFinite(benchPct) && Number.isFinite(tickPct)
          ? tickPct - benchPct
          : null;
      return { key: row.key, benchPct, tickPct, diff };
    });
  }, [selectedIndexSeries, selectedTickerSeries]);

  const section16Rows = useMemo(() => {
    const compactKeys = ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD'];
    return relativePerfCompareRows
      .filter((r) => compactKeys.includes(r.key))
      .map((r) => ({
        label: r.key,
        value: r.diff,
        symPct: r.benchPct,
        tkPct: r.tickPct,
        diff: r.diff
      }));
  }, [relativePerfCompareRows]);

  const section17CompareRows = useMemo(() => {
    const compactKeys = ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD'];
    return relativePerfCompareRows
      .filter((r) => compactKeys.includes(r.key))
      .map((r) => ({ label: r.key, symPct: r.benchPct, spyPct: r.tickPct, diff: r.diff }));
  }, [relativePerfCompareRows]);

  const chartHeightMin = mediaChartHeight;
  const basePixelHeight = mainChartResize.plotHeight ?? chartHeightMin;
  const plotHeight = chartFs && fsPlotH >= chartHeightMin ? fsPlotH : basePixelHeight;

  const chartRangeLabel = chartApiRange.start + ' → ' + chartApiRange.end;
  const chartModeHelp = appliedCustomRange
    ? 'Using your custom start/end (overrides the pill timeframe until you reset).'
    : `Using pill timeframe “${timeframe}”, anchored to as-of ${asOfDate}.`;

  return (
    <div className="ticker-page">


      {error ? (
        <div className="ticker-page__error" role="alert">
          {error}
        </div>
      ) : null}
      {/* {tickerReturnsDebug ? (
        <div className="ticker-page__error" role="status" style={{ marginTop: 8, marginBottom: 8 }}>
          ticker-returns debug: source={tickerReturnsDebug.source || '—'} | cache_hit={tickerReturnsDebug.cacheHit || '—'} | compute_ms=
          {tickerReturnsDebug.computeMs || '—'} | mode={tickerReturnsDebug.mode || '—'} | symbol={tickerReturnsDebug.symbol || '—'}
        </div>
      ) : null} */}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="ticker-page__header-top">
          <div className="ticker-page__header-identity">
            <h1 className="ticker-page__company ticker-page__company--hero">{company}</h1>
            <span className="ticker-page__header-identity-meta">
              <IconFlagUs className="ticker-page__flag" />
              <span className="ticker-page__exchange">{indexLabel || '—'}</span>
            </span>
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerHeaderPrice} align="start" />
          </div>
          <div className="ticker-page__header-actions">
            <button type="button" className="ticker-outline-btn" onClick={onAddTickerToWatchlist}>
              <IconPlus className="ticker-outline-btn__ico" /> In My Watchlists
            </button>
          </div>
        </div>

        <div className="ticker-page__header-metrics ticker-page__header-metrics--ticker-head" role="presentation">
          <div className="ticker-page__header-metric ticker-page__header-metric--primary">
            <div className="ticker-page__metric-price-line">
              <span className="ticker-page__sym">{sym}</span>
              <span className="ticker-page__px ticker-page__px--hero">{fmtPrice(headerClose)}</span>
              <span className="ticker-page__ccy">USD</span>
            </div>
            <div className="ticker-page__metric-footer">
              <div className="ticker-page__metric-change">
                {headerChgPct != null && Number.isFinite(headerChgPct) ? (
                  <span className={'ticker-num ' + pctClass(headerChgPct)}>
                    {headerChgAbs != null && Number.isFinite(headerChgAbs) ? (
                      <>
                        {fmtAbsSigned(headerChgAbs)}{' '}
                      </>
                    ) : null}
                    ({fmtPctSigned(headerChgPct)})
                  </span>
                ) : (
                  <span className="ticker-page__metric-change--muted">—</span>
                )}
              </div>
              <p className="ticker-page__metric-label ticker-page__metric-label--last-updated">
                Last Updated • {lastUpdatedFmt}
              </p>
            </div>
          </div>


          <div className="ticker-page__header-metric">
            <div className="ticker-page__metric-value-row">
              <span className="ticker-page__metric-value">Sector</span>
            </div>
            {sectorDataSlug ? (
              <Link
                to={`/sector-data/${encodeURIComponent(sectorDataSlug)}`}
                className="ticker-page__metric-label ticker-page__metric-label--link"
              >
                {sector}
              </Link>
            ) : (
              <p className="ticker-page__metric-label">{sector || '—'}</p>
            )}
          </div>

          <div className="ticker-page__header-metric">
            <p className="ticker-page__metric-value ticker-page__metric-value--multiline">Industry</p>
            <p className="ticker-page__metric-label">{industry || '—'}</p>
          </div>

      
        </div>
      </header>

      {splitSummary?.is_upcoming && splitSummary?.upcoming ? (
        <TickerSplitBanner
          ticker={sym}
          split={splitSummary.upcoming}
          variant="upcoming"
          daysUntilSplit={splitSummary.days_until_split}
        />
      ) : null}
      {splitSummary?.is_recent && splitSummary?.latest_past ? (
        <TickerSplitBanner
          ticker={sym}
          split={splitSummary.latest_past}
          variant="past"
          daysSinceSplit={splitSummary.days_since_split}
          adjCloseValidation={splitSummary.adj_close_validation}
        />
      ) : null}

      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <div className="ticker-page__stack-column">
          <section className="ticker-card ticker-card--main-chart" aria-labelledby="snapshot-chart-title">
            {/* <div className="ticker-chart-toolbar">
              <ChartTypeToolbarDropdown chartType={mainChartType} onChartTypeChange={setMainChartType} /> 
            </div> */}

            <div className="ticker-card__head">
              
              <div className="ticker-page__search-row">
                <div className="ticker-page__search-row-controls">
                  <TickerSymbolCombobox symbol={sym} onSymbolChange={onSymbolChange} inputId="ticker-chart-symbol" />
                  <ChartTypeToolbarDropdown chartType={mainChartType} onChartTypeChange={setMainChartType} />
                </div>

                {/* <DataInfoTip align="start">
                  <p className="ticker-data-tip__p">
                    <strong>Ticker selection</strong> drives every request on this page for one symbol.
                  </p>
                  <p className="ticker-data-tip__p">
                    Search uses <code className="ticker-data-tip__code">GET /api/tickers/search</code> (Supabase{' '}
                    <code className="ticker-data-tip__code">tickers</code>). Picking a symbol reloads chart, returns, OHLC
                    tail, and index metadata for that symbol.
                  </p>
                </DataInfoTip> */}
                {chartLoading ? <span className="ticker-page__loading-pill">Loading chart…</span> : null}
                {metaBusy && !chartLoading ? <span className="ticker-page__loading-pill">Loading data…</span> : null}
                <div className="ticker-page__search-row-actions">
                  <ReturnsChartToolbar
                    showViewMore={false}
                    showTableToggle={false}
                    showDownload={false}
                    extraActions={
                      <>
                        <ReturnsChartToolbarIconButton
                          label={loggedIn ? 'Download CSV' : 'Download CSV'}
                          onClick={downloadMainChartCsvClick}
                          disabled={mainChartExportDisabled}
                        >
                          <ReturnsChartIcoDownload />
                        </ReturnsChartToolbarIconButton>
                        <ReturnsChartToolbarIconButton
                          label={chartExportingSnapshot ? 'Exporting chart' : 'Export chart snapshot'}
                          onClick={openChartExportModal}
                          disabled={mainChartExportDisabled || chartExportingSnapshot}
                        >
                          <Upload size={14} strokeWidth={2} aria-hidden />
                        </ReturnsChartToolbarIconButton>
                        <ReturnsChartToolbarIconButton
                          label={chartFs ? 'Exit fullscreen' : 'Fullscreen'}
                          onClick={() => toggleChartFullscreen()}
                          active={chartFs}
                        >
                          <ChartFullscreenToggleIcon isFullscreen={chartFs} />
                        </ReturnsChartToolbarIconButton>
                      </>
                    }
                  />
                </div>
              </div>
              <div className="ticker-tf-with-tip min-w-0 w-full max-w-full">
                <div className="ticker-tf-row" role="tablist" aria-label="Chart timeframe">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      role="tab"
                      aria-selected={!appliedCustomRange && tf === timeframe}
                      className={
                        'ticker-tf' +
                        (!appliedCustomRange && tf === timeframe ? ' ticker-tf--active' : '')
                      }
                      onClick={() => {
                        setAppliedCustomRange(null);
                        setIsCustomRangePopupOpen(false);
                        setTimeframe(tf);
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={Boolean(appliedCustomRange || isCustomRangePopupOpen)}
                    className={
                      'ticker-tf ticker-tf--calendar' +
                      (appliedCustomRange || isCustomRangePopupOpen ? ' ticker-tf--active' : '')
                    }
                    onClick={() => {
                      if (appliedCustomRange) {
                        setDraftChartStart(appliedCustomRange.start);
                        setDraftChartEnd(appliedCustomRange.end);
                      } else {
                        const r = rangeForTimeframe(timeframe, asOfDate, ohlcTickerBounds);
                        setDraftChartStart(r.start);
                        setDraftChartEnd(r.end);
                      }
                      setIsCustomRangePopupOpen(true);
                    }}
                    aria-label="Open custom date range"
                    title="Custom date range"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
                      <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17" />
                    </svg>
                  </button>
                </div>
                
              </div>
              {isCustomRangePopupOpen ? (
                <div className="wl-manage-overlay ticker-custom-range-popup__overlay" onClick={() => setIsCustomRangePopupOpen(false)}>
                  <div
                    className="wl-manage-modal ticker-custom-range-popup"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ticker-custom-range-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="wl-manage-modal__head">
                      <h3 id="ticker-custom-range-title" className="wl-manage-modal__title">
                        Custom range
                      </h3>
                      <button
                        type="button"
                        className="wl-manage-modal__close"
                        onClick={() => setIsCustomRangePopupOpen(false)}
                        aria-label="Close custom range"
                      >
                        <ModalCloseIcon className="wl-manage-modal__close-icon" />
                      </button>
                    </div>
                    <div className="wl-manage-modal__body ticker-custom-range-popup__body">
                      <div className="ticker-custom-range-popup__field-row">
                        <span className="ticker-page__label ticker-page__label--inline">Start date</span>
                        <input
                          type="date"
                          className="ticker-page__date-inp ticker-custom-range-popup__date"
                          value={draftChartStart}
                          onChange={(e) => onCustomRangeDateChange(e.target.value, draftChartEnd)}
                          min={customRangeBounds.startMin}
                          max={customRangeBounds.startMax}
                        />
                      </div>
                      <div className="ticker-custom-range-popup__field-row">
                        <span className="ticker-page__label ticker-page__label--inline">End date</span>
                        <input
                          type="date"
                          className="ticker-page__date-inp ticker-custom-range-popup__date"
                          value={draftChartEnd}
                          onChange={(e) => onCustomRangeDateChange(draftChartStart, e.target.value)}
                          min={customRangeBounds.endMin}
                          max={customRangeBounds.endMax}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div
              ref={chartBodyRef}
              className="ticker-chart-body ticker-chart-body--main"
              style={
                chartFs
                  ? undefined
                  : {
                      '--ticker-main-plot-h': `${basePixelHeight}px`,
                      '--ticker-main-plot-min-h': `${chartHeightMin}px`
                    }
              }
            >
              
              <div className="ticker-chart-legend">
              <div className="new-one">
                <div className="ticker-chart-legend__quote-pills">
                  <span className="ticker-chart-legend__sym">{sym}</span>
                  <span className="ticker-chart-legend__name">{company}</span>
                  <span className="ticker-chart-legend__price">{fmtPrice(lastClose)} USD</span>
                  {chartRangeChgAbs != null && Number.isFinite(chartRangeChgAbs) ? (
                    <span className={'ticker-chart-legend__chg ' + pctClass(chartRangeChgAbs)}>
                      {fmtAbsSigned(chartRangeChgAbs)}
                    </span>
                  ) : null}
                  {chartRangeChgPct != null && Number.isFinite(chartRangeChgPct) ? (
                    <span className={'ticker-chart-legend__chg ' + pctClass(chartRangeChgPct)}>{fmtPctSigned(chartRangeChgPct)}</span>
                  ) : null}
                </div>
                
              </div>
              {chartHoverOhlc ? (
                  <span className="ticker-chart-legend__sigs">
                    O:{chartHoverOhlc.open != null ? fmtPrice(chartHoverOhlc.open) : '—'}   H:{chartHoverOhlc.high != null ? fmtPrice(chartHoverOhlc.high) : '—'}   L:{chartHoverOhlc.low != null ? fmtPrice(chartHoverOhlc.low) : '—'}   C:{chartHoverOhlc.close != null ? fmtPrice(chartHoverOhlc.close) : '—'}
                  </span>
                ) : null}
              </div>
              <div
                ref={chartPlotHostRef}
                className={'ticker-chart-plot-host' + (chartFs ? ' ticker-chart-plot-host--fs' : '')}
              >
                {chartLoading && sortedChart.length === 0 ? (
                  <div
                    className="chart-viz-loading-wrap"
                    style={{
                      minHeight: chartFs && fsPlotH >= chartHeightMin ? fsPlotH : basePixelHeight
                    }}
                  >
                    <TradingChartLoader label="Loading chart…" sublabel={`${sym} · OHLC & signals`} />
                  </div>
                ) : sortedChart.length ? (
                  <TickerLightweightChart
                    rows={sortedChart}
                    height={plotHeight}
                    chartType={mainChartType}
                    onHoverOhlcChange={setChartHoverOhlc}
                    paperPosition={paperChartPosition}
                    markers={splitChartMarkers}
                  />
                ) : (
                  <div className="ticker-sparkline ticker-sparkline--empty">No OHLC rows in this range.</div>
                )}
              </div>
              {!chartFs && mainChartResize.enabled ? (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-valuemin={mainChartResize.ariaMin}
                  aria-valuemax={mainChartResize.ariaMax}
                  aria-valuenow={mainChartResize.ariaNow}
                  className="ticker-chart-resize ticker-chart-resize--scope"
                  title="Drag to resize chart height. Double-click to reset."
                  onPointerDown={mainChartResize.onPointerDown}
                  onDoubleClick={mainChartResize.onDoubleClick}
                />
              ) : null}
            </div>
          </section>

          <section className="mkt-mini-card ticker-aside-mini ticker-signal-card-mobile-only" aria-labelledby="odin-signal-h-mobile">
            <header className="mkt-mini-card__head">
              <h2 className="mkt-mini-card__k uppercase" id="odin-signal-h-mobile">
                Indicative Signal
              </h2>
              <span className="mkt-mini-card__head-actions">
                <ChartInfoTip tip={CHART_INFO_TIPS.tickerSignalLadder} align="start" />
              </span>
            </header>
            <TickerSignalLadder
              activeBucket={activeBucket}
              lastSignal={lastSignal}
              lastUpdatedFmt={lastUpdatedFmt}
              loading={chartLoading}
              hasChartData={sortedChart.length > 0}
            />
          </section>

          <section className="ticker-card ticker-card--news" aria-labelledby="ticker-news-h">
            <div className="ticker-subh-with-tip ticker-subh-with-tip--in-card ticker-rs-selector-head">
              <div className="ticker-rs-selector-head__left">
                <div className="flex shrink-0 align-centers">
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden className="ticker-news-head__ico">
                    <path d="M0 0h24v24H0z" fill="none" />
                    <path
                      fill="currentColor"
                      d="M5.616 20q-.691 0-1.153-.462T4 18.384V5.616q0-.691.463-1.153T5.616 4h9.961L20 8.423v9.962q0 .69-.462 1.153T18.384 20zm0-1h12.769q.269 0 .442-.173t.173-.442V9h-4V5H5.616q-.27 0-.443.173T5 5.616v12.769q0 .269.173.442t.443.173M7.5 16h9v-1h-9zm0-7H12V8H7.5zm0 3.5h9v-1h-9zM5 5v4zv14z"
                    />
                  </svg>
                </div>
                <div className="ticker-subh-left">
                  <ReturnsChartClickableHeading
                    id="ticker-news-h"
                    className="ticker-subh ticker-subh--flex"
                    onClick={onOpenNewsPage}
                  >
                    News
                  </ReturnsChartClickableHeading>
                  <ChartInfoTip tip={CHART_INFO_TIPS.tickerNews} align="start" />
                </div>
              </div>
            </div>
            {tickerNewsBusy ? <p className="ticker-page__news-sample-note">Loading ticker news…</p> : null}
            {!tickerNewsBusy && tickerNewsError ? <p className="ticker-page__news-sample-note">{tickerNewsError}</p> : null}
            {!tickerNewsBusy && !tickerNewsError && !liveNews.length ? (
              <p className="ticker-page__news-sample-note">No ticker headlines yet.</p>
            ) : null}
            <ul className="ticker-news-list">
              {newsPageItems.map((n) => (
                <li key={n.id} className="ticker-news-list__li">
                  <a
                    className="ticker-news-list__a"
                    href={n.url || '#ticker-news-h'}
                    onClick={(e) => {
                      if (!n.url) e.preventDefault();
                    }}
                    target={n.url ? '_blank' : undefined}
                    rel={n.url ? 'noopener noreferrer' : undefined}
                  >
                    {n.title}
                  </a>
                  <span className="ticker-news-list__meta">
                    {n.source}
                    <br />
                    {n.time}
                  </span>
                </li>
              ))}
            </ul>
            {liveNews.length > NEWS_PAGE_SIZE ? (
              <FigmaPagination
                page={newsPageSafe}
                totalPages={newsTotalPages}
                onPageChange={setNewsPage}
                ariaLabel="News pagination"
              />
            ) : null}
          </section>
          </div>

          <aside className="ticker-page__aside ticker-page__aside-stack">
          <section className="mkt-mini-card ticker-aside-mini ticker-signal-card-desktop-only" aria-labelledby="odin-signal-h">
            <header className="mkt-mini-card__head">
              <h2 className="mkt-mini-card__k uppercase" id="odin-signal-h">
                Indicative Signal
              </h2>
              <span className="mkt-mini-card__head-actions">
                <ChartInfoTip tip={CHART_INFO_TIPS.tickerSignalLadder} align="start" />
              </span>
            </header>
            <TickerSignalLadder
              activeBucket={activeBucket}
              lastSignal={lastSignal}
              lastUpdatedFmt={lastUpdatedFmt}
              loading={chartLoading}
              hasChartData={sortedChart.length > 0}
            />
              {/* <div className="ticker-signal-foot">
                <Link to="/odin-signals" className="ticker-signal-foot__link">
                  Learn more about Odin Signals
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <g clip-path="url(#clip0_609_26680)">
                    <path d="M4.71094 7.18266L11.2734 0.726562" stroke="#CDE4FD" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M11.2734 4.41609V0.726562H7.52344" stroke="#CDE4FD" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6.05859 3.07031H1.13672C1.02794 3.07031 0.923614 3.11353 0.846694 3.19044C0.769775 3.26736 0.726562 3.37169 0.726562 3.48047V10.8633C0.726563 10.9721 0.769775 11.0764 0.846694 11.1533C0.923614 11.2302 1.02794 11.2734 1.13672 11.2734H8.51953C8.62831 11.2734 8.73264 11.2302 8.80956 11.1533C8.88647 11.0764 8.92969 10.9721 8.92969 10.8633V5.94141" stroke="#CDE4FD" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round"/>
                    </g>
                    <defs>
                    <clipPath id="clip0_609_26680">
                    <rect width="12" height="12" fill="white"/>
                    </clipPath>
                    </defs>
                  </svg>
                </Link>
              </div> */}
          </section>

          <section className="mkt-mini-card ticker-aside-mini" aria-labelledby="key-data-h">
            <header className="mkt-mini-card__head">
              <h2 className="mkt-mini-card__k uppercase" id="key-data-h">
                Key data &amp; performance
              </h2>
              <span className="mkt-mini-card__head-actions">
                <ChartInfoTip tip={CHART_INFO_TIPS.tickerKeyData} align="start" />
              </span>
            </header>
            <div className="ticker-aside-mini__body">
              <div className="ticker-kd-grid">
                <dl className="ticker-kd-dl">
                  <div className="ticker-kd-row">
                    <dt>Dividend yield</dt>
                    <dd>
                      {companyOverviewDividendYield != null
                        ? fmtPctSigned(companyOverviewDividendYield * 100).replace('+', '')
                        : '—'}
                    </dd>
                  </div>
                  <div className="ticker-kd-row">
                    <dt>52-week range</dt>
                    <dd>
                      {companyOverview52Low != null && companyOverview52High != null
                        ? `${fmtPrice(companyOverview52Low)} – ${fmtPrice(companyOverview52High)}`
                        : hi52 != null && lo52 != null
                          ? `${fmtPrice(lo52)} – ${fmtPrice(hi52)}`
                          : '—'}
                    </dd>
                  </div>
                  <div className="ticker-kd-row">
                    <dt>Beta</dt>
                    <dd>{companyOverviewBeta != null ? companyOverviewBeta.toFixed(2) : '—'}</dd>
                  </div>
                  <div className="ticker-kd-row">
                    <dt>Volatility (ann.)</dt>
                    <dd>{vola != null ? `${vola}%` : '—'}</dd>
                  </div>
                </dl>
                <dl className="ticker-kd-dl">
                  <div className="ticker-kd-row">
                    <dt>Avg volume (1y)</dt>
                    <dd>{fmtVolumeCompact(avgVol)}</dd>
                  </div>
                  <div className="ticker-kd-row">
                    <dt>Market cap</dt>
                    <dd>{companyOverviewMarketCap != null ? fmtCompact(companyOverviewMarketCap) : '—'}</dd>
                  </div>
                  <div className="ticker-kd-row">
                    <dt>P/E (TTM)</dt>
                    <dd>{companyOverviewPe != null ? companyOverviewPe.toFixed(2) : '—'}</dd>
                  </div>
                  <div className="ticker-kd-row">
                    <dt>EPS (TTM)</dt>
                    <dd>{companyOverviewEps != null ? companyOverviewEps.toFixed(2) : '—'}</dd>
                  </div>
                </dl>
              </div>
              <p className="ticker-page__label ticker-kd-comp-label">
                <span>INDICES</span>
                <span className="ticker-kd-comp-label__links">
                  {RELATED_INDEX_LINKS.map((idx) => (
                    <Link key={idx.slug} to={`/indices/${idx.slug}`} className="ticker-kd-comp__a">
                      {idx.label}
                    </Link>
                  ))}
                </span>
              </p>

              <p className="ticker-page__label ticker-kd-comp-label">
                <span>RELATED TICKERS</span>
                <span className="ticker-kd-comp-label__links">
                  {competitors.length ? (
                    competitors.map((t) => (
                      <Link key={t} to={`/ticker/${encodeURIComponent(t)}`} className="ticker-kd-comp__a">
                        {t}
                      </Link>
                    ))
                  ) : (
                    <span className="ticker-page__muted">—</span>
                  )}
                </span>
              </p>
            </div>
          </section>

          <section className="mkt-mini-card ticker-aside-mini" aria-labelledby="ticker-rel-perf-h">
            <header className="mkt-mini-card__head">
              <span className="mkt-mini-card__k uppercase" id="ticker-rel-perf-h">
                Relative performance (%)
              </span>
              <span className="mkt-mini-card__head-actions">
                <ChartInfoTip tip={CHART_INFO_TIPS.tickerRelativeStrength} align="start" />
              </span>
            </header>
            <div className="ticker-aside-mini__body">
              <div className="ticker-compare">
                <div className="ticker-compare__head">
                  <span />
                  <span>{selectedTickerKey || relativeTickerSymbol}</span>
                  <span>{selectedIndexLabel}</span>
                  <span>Diff</span>
                </div>
                {relativePerfCompareRows.map((row) => (
                    <div key={row.key} className="ticker-compare__row">
                      <span className="ticker-compare__tf">{row.key}</span>
                      <span className={'ticker-compare__cell ' + pctClass(row.tickPct)}>{formatRelativePerfPct(row.tickPct)}</span>
                      <span className={'ticker-compare__cell ' + pctClass(row.benchPct)}>{formatRelativePerfPct(row.benchPct)}</span>
                      <span className={'ticker-compare__cell ' + pctClass(row.diff)}>{formatRelativePerfPct(row.diff)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </section>

          <section className="mkt-mini-card ticker-aside-mini ticker-company-overview" aria-labelledby="ticker-company-overview-h">
            <header className="mkt-mini-card__head ticker-company-overview__head">
              <span className="ticker-company-overview__title-wrap">
                <svg
                  className="ticker-company-overview__title-ico"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path d="M4 5.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 5.5v7A1.5 1.5 0 0 1 12.5 14h-7A1.5 1.5 0 0 1 4 12.5z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6.5 7.5h5M6.5 10h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="15.75" cy="15.75" r="3.25" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m18.2 18.2 2.3 2.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <h2 className="mkt-mini-card__k" id="ticker-company-overview-h">
                  Company overview
                </h2>
              </span>
            </header>
            <div className="ticker-aside-mini__body ticker-company-overview__body">
              {companyOverviewBusy ? (
                <p className="ticker-page__muted">Loading company profile…</p>
              ) : null}
              {!companyOverviewBusy ? (
                <>
                  <p className="ticker-company-overview__desc">
                    {companyOverviewDescriptionPreview ||
                      `${companyOverviewName} profile details are not available for this symbol yet.`}
                  </p>
                  {companyOverviewDescription ? (
                    <button
                      type="button"
                      className="ticker-company-overview__toggle"
                      onClick={() => setCompanyOverviewExpanded((v) => !v)}
                    >
                      {companyOverviewExpanded ? 'Show less' : 'Show more'}
                      <span aria-hidden className={'ticker-company-overview__toggle-caret' + (companyOverviewExpanded ? ' is-open' : '')}>
                        ▾
                      </span>
                    </button>
                  ) : null}
                  <div className="ticker-company-overview__grid">
                    <article className="ticker-company-overview__metric">
                      <p className="ticker-company-overview__metric-k">Sector</p>
                      <p className="ticker-company-overview__metric-v">
                        {companyOverviewSector || '—'}
                      </p>
                    </article>
                    <article className="ticker-company-overview__metric">
                      <p className="ticker-company-overview__metric-k">Industry</p>
                      <p className="ticker-company-overview__metric-v">
                        {companyOverviewIndustry || '—'}
                      </p>
                    </article>
                    <article className="ticker-company-overview__metric">
                      <p className="ticker-company-overview__metric-k">Headquarters</p>
                      <p className="ticker-company-overview__metric-v">{companyOverviewAddress || '—'}</p>
                    </article>
                    <article className="ticker-company-overview__metric">
                      <p className="ticker-company-overview__metric-k">Exchange</p>
                      <p className="ticker-company-overview__metric-v">{companyOverviewExchange || '—'}</p>
                    </article>
                    <article className="ticker-company-overview__metric">
                      <p className="ticker-company-overview__metric-k">Website</p>
                      {companyOverviewWebsite ? (
                        <a className="ticker-company-overview__metric-link" href={companyOverviewWebsite} target="_blank" rel="noopener noreferrer">
                          {companyOverviewWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <span aria-hidden>↗</span>
                        </a>
                      ) : (
                        <p className="ticker-company-overview__metric-v">—</p>
                      )}
                    </article>
                    <article className="ticker-company-overview__metric">
                      <p className="ticker-company-overview__metric-k">IR Website</p>
                      {companyOverviewIrWebsite ? (
                        <a className="ticker-company-overview__metric-link" href={companyOverviewIrWebsite} target="_blank" rel="noopener noreferrer">
                          {companyOverviewIrWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <span aria-hidden>↗</span>
                        </a>
                      ) : (
                        <p className="ticker-company-overview__metric-v">—</p>
                      )}
                    </article>
                  </div>
                </>
              ) : null}
            </div>
          </section>
          </aside>

          <TickerAnnualReturnsFigma
            symbol={sym}
            annualReturns={annualReturnsForChart}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_ANNUAL_FIGMA}
            resizeDefaultHeight={260}
            persistPlotResize={false}
            hideStatsSection
            enableInlineYearDropdowns
            defaultStartYear={2017}
            defaultEndYear={2026}
            loading={metaBusy}
          />
          <TickerAnnualReturnsFigma
            symbol={sym}
            annualReturns={quarterlyReturnsForChart}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_QUARTERLY_FIGMA}
            resizeDefaultHeight={260}
            persistPlotResize={false}
            periodMode="quarterly"
            hideStatsSection
            enableInlineYearDropdowns
            defaultStartYear={2023}
            defaultEndYear={2026}
            loading={metaBusy}
          />
          <TickerMonthlyReturnsChart
            symbol={sym}
            monthlyReturns={monthlyReturnsRaw}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_MONTHLY}
            resizeDefaultHeight={278}
            persistPlotResize={false}
            suppressChartDateFilter
            useThemedYearDropdown
            defaultToLatestYear
            loading={metaBusy}
          />
          {/* <TickerChartResizeScope storageKey={RESIZE_KEY_MONTHLY_ADV} defaultHeight={300}>
            <TickerMonthlyReturnsWaterfallDonut
              key={sym}
              symbol={sym}
              monthlyReturns={monthlyReturnsRaw}
              asOfDate={asOfDate}
            />
          </TickerChartResizeScope> */}
          
          <section className="ticker-card ticker-card--rs-benchmark" aria-labelledby="ticker-rs-selector-h">
            <div className="ticker-subh-with-tip ticker-subh-with-tip--in-card ticker-rs-selector-head">
              <div className="ticker-rs-selector-head__left">
                <div className="flex shrink-0 align-centers">
                  <ReturnsChartPieIcon />
                </div>
                <div className="ticker-subh-left">
                  <ReturnsChartClickableHeading
                    id="ticker-rs-selector-h"
                    className="ticker-subh ticker-subh--flex"
                    onClick={onOpenRelativeStrengthPage}
                  >
                    Relative Strength
                  </ReturnsChartClickableHeading>
                  <ChartInfoTip tip={CHART_INFO_TIPS.tickerRelativeStrengthPanel} align="start" />
                </div>
              </div>
              <div className="ticker-rs-selector-head__right">
                
                  <div className="ticker-rs-controls ticker-rs-controls--in-filters-panel">
                    {/* <ThemedDropdown
                      value={relativeTickerSymbol}
                      options={tickerRsDropdownOptions}
                      onChange={setRelativeTickerSymbol}
                      title="Compare ticker"
                      ariaLabelPrefix="Ticker"
                      labelFallback={relativeTickerSymbol}
                    /> */}
                    <ThemedDropdown
                      value={relativeIndexKey}
                      options={RELATIVE_INDEX_DROPDOWN_OPTIONS}
                      onChange={setRelativeIndexKey}
                      title="Benchmark index"
                      ariaLabelPrefix="Index"
                      labelFallback={RELATIVE_INDEX_OPTIONS.find((o) => o.key === relativeIndexKey)?.label ?? ''}
                    />
                    
                  </div>
                
              </div>
            </div>
          {/* <TickerSection16Section17
            rows={section16Rows}
            compareRows={section17CompareRows}
            relativeStrengthTitle={`Relative Strength vs ${selectedTickerKey || relativeTickerSymbol}`}
            relativeStrengthHeader={`Relative Strength (${selectedIndexLabel} - ${selectedTickerKey || relativeTickerSymbol})`}
          /> */}
          <TickerSection23Section24
            pageSymbol={sym}
            prefetchedLongTickerReturns={longRangeTickerReturns}
            prefetchedLongBenchReturns={longRangeBenchReturns}
            prefetchedLongBenchSymbol={benchForLongTable}
            prefetchedLongBusy={longRangeBusy}
            onSectionBenchmarkSymbolChange={onSectionBenchmarkSymbolChange}
            initialSp500Rows={detailRows}
          />
          </section>
        </div>
      </div>
      <ChartSnapshotExportModal
        open={chartExportModalOpen}
        status={chartExportModalStatus}
        error={chartExportModalError}
        previewUrl={chartExportPreviewUrl}
        onClose={closeChartExportModal}
        onDownload={downloadChartExport}
        title="Export chart"
        previewAlt={`Exported chart for ${sym}`}
        shareLabel={`${sym} chart`}
        exportFilename={chartExportFilename}
      />
    </div>
  );
}
