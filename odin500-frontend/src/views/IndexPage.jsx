'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { dedupeTickerDetailRows } from '../utils/dedupeTickerRows.js';
import { Upload } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from '@/navigation/appRouterCompat.jsx';
import { ChartInfoTip } from '../components/ChartInfoTip.jsx';
import {
  CHART_INFO_TIPS,
  getIndexConstituentsTip
} from '../components/chartInfoTips.js';
import { FigmaPagination as NewsSectionPagination } from '../components/FigmaPagination.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerMonthlyReturnsChart } from '../components/TickerMonthlyReturnsChart.jsx';
import { TickerSection16Section17 } from '../components/TickerSection16Section17.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { ReturnsChartToolbar, ReturnsChartToolbarIconButton } from '../components/ReturnsChartToolbar.jsx';
import { ReturnsChartIcoDownload } from '../components/returnsChartToolbarIcons.jsx';
import { ReturnsChartClickableHeading } from '../components/ReturnsChartClickableTitle.jsx';
import { ReturnsChartPieIcon } from '../components/returnsChartToolbarIcons.jsx';
import { buildRelativeStrengthTickerHref } from '../utils/relativeStrengthNavigation.js';
import { useGatedCsvDownload } from '../hooks/useGatedCsvDownload.js';
import { useMediaChartHeight } from '../hooks/useMediaChartHeight.js';
import { useIsLoggedIn } from '../hooks/useIsLoggedIn.js';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';
import TradingChartLoader from '../components/TradingChartLoader.jsx';
import {
  IconChartTypeDropdown,
  TICKER_CHART_TYPE_OPTIONS,
  TickerLightweightChart
} from '../components/TickerLightweightChart.jsx';
import { useWatchlistDock } from '../context/WatchlistDockContext.jsx';
import { useGeneralNewsFeed } from '../hooks/useGeneralNewsFeed.js';
import {fetchJsonCached, getAuthToken, canFetchMarketData} from '../store/apiStore.js';
import { fetchTickerDetailsQuery } from '../query/marketQueries.js';
import {
  getRouteNavigationEpoch,
  isAbortError,
  isRouteNavigationStale,
  yieldToMain
} from '../navigation/routeNavigationAbort.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { ModalCloseIcon } from '../components/ModalCloseIcon.jsx';
import { notifyChartFullscreenLayout } from '../utils/chartFullscreenLayout.js';
import { formatRelativePerfPct } from '../utils/marketCalculations.js';
import { fmtAbsSigned, fmtNumber, fmtPctSigned, fmtPrice, fmtVolumeCompact } from '../utils/formatDisplayNumber.js';
import { DEFAULT_INDEX_ROUTE_SLUG } from '../utils/tickerUrlSync.js';
import { MARKET_SERIES } from '../components/marketSeriesRegistry.js';
import { rowMatchesSectorEtf } from '../utils/sectorEtfMatch.js';
import { ChartFullscreenToggleIcon } from '../components/ChartFullscreenToggleIcon.jsx';
import { coerceDateRange, dateInputBounds } from '../utils/dateRangeConstraints.js';
import { ChartSnapshotExportModal } from '../components/ChartSnapshotExportModal.jsx';
import { applyTickerChartSnapshotCloneFixes, useChartSnapshotExport } from '../hooks/useChartSnapshotExport.js';

const TIMEFRAMES = ['1D', '5D', '1M', '3M', '6M', '1Y', '3Y', '5Y', '10Y', '20Y'];
const MAX_SIGNAL_RANGE_DAYS = 40000;
const BENCHMARK = 'SPX';

const CHART_USER_H_KEY = 'odin_index_chart_h';
/** Max drag height; min height follows {@link useMediaChartHeight} (layout default per breakpoint). */
const CHART_H_MAX = 1400;

const RESIZE_KEY_ANNUAL_FIGMA = 'odin_index_resize_annual_figma';
const RESIZE_KEY_QUARTERLY_FIGMA = 'odin_index_resize_quarterly_figma';
const RESIZE_KEY_MONTHLY_RETURNS = 'odin_index_resize_monthly_returns';

const MAX_NEWS_ITEMS = 120;
const NEWS_PAGE_SIZE = 5;
const INDEX_TICKERS_PAGE_SIZE = 50;
const PAGER_SIBLING_COUNT = 1;

const PERF_COLS = [
  { label: '1M', period: 'Last Month' },
  { label: '3M', period: 'Last 3 months' },
  { label: 'YTD', period: 'Year to Date (YTD)' },
  { label: '1Y', period: 'Last 1 year' }
];

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

/** Stable fallback so effects keyed on `dynamicPeriods` do not loop on `|| []`. */
const EMPTY_DYNAMIC_PERIODS = Object.freeze([]);

/** Route slug → backend `index` body + UI label */
export const INDEX_ROUTE_CHOICES = [
  { slug: 'sp500', apiIndex: 'sp500', ticker: 'SPX', returnsTicker: 'SPX', label: 'S&P 500' },
  { slug: 'dow-jones', apiIndex: 'Dow Jones', returnsTicker: 'DJI', label: 'Dow Jones' },
  { slug: 'nasdaq-100', apiIndex: 'Nasdaq 100', ticker: 'NDX', returnsTicker: 'NDX', label: 'Nasdaq 100' }
];

/** Header “Data mode” link targets for index routes (ticker page symbol). */
const INDEX_HEADER_TICKER_BY_SLUG = {
  sp500: 'SPY',
  'dow-jones': 'DIA',
  'nasdaq-100': 'QQQ'
};
const INDEX_ROUTE_DROPDOWN_OPTIONS = INDEX_ROUTE_CHOICES.map((opt) => ({ id: opt.slug, label: opt.label }));

/** SPDR sector ETFs (same universe as market page / heatmap sectors). */
const SECTOR_ROUTE_CHOICES = MARKET_SERIES.filter((s) => s.group === 'sector');
const SECTOR_ROUTE_DROPDOWN_OPTIONS = SECTOR_ROUTE_CHOICES.map((s) => ({
  id: s.key.toLowerCase(),
  label: `${s.label} ${s.addon}`
}));
const DEFAULT_SECTOR_ROUTE_SLUG = 'xlk';

const RELATIVE_STRENGTH_OPTIONS = [
  ...INDEX_ROUTE_CHOICES.map((opt) => ({
    key: `IDX:${opt.slug}`,
    label: opt.label,
    kind: 'index',
    apiIndex: opt.apiIndex,
    returnsTicker: opt.returnsTicker || opt.ticker || null
  })),
  ...SECTOR_ROUTE_CHOICES.map((s) => ({
    key: `TK:${s.ticker}`,
    label: `${s.label} (${s.ticker})`,
    kind: 'ticker',
    ticker: s.ticker
  }))
];
const RELATIVE_STRENGTH_DROPDOWN_OPTIONS = RELATIVE_STRENGTH_OPTIONS.map((opt) => ({ id: opt.key, label: opt.label }));

function sanitizeIndexSlug(raw) {
  let s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  if (!s) return '';
  const aliases = {
    dowjones: 'dow-jones',
    djia: 'dow-jones',
    nasdaq100: 'nasdaq-100',
    nasdaq: 'nasdaq-100',
    ixic: 'nasdaq-composite',
    comp: 'nasdaq-composite'
  };
  if (aliases[s]) return aliases[s];
  return s;
}

function sanitizeSectorSlug(raw) {
  const u = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!u) return DEFAULT_SECTOR_ROUTE_SLUG;
  const found = SECTOR_ROUTE_CHOICES.find((s) => s.key.toLowerCase() === u);
  return found ? found.key.toLowerCase() : DEFAULT_SECTOR_ROUTE_SLUG;
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

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function toIso(d) {
  return d.toISOString().slice(0, 10);
}

function clampStartToMaxDays(start, end, maxInclusiveDays) {
  const maxDiffMs = (maxInclusiveDays - 1) * 86400000;
  const diff = end.getTime() - start.getTime();
  if (diff <= maxDiffMs) return start;
  return new Date(end.getTime() - maxDiffMs);
}

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

function signalBucket(sig) {
  const s = String(sig || 'N')
    .trim()
    .toUpperCase();
  if (!s || s === 'N' || s === 'NULL') return 'N';
  if (/^L1/.test(s)) return 'L1';
  if (/^L2/.test(s)) return 'L2';
  if (s.startsWith('L')) return 'L3';
  if (/^S1/.test(s)) return 'S1';
  if (/^S2/.test(s)) return 'S2';
  if (s.startsWith('S')) return 'S3';
  return 'N';
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

/** Official index tickers: use ticker-returns for dynamicPeriods (correct "Last date" / 1D). */
async function fetchDynamicPeriodsForReturnsTicker(ticker) {
  const u = String(ticker || '').toUpperCase().trim();
  if (!u || !canFetchMarketData()) return null;
  const retRes = await fetchJsonCached({
    path: '/api/market/ticker-returns',
    method: 'POST',
    body: { ticker: u },
    ttlMs: 15 * 60 * 1000
  });
  const periods = retRes?.data?.performance?.dynamicPeriods;
  return Array.isArray(periods) && periods.length ? periods : null;
}

async function enrichIndexPayloadWithTickerReturns(indexData, routeSlug) {
  if (!indexData?.performance) return indexData;
  const routeOpt = INDEX_ROUTE_CHOICES.find((x) => x.slug === routeSlug);
  const returnsTicker =
    (routeOpt?.returnsTicker && String(routeOpt.returnsTicker).trim()) ||
    (indexData.officialIndexTicker && String(indexData.officialIndexTicker).trim()) ||
    '';
  if (!returnsTicker) return indexData;
  const dynamicPeriods = await fetchDynamicPeriodsForReturnsTicker(returnsTicker);
  if (!dynamicPeriods) return indexData;
  return {
    ...indexData,
    performance: { ...indexData.performance, dynamicPeriods }
  };
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
  if (!payload) return [];
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

/** Normalize GET /api/market/ohlc rows for the main chart (real O/H/L/C). */
function normalizeOhlcApiRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const d = rowDateToTimeKey(r);
      const open = pickNum(r, ['Open', 'open']);
      const high = pickNum(r, ['High', 'high']);
      const low = pickNum(r, ['Low', 'low']);
      const close = pickNum(r, ['Close', 'close', 'Adj_Close', 'adj_close']);
      if (!d || close == null || !Number.isFinite(close)) return null;
      const vol = pickNum(r, ['Volume', 'volume', 'VOLUME']);
      return {
        Date: d,
        Open: open ?? close,
        High: high ?? close,
        Low: low ?? close,
        Close: close,
        Volume: vol ?? 0,
        signal: r.signal != null ? String(r.signal) : 'N'
      };
    })
    .filter(Boolean);
}

/** Map index-returns `syntheticCloseSeries` to OHLC-shaped rows for Lightweight Charts. */
function closeSeriesToChartRows(series) {
  if (!Array.isArray(series)) return [];
  return series.map((pt) => {
    const d = String(pt.date || '').slice(0, 10);
    const c = Number(pt.close);
    const v = Number.isFinite(c) ? c : null;
    return {
      Date: d,
      Open: v,
      High: v,
      Low: v,
      Close: v,
      Volume: 0,
      signal: 'N'
    };
  });
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

function IconChevronDown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" />
    </svg>
  );
}

function IconPagerChevronLeft({ double = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {double ? (
        <>
          <path d="M8.8 3.2L5 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.8 3.2L2 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M8.7 3.2L4.9 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function IconPagerChevronRight({ double = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {double ? (
        <>
          <path d="M5.2 3.2L9 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.2 3.2L12 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M5.3 3.2L9.1 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function buildPaginationItems(totalPages, currentPage, siblingCount = PAGER_SIBLING_COUNT) {
  if (totalPages <= 1) return [1];
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < totalPages - 1;

  if (!showLeftDots && showRightDots) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
    return [...leftRange, 'dots-right', totalPages];
  }
  if (showLeftDots && !showRightDots) {
    const rightRangeStart = totalPages - (2 + siblingCount * 2);
    const rightRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => rightRangeStart + i);
    return [1, 'dots-left', ...rightRange];
  }
  const middle = [];
  for (let p = leftSibling; p <= rightSibling; p += 1) middle.push(p);
  return [1, 'dots-left', ...middle, 'dots-right', totalPages];
}

function FigmaPagination({ page, totalPages, onPageChange, siblingCount = PAGER_SIBLING_COUNT, className = '' }) {
  const items = useMemo(() => buildPaginationItems(totalPages, page, siblingCount), [totalPages, page, siblingCount]);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div
      className={'statistic-data__pager-figma' + (className ? ` ${className}` : '')}
      role="navigation"
      aria-label="Table pagination"
    >
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="First page"
        onClick={() => onPageChange(1)}
        disabled={!canPrev}
      >
        <IconPagerChevronLeft double />
      </button>
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
      >
        <IconPagerChevronLeft />
      </button>
      {items.map((it, idx) =>
        typeof it === 'number' ? (
          <button
            key={`p-${it}`}
            type="button"
            className={'statistic-data__pg-btn' + (it === page ? ' statistic-data__pg-btn--active' : '')}
            aria-label={`Page ${it}`}
            aria-current={it === page ? 'page' : undefined}
            onClick={() => onPageChange(it)}
          >
            {it}
          </button>
        ) : (
          <span key={`${it}-${idx}`} className="statistic-data__pg-dots" aria-hidden>
            ...
          </span>
        )
      )}
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
      >
        <IconPagerChevronRight />
      </button>
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Last page"
        onClick={() => onPageChange(totalPages)}
        disabled={!canNext}
      >
        <IconPagerChevronRight double />
      </button>
    </div>
  );
}

function ChartTypeToolbarDropdown({ chartType, onChartTypeChange }) {
  return (
    <ThemedDropdown
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

function ChartToolbarIcons() {
  const c = 'ticker-chart-toolbar__ico';
  return (
    <div className="ticker-chart-toolbar__icons" aria-hidden>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 21l6-6 4 4 8-8M21 7V3h-4" />
      </svg>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 20L20 4M4 4v4m0-4h4M20 20v-4m0 4h-4" />
      </svg>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M4 12h16M12 4v16" />
      </svg>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 18h16M4 12h10M4 6h14" />
      </svg>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      </svg>
    </div>
  );
}

function pctClass(n) {
  if (n == null || !Number.isFinite(n)) return '';
  if (n > 0) return 'ticker-num--up';
  if (n < 0) return 'ticker-num--down';
  return '';
}

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').IndexPageInitialData | null} [props.initialData]
 */
export default function IndexPage({ initialData = null }) {
  const location = useLocation();
  const { indexSlug: indexSlugParam, sectorKey: sectorKeyParam } = useParams();
  const navigate = useNavigate();
  const watchlistDock = useWatchlistDock();
  const isSectorDataRoute = location.pathname.startsWith('/sector-data');
  const sectorSlugResolved = useMemo(
    () => (isSectorDataRoute ? sanitizeSectorSlug(sectorKeyParam) : null),
    [isSectorDataRoute, sectorKeyParam]
  );
  const activeSector = useMemo(() => {
    if (!isSectorDataRoute || !sectorSlugResolved) return null;
    const key = String(sectorSlugResolved).toUpperCase();
    return SECTOR_ROUTE_CHOICES.find((s) => s.key === key) || SECTOR_ROUTE_CHOICES.find((s) => s.key === 'XLK') || null;
  }, [isSectorDataRoute, sectorSlugResolved]);

  useEffect(() => {
    if (!isSectorDataRoute || !sectorKeyParam) return;
    const resolved = sanitizeSectorSlug(sectorKeyParam);
    if (String(sectorKeyParam).toLowerCase().replace(/[^a-z0-9]/g, '') !== resolved) {
      navigate(`/sector-data/${encodeURIComponent(resolved)}`, { replace: true });
    }
  }, [isSectorDataRoute, sectorKeyParam, navigate]);

  const [activeSlug, setActiveSlug] = useState(() => sanitizeIndexSlug(indexSlugParam) || 'sp500');
  const slug = activeSlug;
  useEffect(() => {
    const next = sanitizeIndexSlug(indexSlugParam) || 'sp500';
    setActiveSlug((prev) => (prev === next ? prev : next));
  }, [indexSlugParam]);

  const activeMeta = useMemo(() => {
    if (isSectorDataRoute && activeSector) {
      return {
        slug: activeSector.key.toLowerCase(),
        label: activeSector.label,
        apiIndex: 'sp500',
        sectorEtfKey: activeSector.key
      };
    }
    return INDEX_ROUTE_CHOICES.find((x) => x.slug === slug) || INDEX_ROUTE_CHOICES[0];
  }, [isSectorDataRoute, activeSector, slug]);

  const topDropdownValue = isSectorDataRoute ? sectorSlugResolved || DEFAULT_SECTOR_ROUTE_SLUG : slug;
  const topDropdownLabel = isSectorDataRoute ? 'S&P 500 Sectors' : 'Index';

  const ssrHasChart = Boolean(
    initialData?.fullChartSeries?.some((s) => /^\d{4}-\d{2}-\d{2}/.test(String(s?.date || '')))
  );
  const ssrMatchesRoute = useMemo(() => {
    if (!initialData?.indexPayload) return false;
    if (isSectorDataRoute) {
      return (
        initialData.isSector &&
        initialData.slug === (sectorSlugResolved || DEFAULT_SECTOR_ROUTE_SLUG)
      );
    }
    return !initialData.isSector && initialData.slug === slug;
  }, [initialData, isSectorDataRoute, sectorSlugResolved, slug]);


  const [authVersion, setAuthVersion] = useState(0);
  const [timeframe, setTimeframe] = useState('1Y');
  const [metaBusy, setMetaBusy] = useState(() => !ssrMatchesRoute || !ssrHasChart);
  const [error, setError] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => initialData?.asOfDate || '');

  const [indexPayload, setIndexPayload] = useState(() =>
    ssrMatchesRoute ? initialData?.indexPayload ?? null : null
  );
  const [fullChartRows, setFullChartRows] = useState(() => {
    if (!ssrMatchesRoute || !initialData?.fullChartSeries?.length) return [];
    return closeSeriesToChartRows(initialData.fullChartSeries);
  });
  const [returnsSpy, setReturnsSpy] = useState(() =>
    ssrMatchesRoute ? initialData?.returnsSpy ?? null : null
  );
  const [statsRows, setStatsRows] = useState([]);
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [relativeSeriesByKey, setRelativeSeriesByKey] = useState({});
  const [relativeBusy, setRelativeBusy] = useState(false);
  const [relativeLeftKey, setRelativeLeftKey] = useState(`IDX:${slug}`);
  const [relativeRightKey, setRelativeRightKey] = useState(`IDX:${slug}`);
  const [indexTickersRows, setIndexTickersRows] = useState([]);
  const [indexTickersBusy, setIndexTickersBusy] = useState(false);
  const [indexTickersPage, setIndexTickersPage] = useState(1);
  const [indexConstituentsSort, setIndexConstituentsSort] = useState(
    /** @type {{ key: 'name' | 'close' | 'pct', dir: 'asc' | 'desc' }} */ ({ key: 'name', dir: 'asc' })
  );
  const [tailRows, setTailRows] = useState([]);
  const [ohlcTickerBounds, setOhlcTickerBounds] = useState(/** @type {{ min: string, max: string } | null} */ (null));

  const [newsPage, setNewsPage] = useState(1);
  const [chartHoverOhlc, setChartHoverOhlc] = useState(null);
  const { busy: newsBusy, error: newsError, items: liveNewsAll } = useGeneralNewsFeed();
  const liveNews = useMemo(() => liveNewsAll.slice(0, MAX_NEWS_ITEMS), [liveNewsAll]);
  const [appliedCustomRange, setAppliedCustomRange] = useState(null);
  const [draftChartStart, setDraftChartStart] = useState('');
  const [draftChartEnd, setDraftChartEnd] = useState('');
  const customRangeBounds = useMemo(
    () => dateInputBounds(draftChartStart, draftChartEnd, { globalMax: asOfDate }),
    [draftChartStart, draftChartEnd, asOfDate]
  );
  const [isCustomRangePopupOpen, setIsCustomRangePopupOpen] = useState(false);
  const [mainChartType, setMainChartType] = useState('area');


  const chartBodyRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartPlotHostRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const mediaChartHeight = useMediaChartHeight();
  const mediaHRef = useRef(mediaChartHeight);
  mediaHRef.current = mediaChartHeight;
  const resizeDragRef = useRef(/** @type {{ active: boolean, startY: number, startH: number } | null} */ (null));

  const [userChartHeight, setUserChartHeight] = useState(/** @type {number | null} */ (null));

  /** Never allow plot below layout default (prevents gap above content below chart when shrinking). */
  useEffect(() => {
    const minH = mediaChartHeight;
    setUserChartHeight((prev) => {
      let next = prev;
      if (next == null) {
        try {
          const raw = localStorage.getItem(CHART_USER_H_KEY);
          const n = raw != null ? parseInt(raw, 10) : NaN;
          if (Number.isFinite(n)) next = n;
        } catch {
          /* ignore */
        }
      }
      if (next == null) return prev;
      const clamped = Math.max(minH, Math.min(CHART_H_MAX, next));
      if (clamped === prev) return prev;
      if (clamped !== next) {
        try {
          localStorage.setItem(CHART_USER_H_KEY, String(clamped));
        } catch {
          /* ignore */
        }
      }
      return clamped;
    });
  }, [mediaChartHeight]);
  const [chartFs, setChartFs] = useState(false);
  const [fsPlotH, setFsPlotH] = useState(0);

  const routeChartTicker = useMemo(() => {
    if (isSectorDataRoute) return '';
    const choice = INDEX_ROUTE_CHOICES.find((x) => x.slug === slug);
    return choice?.ticker ? String(choice.ticker).trim().toUpperCase() : '';
  }, [isSectorDataRoute, slug]);

  const ohlcSymbol = useMemo(() => {
    if (routeChartTicker) return routeChartTicker;
    if (!indexPayload) return null;
    const o = indexPayload.officialIndexTicker;
    const t = indexPayload.ticker;
    if (o && String(o).trim()) return String(o).trim().toUpperCase();
    if (t && String(t).trim()) return String(t).trim().toUpperCase();
    return null;
  }, [indexPayload, routeChartTicker]);

  const effectiveAsOfDate = useMemo(() => {
    if (asOfDate) return asOfDate;
    const rows = sortRowsAsc(fullChartRows);
    if (rows.length) return rowDateToTimeKey(rows[rows.length - 1]) || '';
    return new Date().toISOString().slice(0, 10);
  }, [asOfDate, fullChartRows]);

  const chartApiRange = useMemo(() => {
    if (appliedCustomRange?.start && appliedCustomRange?.end) {
      const n = normalizeCustomChartRange(appliedCustomRange.start, appliedCustomRange.end, effectiveAsOfDate);
      return n || rangeForTimeframe(timeframe, effectiveAsOfDate, ohlcTickerBounds);
    }
    return rangeForTimeframe(timeframe, effectiveAsOfDate, ohlcTickerBounds);
  }, [appliedCustomRange, timeframe, effectiveAsOfDate, ohlcTickerBounds]);

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

  const onIndexSlugChange = useCallback(
    (nextSlug) => {
      const s = sanitizeIndexSlug(nextSlug);
      setActiveSlug(s || 'sp500');
      if (!s) navigate(`/indices/${encodeURIComponent(DEFAULT_INDEX_ROUTE_SLUG)}`);
      else navigate('/indices/' + encodeURIComponent(s));
    },
    [navigate]
  );

  const onSectorSlugChange = useCallback(
    (nextId) => {
      const s = sanitizeSectorSlug(nextId);
      navigate('/sector-data/' + encodeURIComponent(s));
    },
    [navigate]
  );

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

  const sectorTickerForLoad = isSectorDataRoute && activeSector ? String(activeSector.ticker).trim().toUpperCase() : '';

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) {
      if (!ssrMatchesRoute) {
        setError('Unable to load index data.');
        setMetaBusy(false);
        setIndexPayload(null);
        setFullChartRows([]);
        setReturnsSpy(null);
        setStatsRows([]);
        setStatsRowsSpy([]);
        setTailRows([]);
        setOhlcTickerBounds(null);
      }
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      if (ssrMatchesRoute && ssrHasChart) {
        setMetaBusy(false);
        return;
      }
      setMetaBusy(true);
      setError('');
      try {
        if (isSectorDataRoute && sectorTickerForLoad) {
          const ticker = sectorTickerForLoad;
          const [retRes, ohlcLongRes] = await Promise.all([
            fetchJsonCached({
              path: '/api/market/ticker-returns',
              method: 'POST',
              body: { ticker },
              ttlMs: 15 * 60 * 1000
            }),
            fetchJsonCached({
              path: '/api/market/ohlc?symbol=' + encodeURIComponent(ticker) + '&limit=4000',
              method: 'GET',
              ttlMs: 10 * 60 * 1000
            })
          ]);
          if (stale()) return;
          const retData = retRes.data && typeof retRes.data === 'object' ? retRes.data : {};
          await yieldToMain();
          if (stale()) return;
          const ohlcSorted = sortRowsAsc(ohlcRowsFromPayload(ohlcLongRes.data));
          const syntheticCloseSeries = ohlcSorted
            .map((r) => {
              const date = rowDateToTimeKey(r);
              const close = pickNum(r, ['Close', 'close']);
              if (!date || close == null || !Number.isFinite(close)) return null;
              return { date, close };
            })
            .filter(Boolean);
          const asOf = String(
            retData.asOfDate ||
              (ohlcSorted.length ? rowDateToTimeKey(ohlcSorted[ohlcSorted.length - 1]) : '') ||
              new Date().toISOString().slice(0, 10)
          ).slice(0, 10);
          setAsOfDate(asOf);
          setIndexPayload({
            officialIndexTicker: ticker,
            ticker,
            asOfDate: asOf,
            syntheticCloseSeries,
            performance: retData.performance,
            seriesMode: 'Sector ETF'
          });
          setFullChartRows(sortRowsAsc(normalizeOhlcApiRows(ohlcSorted)));

          const asOfD = new Date(String(asOf).slice(0, 10) + 'T12:00:00');
          const start365 = new Date(asOfD);
          start365.setFullYear(start365.getFullYear() - 1);
          const startIso = toIso(start365);
          const endIso = String(asOf).slice(0, 10);

          const retSpy = await fetchJsonCached({
            path: '/api/market/ticker-returns',
            method: 'POST',
            body: { ticker: BENCHMARK },
            ttlMs: 15 * 60 * 1000
          });
          if (stale()) return;
          setReturnsSpy(retSpy.data);

          const u = encodeURIComponent(ticker);
          const [tailRes, statsSymRes, statsSpyRes] = await Promise.all([
            fetchJsonCached({
              path: '/api/market/ohlc?symbol=' + u + '&limit=8',
              method: 'GET',
              ttlMs: 60 * 1000
            }),
            fetchJsonCached({
              path:
                '/api/market/ohlc?symbol=' +
                u +
                '&start_date=' +
                encodeURIComponent(startIso) +
                '&end_date=' +
                encodeURIComponent(endIso) +
                '&limit=400',
              method: 'GET',
              ttlMs: 10 * 60 * 1000
            }),
            fetchJsonCached({
              path:
                '/api/market/ohlc?symbol=' +
                encodeURIComponent(BENCHMARK) +
                '&start_date=' +
                encodeURIComponent(startIso) +
                '&end_date=' +
                encodeURIComponent(endIso) +
                '&limit=400',
              method: 'GET',
              ttlMs: 10 * 60 * 1000
            })
          ]);
          if (stale()) return;
          await yieldToMain();
          if (stale()) return;
          setTailRows(sortRowsAsc(ohlcRowsFromPayload(tailRes.data)));
          setStatsRows(sortRowsAsc(ohlcRowsFromPayload(statsSymRes.data)));
          setStatsRowsSpy(sortRowsAsc(ohlcRowsFromPayload(statsSpyRes.data)));
        } else {
          const idxRes = await fetchJsonCached({
            path: '/api/market/index-returns',
            method: 'POST',
            body: { index: activeMeta.apiIndex },
            ttlMs: 10 * 60 * 1000
          });
          if (stale()) return;
          const d = idxRes.data && typeof idxRes.data === 'object' ? idxRes.data : {};
          const asOf = d?.asOfDate || new Date().toISOString().slice(0, 10);
          setAsOfDate(asOf);

          let series = Array.isArray(d?.syntheticCloseSeries) ? d.syntheticCloseSeries : [];
          let payload = d;

          if (routeChartTicker) {
            const ohlcLongRes = await fetchJsonCached({
              path: '/api/market/ohlc?symbol=' + encodeURIComponent(routeChartTicker) + '&limit=4000',
              method: 'GET',
              ttlMs: 10 * 60 * 1000
            });
            if (stale()) return;
            await yieldToMain();
            const ohlcSorted = sortRowsAsc(ohlcRowsFromPayload(ohlcLongRes.data));
            series = ohlcSorted
              .map((r) => {
                const date = rowDateToTimeKey(r);
                const close = pickNum(r, ['Close', 'close']);
                if (!date || close == null || !Number.isFinite(close)) return null;
                return { date, close };
              })
              .filter(Boolean);
            payload = {
              ...d,
              officialIndexTicker: routeChartTicker,
              ticker: routeChartTicker,
              seriesMode: d?.seriesMode ? `${d.seriesMode} · ${routeChartTicker}` : routeChartTicker
            };
            setFullChartRows(sortRowsAsc(normalizeOhlcApiRows(ohlcSorted)));
          } else {
            setFullChartRows(sortRowsAsc(closeSeriesToChartRows(series)));
          }

          payload = await enrichIndexPayloadWithTickerReturns(payload, slug);
          setIndexPayload(payload);

          const asOfD = new Date(String(asOf).slice(0, 10) + 'T12:00:00');
          const start365 = new Date(asOfD);
          start365.setFullYear(start365.getFullYear() - 1);
          const startIso = toIso(start365);
          const endIso = String(asOf).slice(0, 10);

          const symForOhlc =
            routeChartTicker ||
            (d?.officialIndexTicker && String(d.officialIndexTicker).trim()) ||
            (d?.ticker && String(d.ticker).trim()) ||
            '';

          const retSpy = await fetchJsonCached({
            path: '/api/market/ticker-returns',
            method: 'POST',
            body: { ticker: BENCHMARK },
            ttlMs: 15 * 60 * 1000
          });
          if (stale()) return;
          setReturnsSpy(retSpy.data);

          if (symForOhlc) {
            const u = encodeURIComponent(symForOhlc);
            const [tailRes, statsSymRes, statsSpyRes] = await Promise.all([
              fetchJsonCached({
                path: '/api/market/ohlc?symbol=' + u + '&limit=8',
                method: 'GET',
                ttlMs: 60 * 1000
              }),
              fetchJsonCached({
                path:
                  '/api/market/ohlc?symbol=' +
                  u +
                  '&start_date=' +
                  encodeURIComponent(startIso) +
                  '&end_date=' +
                  encodeURIComponent(endIso) +
                  '&limit=400',
                method: 'GET',
                ttlMs: 10 * 60 * 1000
              }),
              fetchJsonCached({
                path:
                  '/api/market/ohlc?symbol=' +
                  encodeURIComponent(BENCHMARK) +
                  '&start_date=' +
                  encodeURIComponent(startIso) +
                  '&end_date=' +
                  encodeURIComponent(endIso) +
                  '&limit=400',
                method: 'GET',
                ttlMs: 10 * 60 * 1000
              })
            ]);
            if (stale()) return;
            await yieldToMain();
            if (stale()) return;
            setTailRows(sortRowsAsc(ohlcRowsFromPayload(tailRes.data)));
            setStatsRows(sortRowsAsc(ohlcRowsFromPayload(statsSymRes.data)));
            setStatsRowsSpy(sortRowsAsc(ohlcRowsFromPayload(statsSpyRes.data)));
          } else {
            if (stale()) return;
            await yieldToMain();
            if (stale()) return;
            const baseRows = sortRowsAsc(closeSeriesToChartRows(series));
            const tail = baseRows.slice(-8);
            setTailRows(tail);
            const stats = baseRows.filter((r) => {
              const iso = rowDateToTimeKey(r);
              return iso && iso >= startIso && iso <= endIso;
            });
            setStatsRows(stats.length ? stats : baseRows.slice(-252));

            const statsSpyRes = await fetchJsonCached({
              path:
                '/api/market/ohlc?symbol=' +
                encodeURIComponent(BENCHMARK) +
                '&start_date=' +
                encodeURIComponent(startIso) +
                '&end_date=' +
                encodeURIComponent(endIso) +
                '&limit=400',
              method: 'GET',
              ttlMs: 10 * 60 * 1000
            });
            if (stale()) return;
            setStatsRowsSpy(sortRowsAsc(ohlcRowsFromPayload(statsSpyRes.data)));
          }
        }
      } catch (e) {
        if (isAbortError(e) || stale()) return;
        setError(e.message || 'Failed to load index');
        setIndexPayload(null);
        setFullChartRows([]);
        setReturnsSpy(null);
        setStatsRows([]);
        setStatsRowsSpy([]);
        setTailRows([]);
      } finally {
        if (!stale()) setMetaBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSectorDataRoute, sectorTickerForLoad, activeMeta.apiIndex, routeChartTicker, slug, authVersion, ssrMatchesRoute, ssrHasChart]);

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
    const sym = ohlcSymbol;
    if (!sym) {
      const sorted = sortRowsAsc(fullChartRows);
      if (sorted.length) {
        const min = rowDateToTimeKey(sorted[0]);
        const max = rowDateToTimeKey(sorted[sorted.length - 1]);
        setOhlcTickerBounds(min && max ? { min, max } : null);
      } else {
        setOhlcTickerBounds(null);
      }
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
  }, [ohlcSymbol, fullChartRows, authVersion]);

  useEffect(() => {
    setNewsPage(1);
  }, [slug, isSectorDataRoute, sectorSlugResolved]);

  const allChartRows = useMemo(() => sortRowsAsc(fullChartRows), [fullChartRows]);

  const sortedChart = useMemo(() => {
    const { start, end } = chartApiRange;
    return allChartRows.filter((r) => {
      const t = rowDateToTimeKey(r);
      return t && t >= start && t <= end;
    });
  }, [allChartRows, chartApiRange.start, chartApiRange.end]);

  const returnsSym = useMemo(() => {
    if (!indexPayload?.performance) return null;
    const tk =
      routeChartTicker ||
      (indexPayload.officialIndexTicker && String(indexPayload.officialIndexTicker).trim()) ||
      (indexPayload.ticker && String(indexPayload.ticker).trim()) ||
      activeMeta.label;
    return {
      success: true,
      ticker: String(tk).toUpperCase(),
      asOfDate: indexPayload.asOfDate,
      performance: indexPayload.performance
    };
  }, [indexPayload, activeMeta.label]);

  const displaySym = returnsSym?.ticker || activeMeta.label;

  /** Tradable symbol for watchlist add (same sources as OHLC / returns, never the index display name). */
  const watchlistTickerSymbol = useMemo(() => {
    if (isSectorDataRoute && activeSector?.ticker) {
      return String(activeSector.ticker).toUpperCase().trim();
    }
    if (ohlcSymbol) return ohlcSymbol;
    return '';
  }, [isSectorDataRoute, activeSector?.ticker, ohlcSymbol]);

  const onAddTickerToWatchlist = useCallback(() => {
    const ticker = watchlistTickerSymbol;
    if (!ticker) return;
    watchlistDock.open();
    try {
      sessionStorage.setItem('watchlist_add_symbol', ticker);
    } catch {
      /* ignore */
    }
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent('watchlist:add-ticker', { detail: { symbol: ticker } }));
    });
  }, [watchlistDock, watchlistTickerSymbol]);

  const newsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(liveNews.length / NEWS_PAGE_SIZE)),
    [liveNews.length]
  );
  const newsPageSafe = Math.min(Math.max(1, newsPage), newsTotalPages);
  const newsPageItems = useMemo(() => {
    const start = (newsPageSafe - 1) * NEWS_PAGE_SIZE;
    return liveNews.slice(start, start + NEWS_PAGE_SIZE);
  }, [liveNews, newsPageSafe]);

  const relatedIndexLinks = useMemo(() => {
    if (isSectorDataRoute && activeSector) {
      return SECTOR_ROUTE_CHOICES.filter((x) => x.key !== activeSector.key).map((x) => ({
        slug: x.key.toLowerCase(),
        label: x.label,
        to: `/sector-data/${encodeURIComponent(x.key.toLowerCase())}`
      }));
    }
    return INDEX_ROUTE_CHOICES.filter((x) => x.slug !== slug).map((x) => ({
      slug: x.slug,
      label: x.label,
      to: `/indices/${encodeURIComponent(x.slug)}`
    }));
  }, [isSectorDataRoute, activeSector, slug]);

  useEffect(() => {
    setIndexTickersPage(1);
    if (isSectorDataRoute && activeSector) {
      setRelativeLeftKey(`TK:${activeSector.ticker}`);
    } else {
      setRelativeLeftKey(`IDX:${slug}`);
    }
    setRelativeRightKey('SPX');
  }, [isSectorDataRoute, slug, activeSector?.ticker]);

  const dynamicSym = returnsSym?.performance?.dynamicPeriods ?? EMPTY_DYNAMIC_PERIODS;
  const dynamicSpy = returnsSpy?.performance?.dynamicPeriods ?? EMPTY_DYNAMIC_PERIODS;
  const annualReturnsRaw = returnsSym?.performance?.annualReturns;
  const quarterlyReturnsRaw = returnsSym?.performance?.quarterlyReturns;
  const monthlyReturnsRaw = returnsSym?.performance?.monthlyReturns;
  const annualReturnsForChart = Array.isArray(annualReturnsRaw) ? annualReturnsRaw : [];
  const quarterlyReturnsForChart = Array.isArray(quarterlyReturnsRaw) ? quarterlyReturnsRaw : [];

  const loadRelativeSeries = useCallback(
    async (option) => {
      if (!option || !canFetchMarketData()) return null;
      if (option.kind === 'ticker') {
        const ret = await fetchJsonCached({
          path: '/api/market/ticker-returns',
          method: 'POST',
          body: { ticker: option.ticker },
          ttlMs: 15 * 60 * 1000
        });
        const asOf = String(ret?.data?.asOfDate || asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
        const asOfD = new Date(asOf + 'T12:00:00');
        const start = new Date(asOfD);
        start.setFullYear(start.getFullYear() - 1);
        const startIso = toIso(start);
        const rowsRes = await fetchJsonCached({
          path:
            '/api/market/ohlc?symbol=' +
            encodeURIComponent(option.ticker) +
            '&start_date=' +
            encodeURIComponent(startIso) +
            '&end_date=' +
            encodeURIComponent(asOf) +
            '&limit=400',
          method: 'GET',
          ttlMs: 10 * 60 * 1000
        });
        const rows = sortRowsAsc(ohlcRowsFromPayload(rowsRes.data));
        return {
          dynamicPeriods: ret?.data?.performance?.dynamicPeriods || [],
          mtd: mtdFromRows(rows),
          qtd: qtdFromRows(rows)
        };
      }

      const idx = await fetchJsonCached({
        path: '/api/market/index-returns',
        method: 'POST',
        body: { index: option.apiIndex },
        ttlMs: 10 * 60 * 1000
      });
      let d = idx?.data || {};
      d = await enrichIndexPayloadWithTickerReturns(d, option.key.replace(/^IDX:/, ''));
      const asOf = String(d?.asOfDate || asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const asOfD = new Date(asOf + 'T12:00:00');
      const start = new Date(asOfD);
      start.setFullYear(start.getFullYear() - 1);
      const startIso = toIso(start);
      const symForOhlc =
        (d?.officialIndexTicker && String(d.officialIndexTicker).trim()) ||
        (d?.ticker && String(d.ticker).trim()) ||
        (option.returnsTicker && String(option.returnsTicker).trim()) ||
        '';
      let rows = [];
      if (symForOhlc) {
        const rowsRes = await fetchJsonCached({
          path:
            '/api/market/ohlc?symbol=' +
            encodeURIComponent(symForOhlc) +
            '&start_date=' +
            encodeURIComponent(startIso) +
            '&end_date=' +
            encodeURIComponent(asOf) +
            '&limit=400',
          method: 'GET',
          ttlMs: 10 * 60 * 1000
        });
        rows = sortRowsAsc(ohlcRowsFromPayload(rowsRes.data));
      } else {
        const seriesRows = sortRowsAsc(closeSeriesToChartRows(Array.isArray(d?.syntheticCloseSeries) ? d.syntheticCloseSeries : []));
        rows = seriesRows.filter((r) => {
          const iso = rowDateToTimeKey(r);
          return iso && iso >= startIso && iso <= asOf;
        });
      }
      return {
        dynamicPeriods: d?.performance?.dynamicPeriods || [],
        mtd: mtdFromRows(rows),
        qtd: qtdFromRows(rows)
      };
    },
    [asOfDate]
  );

  useEffect(() => {
    const sync = () => {
      const el = chartBodyRef.current;
      const doc = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
      setChartFs(!!el && (document.fullscreenElement === el || doc.webkitFullscreenElement === el));
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
  }, [chartFs, sortedChart.length, mainChartType]);

  const onChartResizePointerDown = useCallback(
    (e) => {
      if (chartFs) return;
      e.preventDefault();
      const minH = mediaHRef.current;
      const startH = Math.max(minH, userChartHeight ?? minH);
      resizeDragRef.current = { active: true, startY: e.clientY, startH };
      const onMove = (ev) => {
        const drag = resizeDragRef.current;
        if (!drag?.active) return;
        const dy = ev.clientY - drag.startY;
        const next = Math.round(Math.max(minH, Math.min(CHART_H_MAX, drag.startH + dy)));
        setUserChartHeight(next);
      };
      const onUp = () => {
        if (resizeDragRef.current) resizeDragRef.current.active = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setUserChartHeight((prev) => {
          const v = Math.max(minH, prev == null ? minH : prev);
          try {
            localStorage.setItem(CHART_USER_H_KEY, String(v));
          } catch {
            /* ignore */
          }
          return Math.max(minH, prev == null ? minH : prev);
        });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [chartFs, userChartHeight, mediaChartHeight]
  );

  const onChartResizeDoubleClick = useCallback((e) => {
    e.preventDefault();
    try {
      localStorage.removeItem(CHART_USER_H_KEY);
    } catch {
      /* ignore */
    }
    setUserChartHeight(null);
  }, []);

  const buildIndexChartExportFilename = useCallback(
    () => buildTickerChartExportFilename('main-chart', displaySym),
    [displaySym]
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
    a.download = `${String(displaySym || 'index').toUpperCase()}-ohlc-${rangeLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedChart, displaySym, timeframe, appliedCustomRange]);

  const loggedIn = useIsLoggedIn();
  const downloadMainChartCsvClick = useGatedCsvDownload(downloadMainChartCsv);
  const mainChartExportDisabled = metaBusy || !sortedChart.length;

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
    buildFilename: buildIndexChartExportFilename,
    disabled: mainChartExportDisabled,
    onclone: applyTickerChartSnapshotCloneFixes
  });

  const toggleChartFullscreen = useCallback(async () => {
    const el = chartBodyRef.current;
    if (!el) return;
    const doc = /** @type {Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element | null }} */ (
      document
    );
    const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement;
    try {
      if (fsEl === el) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else doc.webkitExitFullscreen?.();
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
  const lastSignal = lastRow && lastRow.signal != null ? String(lastRow.signal) : 'N';
  const activeBucket = signalBucket(lastSignal);

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
    const leftKey = isSectorDataRoute && activeSector ? `TK:${activeSector.ticker}` : `IDX:${slug}`;
    const nextLeft = { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
    const nextSpx = { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd };
    setRelativeSeriesByKey((prev) => {
      const curLeft = prev[leftKey];
      const curSpx = prev.SPX;
      if (
        curLeft?.dynamicPeriods === dynamicSym &&
        curLeft?.mtd === symMtd &&
        curLeft?.qtd === symQtd &&
        curSpx?.dynamicPeriods === dynamicSpy &&
        curSpx?.mtd === spyMtd &&
        curSpx?.qtd === spyQtd
      ) {
        return prev;
      }
      return { ...prev, [leftKey]: nextLeft, SPX: nextSpx };
    });
  }, [isSectorDataRoute, slug, activeSector?.ticker, dynamicSym, symMtd, symQtd, dynamicSpy, spyMtd, spyQtd]);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) return () => {};
    const keys = [relativeLeftKey, relativeRightKey].filter(Boolean);
    const missing = keys.filter((k) => !relativeSeriesByKey[k]);
    if (!missing.length) return () => {};
    (async () => {
      setRelativeBusy(true);
      try {
        for (const key of missing) {
          const option = RELATIVE_STRENGTH_OPTIONS.find((o) => o.key === key);
          const payload = await loadRelativeSeries(option);
          if (stale() || !payload) continue;
          setRelativeSeriesByKey((prev) => ({ ...prev, [key]: payload }));
        }
      }
      catch (e) {
        if (!isAbortError(e)) console.error(e);
      }
       finally {
        if (!stale()) setRelativeBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [relativeLeftKey, relativeRightKey, relativeSeriesByKey, loadRelativeSeries]);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = getRouteNavigationEpoch();
    const stale = () => isRouteNavigationStale(cancelled, epochAtStart);
    if (!canFetchMarketData()) {
      setIndexTickersRows([]);
      setIndexTickersBusy(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setIndexTickersBusy(true);
      try {
        const data = await fetchTickerDetailsQuery({
          index: activeMeta.apiIndex,
          period: 'last-date'
        });
        if (stale()) return;
        const rows = dedupeTickerDetailRows(Array.isArray(data?.data) ? data.data : []);
        const filtered =
          isSectorDataRoute && activeSector
            ? rows.filter((r) => rowMatchesSectorEtf(activeSector.key, r.Sector || r.sector))
            : rows;
        const mapped = filtered
          .map((r) => ({
            symbol: String(r.symbol || r.Symbol || '').toUpperCase().trim(),
            close: Number(r.price),
            ret1d: Number(r.totalReturnPercentage)
          }))
          .filter((r) => r.symbol);
        setIndexTickersRows(mapped);
      } catch {
        if (!stale()) setIndexTickersRows([]);
      } finally {
        if (!stale()) setIndexTickersBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeMeta.apiIndex, authVersion, isSectorDataRoute, activeSector?.key]);

  const relativeLeftSeries =
    relativeSeriesByKey[relativeLeftKey] || { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
  const relativeRightSeries =
    relativeSeriesByKey[relativeRightKey] || { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd };
  const relativeLeftLabel =
    RELATIVE_STRENGTH_OPTIONS.find((o) => o.key === relativeLeftKey)?.label || activeMeta.label;
  const relativeRightLabel =
    RELATIVE_STRENGTH_OPTIONS.find((o) => o.key === relativeRightKey)?.label || 'S&P 500';
  const onOpenRelativeStrengthPage = useCallback(() => {
    navigate(buildRelativeStrengthTickerHref());
  }, [navigate]);

  const onOpenNewsPage = useCallback(() => {
    navigate(`/news?ticker=${encodeURIComponent(displaySym)}`);
  }, [navigate, displaySym]);
  const sortedIndexTickersRows = useMemo(() => {
    const list = [...indexTickersRows];
    const dirMul = indexConstituentsSort.dir === 'asc' ? 1 : -1;
    const tieByName = (a, b) =>
      String(a.symbol || '').localeCompare(String(b.symbol || ''), undefined, { sensitivity: 'base' });
    list.sort((a, b) => {
      if (indexConstituentsSort.key === 'name') {
        return dirMul * tieByName(a, b);
      }
      if (indexConstituentsSort.key === 'close') {
        const na = Number(a.close);
        const nb = Number(b.close);
        const aNa = !Number.isFinite(na);
        const bNa = !Number.isFinite(nb);
        if (aNa && bNa) return tieByName(a, b);
        if (aNa) return 1;
        if (bNa) return -1;
        const c = dirMul * (na - nb);
        return c !== 0 ? c : tieByName(a, b);
      }
      if (indexConstituentsSort.key === 'pct') {
        const pa = Number(a.ret1d);
        const pb = Number(b.ret1d);
        const aNa = !Number.isFinite(pa);
        const bNa = !Number.isFinite(pb);
        if (aNa && bNa) return tieByName(a, b);
        if (aNa) return 1;
        if (bNa) return -1;
        const c = dirMul * (pa - pb);
        return c !== 0 ? c : tieByName(a, b);
      }
      return tieByName(a, b);
    });
    return list;
  }, [indexTickersRows, indexConstituentsSort]);

  const indexTickersTotalPages = Math.max(1, Math.ceil(sortedIndexTickersRows.length / INDEX_TICKERS_PAGE_SIZE));
  const indexTickersPageSafe = Math.min(Math.max(1, indexTickersPage), indexTickersTotalPages);
  const indexTickersDisplayRows = useMemo(() => {
    if (isSectorDataRoute) return sortedIndexTickersRows;
    const start = (indexTickersPageSafe - 1) * INDEX_TICKERS_PAGE_SIZE;
    return sortedIndexTickersRows.slice(start, start + INDEX_TICKERS_PAGE_SIZE);
  }, [isSectorDataRoute, sortedIndexTickersRows, indexTickersPageSafe]);

  const onIndexConstituentsSort = useCallback((key) => {
    setIndexConstituentsSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
    setIndexTickersPage(1);
  }, []);

  const indexConstituentsSortGlyph = useCallback(
    (key) =>
      indexConstituentsSort.key === key ? (indexConstituentsSort.dir === 'asc' ? '▲' : '▼') : '↕',
    [indexConstituentsSort]
  );

  const indexConstituentsSortIcoClass = useCallback(
    (key) =>
      'mkt-watch-card__sort-ico' +
      (indexConstituentsSort.key === key
        ? ' mkt-watch-card__sort-ico--active'
        : ' mkt-watch-card__sort-ico--idle'),
    [indexConstituentsSort]
  );

  const indexConstituentsAriaSort = useCallback(
    (key) => {
      if (indexConstituentsSort.key !== key) return 'none';
      return indexConstituentsSort.dir === 'asc' ? 'ascending' : 'descending';
    },
    [indexConstituentsSort]
  );
  const section16Rows = useMemo(() => {
    const compact = COMPARE_ROWS.filter((r) =>
      ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', '20Y'].includes(r.key)
    );
    return compact.map((row) => {
      const symPct = row.period
        ? pickDynamic(relativeLeftSeries.dynamicPeriods, row.period)
        : row.mtd
          ? relativeLeftSeries.mtd
          : row.qtd
            ? relativeLeftSeries.qtd
            : null;
      const basePct = row.period
        ? pickDynamic(relativeRightSeries.dynamicPeriods, row.period)
        : row.mtd
          ? relativeRightSeries.mtd
          : row.qtd
            ? relativeRightSeries.qtd
            : null;
      const diff =
        symPct != null && basePct != null && Number.isFinite(symPct) && Number.isFinite(basePct)
          ? symPct - basePct
          : null;
      return { label: row.key, value: diff, symPct, basePct, diff };
    });
  }, [relativeLeftSeries, relativeRightSeries]);

  const indexPerfCompareRows = useMemo(() => {
    return COMPARE_ROWS.map((row) => {
      const leftPct = row.period
        ? pickDynamic(dynamicSym, row.period)
        : row.mtd
          ? symMtd
          : row.qtd
            ? symQtd
            : null;
      const rightPct = row.period
        ? pickDynamic(dynamicSpy, row.period)
        : row.mtd
          ? spyMtd
          : row.qtd
            ? spyQtd
            : null;
      const diff =
        leftPct != null && rightPct != null && Number.isFinite(leftPct) && Number.isFinite(rightPct)
          ? leftPct - rightPct
          : null;
      return { key: row.key, leftPct, rightPct, diff };
    });
  }, [dynamicSym, dynamicSpy, symMtd, spyMtd, symQtd, spyQtd]);

  const section17CompareRows = useMemo(() => {
    const compactKeys = ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', '20Y'];
    return indexPerfCompareRows
      .filter((r) => compactKeys.includes(r.key))
      .map((r) => ({ label: r.key, symPct: r.leftPct, spyPct: r.rightPct, diff: r.diff }));
  }, [indexPerfCompareRows]);

  const chartHeightMin = mediaChartHeight;
  const basePixelHeight = Math.max(chartHeightMin, userChartHeight ?? chartHeightMin);
  const plotHeight = chartFs && fsPlotH >= chartHeightMin ? fsPlotH : basePixelHeight;

  const chartRangeLabel = chartApiRange.start + ' → ' + chartApiRange.end;
  const chartModeHelp = appliedCustomRange
    ? 'Using your custom start/end (overrides the pill timeframe until you reset).'
    : `Using pill timeframe “${timeframe}”, anchored to as-of ${asOfDate}.`;

  const apiIndexLabel = activeMeta.apiIndex;

  const indexHeaderTickerMeta = useMemo(() => {
    if (isSectorDataRoute && activeSector?.ticker) {
      const sym = String(activeSector.ticker).trim().toUpperCase();
      if (!sym) return { label: '—', to: null, symbol: null };
      return {
        symbol: sym,
        label: sym,
        to: `/ticker/${encodeURIComponent(sym)}?ticker=${encodeURIComponent(sym)}`
      };
    }
    const sym = INDEX_HEADER_TICKER_BY_SLUG[slug] || null;
    if (!sym) {
      return { label: indexPayload?.seriesMode || '—', to: null, symbol: null };
    }
    const u = String(sym).toUpperCase();
    return {
      symbol: u,
      label: u,
      to: `/ticker/${encodeURIComponent(u)}?ticker=${encodeURIComponent(u)}`
    };
  }, [isSectorDataRoute, activeSector?.ticker, slug, indexPayload?.seriesMode]);

  return (
    <div className="ticker-page">
      <div className="ticker-page__search-row">
        <label className="ticker-page__label" htmlFor="index-dash-select" style={{ marginRight: 8 }}>
          {topDropdownLabel}
        </label>
        <ThemedDropdown
          buttonId="index-dash-select"
          wideLabel
          style={{ minWidth: 220, maxWidth: '100%' }}
          value={topDropdownValue}
          options={isSectorDataRoute ? SECTOR_ROUTE_DROPDOWN_OPTIONS : INDEX_ROUTE_DROPDOWN_OPTIONS}
          onChange={isSectorDataRoute ? onSectorSlugChange : onIndexSlugChange}
          title={isSectorDataRoute ? 'Sector ETF' : 'Index universe'}
          ariaLabelPrefix={topDropdownLabel}
          labelFallback={isSectorDataRoute ? activeSector?.label ?? '' : activeMeta.label}
        />
        {metaBusy ? <span className="ticker-page__loading-pill">Loading…</span> : null}
      </div>

      {error ? (
        <div className="ticker-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="ticker-page__header-top">
          <div className="ticker-page__header-identity">
            
            <h1 className="ticker-page__company ticker-page__company--hero">
              {isSectorDataRoute ? `SP500 - ${activeMeta.label}` : activeMeta.label}
            </h1>
            <span className="ticker-page__header-identity-meta">
              <IconFlagUs className="ticker-page__flag" />
              <span className="ticker-page__exchange">{displaySym}</span>
            </span>
            <ChartInfoTip tip={CHART_INFO_TIPS.indexHeaderPrice} align="start" />
          </div>
          <div className="ticker-page__header-actions">
            
            <button type="button" className="ticker-outline-btn" onClick={onAddTickerToWatchlist}>
              <IconPlus className="ticker-outline-btn__ico" /> In My Watchlists
            </button>
          </div>
        </div>

        <div className="ticker-page__header-metrics" role="presentation">
          <div className="ticker-page__header-metric">
            <div className="ticker-page__metric-price-line">
              <span className="ticker-page__sym">{displaySym}</span>
              <span className="ticker-page__px ticker-page__px--hero">{fmtPrice(headerClose)}</span>
              <span className="ticker-page__ccy">USD</span>
            </div>
            <div className="ticker-page__index-metric-footer">
              <div className="ticker-page__metric-change">
                {headerChgPct != null && Number.isFinite(headerChgPct) ? (
                  <span className={'ticker-num ' + pctClass(headerChgPct)}>
                    {headerChgAbs != null && Number.isFinite(headerChgAbs) ? (
                      <>{fmtAbsSigned(headerChgAbs)} </>
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
              <span className="ticker-page__metric-value">Related ETF</span>
              {/* <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>seriesMode</strong>{' '}
                  {isSectorDataRoute
                    ? 'Sector view uses ticker returns and OHLC for the selected SPDR sector ETF.'
                    : 'from index-returns: official single-ticker path vs synthetic constituents.'}
                </p>
              </DataInfoTip> */}
            </div>
            {indexHeaderTickerMeta.to ? (
              <Link
                to={indexHeaderTickerMeta.to}
                className="ticker-page__metric-label ticker-page__metric-label--link"
                title={`Open ${indexHeaderTickerMeta.symbol} on ticker page`}
              >
                {indexHeaderTickerMeta.label}
              </Link>
            ) : (
              <p className="ticker-page__metric-label">{indexHeaderTickerMeta.label}</p>
            )}
          </div>

          <div className="ticker-page__header-metric">
            <div className="ticker-page__metric-value-row">
              <span className="ticker-page__metric-value">{isSectorDataRoute ? 'S&P 500' : ""}</span>
            </div>
            <p className="ticker-page__metric-label">{isSectorDataRoute ? 'Constituent universe' : ''}</p>
          </div>

        </div>
      </header>

      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <div className="ticker-page__stack-column">
          <section className="ticker-card ticker-card--main-chart" aria-labelledby="index-snapshot-chart-title">
            <div className="ticker-card__head">
              <div className="ticker-page__search-row">
                <ChartTypeToolbarDropdown chartType={mainChartType} onChartTypeChange={setMainChartType} />
                {metaBusy ? <span className="ticker-page__loading-pill">Loading chart…</span> : null}
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
              <div className="ticker-tf-with-tip">
                <div className="ticker-tf-row">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      className={
                        'ticker-tf' + (!appliedCustomRange && tf === timeframe ? ' ticker-tf--active' : '')
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
                    className={'ticker-tf' + (appliedCustomRange || isCustomRangePopupOpen ? ' ticker-tf--active' : '')}
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
                    aria-labelledby="index-custom-range-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="wl-manage-modal__head">
                      <h3 id="index-custom-range-title" className="wl-manage-modal__title">
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
                    <span className="ticker-chart-legend__sym">{displaySym}</span>
                    <span className="ticker-chart-legend__name">{activeMeta.label}</span>
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
                
                {/* <span className="ticker-chart-legend__sigs">Signal: {lastSignal}</span> */}
                  {chartHoverOhlc ? (
                    <span className="ticker-chart-legend__sigs ticker-chart-legend__ohlc-hover">
                      O:{chartHoverOhlc.open != null ? fmtPrice(chartHoverOhlc.open) : '—'} H:{chartHoverOhlc.high != null ? fmtPrice(chartHoverOhlc.high) : '—'} L:{chartHoverOhlc.low != null ? fmtPrice(chartHoverOhlc.low) : '—'} C:{chartHoverOhlc.close != null ? fmtPrice(chartHoverOhlc.close) : '—'}
                      {chartHoverOhlc.volume != null ? ` Vol:${fmtNumber(Math.round(chartHoverOhlc.volume))}` : ''}
                    </span>
                  ) : null}
              </div>
              <div
                ref={chartPlotHostRef}
                className={'ticker-chart-plot-host' + (chartFs ? ' ticker-chart-plot-host--fs' : '')}
              >
                {metaBusy && sortedChart.length === 0 ? (
                  <div
                    className="chart-viz-loading-wrap"
                    style={{
                      minHeight: chartFs && fsPlotH >= chartHeightMin ? fsPlotH : basePixelHeight
                    }}
                  >
                    <TradingChartLoader
                      label="Loading chart…"
                      sublabel={`${displaySym} · ${activeMeta.label}`}
                    />
                  </div>
                ) : sortedChart.length ? (
                  <TickerLightweightChart
                    rows={sortedChart}
                    height={plotHeight}
                    chartType={mainChartType}
                    onHoverOhlcChange={setChartHoverOhlc}
                  />
                ) : (
                  <div className="ticker-sparkline ticker-sparkline--empty">No rows in this range.</div>
                )}
              </div>
              {!chartFs ? (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-valuemin={chartHeightMin}
                  aria-valuemax={CHART_H_MAX}
                  aria-valuenow={basePixelHeight}
                  className="ticker-chart-resize"
                  title="Drag to resize chart height. Double-click to reset."
                  onPointerDown={onChartResizePointerDown}
                  onDoubleClick={onChartResizeDoubleClick}
                />
              ) : null}
            </div>
          </section>

          <section className="ticker-card ticker-card--news" aria-labelledby="index-news-h">
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
                    id="index-news-h"
                    className="ticker-subh ticker-subh--flex"
                    onClick={onOpenNewsPage}
                  >
                    News
                  </ReturnsChartClickableHeading>
                  <ChartInfoTip tip={CHART_INFO_TIPS.indexNews} align="start" />
                </div>
              </div>
            </div>
            {newsBusy ? <p className="ticker-page__news-sample-note">Loading ticker news…</p> : null}
            {!newsBusy && newsError ? <p className="ticker-page__news-sample-note">{newsError}</p> : null}
            {!newsBusy && !newsError && !liveNews.length ? (
              <p className="ticker-page__news-sample-note">No ticker headlines yet.</p>
            ) : null}
            <ul className="ticker-news-list">
              {newsPageItems.map((n) => (
                <li key={n.id} className="ticker-news-list__li">
                  <a
                    className="ticker-news-list__a"
                    href={n.url || '#index-news-h'}
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
              <NewsSectionPagination
                page={newsPageSafe}
                totalPages={newsTotalPages}
                onPageChange={setNewsPage}
                ariaLabel="News pagination"
              />
            ) : null}
          </section>
          </div>

          <aside className="ticker-page__aside index-page__aside-stack">
          {/* <section className="ticker-card ticker-card--signal" aria-labelledby="index-odin-signal-h">
            <div className="ticker-signal-head">
              <span className="ticker-signal-logo" aria-hidden />
              <h2 className="ticker-card__h ticker-card__h--inline" id="index-odin-signal-h">
                Odin Signal
              </h2>
              <ChartInfoTip tip={CHART_INFO_TIPS.indexSignalPlaceholder} align="start" />
            </div>
            <p className="ticker-signal-asof">As of {lastUpdatedFmt}</p>
            <div className="ticker-signal-lanes" role="list">
              {[
                { k: 'L1', tone: 'green-dark' },
                { k: 'L2', tone: 'green-dark' },
                { k: 'L3', tone: 'green-bright' },
                { k: 'S1', tone: 'orange' },
                { k: 'S2', tone: 'orange-mid' },
                { k: 'S3', tone: 'amber' },
                { k: 'N', tone: 'gray' }
              ].map((s) => (
                <div
                  key={s.k}
                  className={
                    'ticker-signal-cell ticker-signal-cell--' +
                    s.tone +
                    (activeBucket === s.k ? ' ticker-signal-cell--active' : '')
                  }
                  role="listitem"
                >
                  {s.k}
                </div>
              ))}
            </div>
            <div className="ticker-signal-foot">
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
            </div>
          </section> */}

          <section className="mkt-mini-card index-aside-mini" aria-labelledby="index-constituents-h">
            <header className="mkt-mini-card__head">
              <span className="mkt-mini-card__k" id="index-constituents-h">
                {isSectorDataRoute ? (
                  <>
                    {activeSector ? `${activeSector.label.toUpperCase()} · S&P 500` : 'SECTOR · S&P 500'}
                    {!indexTickersBusy ? ` · [${indexTickersRows.length}]` : null}
                  </>
                ) : (
                  <>
                    {activeMeta.label}
                    <span className="mkt-mini-card__k"> Constituents</span>
                  </>
                )}
              </span>
              <span className="mkt-mini-card__head-actions">
                <ChartInfoTip
                  tip={getIndexConstituentsTip({
                    isSector: isSectorDataRoute,
                    sectorLabel: activeSector?.label
                  })}
                  align="start"
                />
              </span>
            </header>
            <div className="index-constituents-card index-constituents-card--mkt">
              <div className="index-constituents-table-wrap">
                <table className="index-constituents-table">
                  <thead>
                    <tr className="index-constituents-sort-head">
                      <th scope="col">
                        <button
                          type="button"
                          className="mkt-watch-card__th"
                          onClick={() => onIndexConstituentsSort('name')}
                          aria-sort={indexConstituentsAriaSort('name')}
                          title="Sort by name"
                        >
                          Name
                          <span className={indexConstituentsSortIcoClass('name')} aria-hidden>
                            {indexConstituentsSortGlyph('name')}
                          </span>
                        </button>
                      </th>
                      <th scope="col">
                        <button
                          type="button"
                          className="mkt-watch-card__th mkt-watch-card__th--num"
                          onClick={() => onIndexConstituentsSort('close')}
                          aria-sort={indexConstituentsAriaSort('close')}
                          title="Sort by close price"
                        >
                          Close
                          <span className={indexConstituentsSortIcoClass('close')} aria-hidden>
                            {indexConstituentsSortGlyph('close')}
                          </span>
                        </button>
                      </th>
                      <th scope="col">
                        <button
                          type="button"
                          className="mkt-watch-card__th mkt-watch-card__th--num"
                          onClick={() => onIndexConstituentsSort('pct')}
                          aria-sort={indexConstituentsAriaSort('pct')}
                          title="Sort by return percent"
                        >
                          Return %
                          <span className={indexConstituentsSortIcoClass('pct')} aria-hidden>
                            {indexConstituentsSortGlyph('pct')}
                          </span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexTickersDisplayRows.map((row, idx) => (
                      <tr key={`${row.symbol}-${idx}`}>
                        <td>
                          <button
                            type="button"
                            className="index-constituents-link"
                            onClick={() =>
                              navigate(`/ticker/${encodeURIComponent(row.symbol)}?ticker=${encodeURIComponent(row.symbol)}`)
                            }
                          >
                            {row.symbol}
                          </button>
                        </td>
                        <td>{fmtPrice(row.close)}</td>
                        <td className={pctClass(row.ret1d)}>{fmtPctSigned(row.ret1d)}</td>
                      </tr>
                    ))}
                    {!indexTickersBusy && !indexTickersDisplayRows.length ? (
                      <tr>
                        <td colSpan={3} className="index-constituents-empty">
                          No constituents found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {indexTickersBusy ? <p className="ticker-page__news-sample-note">Loading constituents…</p> : null}
              </div>
              {indexTickersTotalPages > 1 && !isSectorDataRoute ? (
                <div className="index-constituents-pagination">
                  <FigmaPagination
                    className="index-constituents-pagination__pager"
                    page={indexTickersPageSafe}
                    totalPages={indexTickersTotalPages}
                    onPageChange={setIndexTickersPage}
                    siblingCount={0}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="mkt-mini-card index-aside-mini" aria-labelledby="index-other-indices-h">
            <header className="mkt-mini-card__head">
              <span className="mkt-mini-card__k" id="index-other-indices-h">
                {isSectorDataRoute ? 'Other sectors' : 'Other indices'}
              </span>
            </header>
            <div className="index-aside-mini__body">
              <p className={'ticker-kd-comp' + (isSectorDataRoute ? ' index-other-sectors-list' : '')}>
                {relatedIndexLinks.length ? (
                  relatedIndexLinks.map((x) => (
                    <Link key={x.slug} to={x.to} className="ticker-kd-comp__a">
                      {x.label}
                    </Link>
                  ))
                ) : (
                  <span className="ticker-page__muted">—</span>
                )}
              </p>
            </div>
          </section>

          <section className="mkt-mini-card index-aside-mini" aria-labelledby="index-rel-perf-h">
            <header className="mkt-mini-card__head">
              <span className="mkt-mini-card__k" id="index-rel-perf-h">
                Relative performance
                <span className="mkt-mini-card__tf">%</span>
              </span>
              <span className="mkt-mini-card__head-actions">
                <ChartInfoTip tip={CHART_INFO_TIPS.indexMtdQtd} align="start" />
              </span>
            </header>
            <div className="index-aside-mini__body">
              <div className="ticker-compare">
                <div className="ticker-compare__head">
                  <span />
                  <span>{displaySym}</span>
                  <span>{BENCHMARK}</span>
                  <span>Diff</span>
                </div>
                {indexPerfCompareRows.map((row) => (
                    <div key={row.key} className="ticker-compare__row">
                      <span className="ticker-compare__tf">{row.key}</span>
                      <span className={'ticker-compare__cell ' + pctClass(row.leftPct)}>{formatRelativePerfPct(row.leftPct)}</span>
                      <span className={'ticker-compare__cell ' + pctClass(row.rightPct)}>{formatRelativePerfPct(row.rightPct)}</span>
                      <span className={'ticker-compare__cell ' + pctClass(row.diff)}>{formatRelativePerfPct(row.diff)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </section>
          </aside>

          <TickerAnnualReturnsFigma
            symbol={displaySym}
            annualReturns={annualReturnsForChart}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_ANNUAL_FIGMA}
            resizeDefaultHeight={260}
            enableInlineYearDropdowns
            defaultStartYear={2017}
            defaultEndYear={2026}
            loading={metaBusy}
            hideStatsSection
          />
          <TickerAnnualReturnsFigma
            symbol={displaySym}
            annualReturns={quarterlyReturnsForChart}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_QUARTERLY_FIGMA}
            resizeDefaultHeight={260}
            periodMode="quarterly"
            enableInlineYearDropdowns
            defaultStartYear={2023}
            defaultEndYear={2026}
            loading={metaBusy}
            hideStatsSection
          />
          <TickerMonthlyReturnsChart
            symbol={displaySym}
            monthlyReturns={monthlyReturnsRaw}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_MONTHLY_RETURNS}
            resizeDefaultHeight={278}
            suppressChartDateFilter
            useThemedYearDropdown
            defaultToLatestYear
            loading={metaBusy}
          />
          <section className="ticker-card ticker-card--rs-benchmark" aria-labelledby="index-rs-selector-h">
            <div className="ticker-subh-with-tip ticker-subh-with-tip--in-card ticker-rs-selector-head">
              <div className="ticker-rs-selector-head__left">
                <div className="flex shrink-0 align-centers">
                  <ReturnsChartPieIcon />
                </div>
                <div className="ticker-subh-left">
                  <ReturnsChartClickableHeading
                    id="index-rs-selector-h"
                    className="ticker-subh ticker-subh--flex"
                    onClick={onOpenRelativeStrengthPage}
                  >
                    Relative Strength
                  </ReturnsChartClickableHeading>
                  <ChartInfoTip tip={CHART_INFO_TIPS.indexRelativeStrength} align="start" />
                </div>
              </div>
              <div className="ticker-rs-selector-head__right">
                <ReturnsChartToolbar
                  className="ticker-rs-selector-head__toolbar"
                  rangeControls={
                    <div className="ticker-rs-controls ticker-rs-controls--inline">
                      <ThemedDropdown
                        wideLabel
                        style={{ minWidth: 0, maxWidth: '100%' }}
                        value={relativeLeftKey}
                        options={RELATIVE_STRENGTH_DROPDOWN_OPTIONS}
                        onChange={setRelativeLeftKey}
                        title="Relative strength left"
                        ariaLabelPrefix="Left index"
                        labelFallback={RELATIVE_STRENGTH_OPTIONS.find((o) => o.key === relativeLeftKey)?.label ?? ''}
                      />
                      <ThemedDropdown
                        wideLabel
                        style={{ minWidth: 0, maxWidth: '100%' }}
                        value={relativeRightKey}
                        options={RELATIVE_STRENGTH_DROPDOWN_OPTIONS}
                        onChange={setRelativeRightKey}
                        title="Relative strength right"
                        ariaLabelPrefix="Right index"
                        labelFallback={RELATIVE_STRENGTH_OPTIONS.find((o) => o.key === relativeRightKey)?.label ?? 'S&P 500'}
                      />
                    </div>
                  }
                  onViewMore={onOpenRelativeStrengthPage}
                  showViewMore={false}
                  showTableToggle={false}
                  showDownload={false}
                  
                />
              </div>
            </div>
            <TickerSection16Section17
              rows={section16Rows}
              compareRows={section17CompareRows}
              relativeStrengthTitle={`Relative Strength vs ${relativeRightLabel}`}
              relativeStrengthHeader={`Relative Strength (${relativeLeftLabel} - ${relativeRightLabel})`}
              barChartVariant="diff"
              comparisonLegendDiffLabel={`${relativeLeftLabel}-${relativeRightLabel}`}
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
        titleId="index-chart-export-modal-title"
        previewAlt={`Exported chart for ${displaySym}`}
        shareLabel={`${displaySym} index chart`}
        exportFilename={chartExportFilename}
      />
    </div>
  );
}
