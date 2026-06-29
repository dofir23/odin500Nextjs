'use client';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from '@/navigation/appRouterCompat.jsx';
import { ChartInfoTip } from '../components/ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from '../components/chartInfoTips.js';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerAnnualReturnsPosNeg } from '../components/TickerAnnualReturnsPosNeg.jsx';
import { TickerMonthlyReturnsChart } from '../components/TickerMonthlyReturnsChart.jsx';
import { TickerMonthlyReturnsWaterfallDonut } from '../components/TickerMonthlyReturnsWaterfallDonut.jsx';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { AnnualReturnBarChart } from '../components/AnnualReturnBarChart.jsx';
import { ExcessReturnLineChart } from '../components/ExcessReturnLineChart.jsx';
import { PeriodicReturnBarChart } from '../components/PeriodicReturnBarChart.jsx';
import {fetchJsonCached, getAuthToken, canFetchMarketData} from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { isoYearWeekFromIsoDate } from '../utils/isoWeek.js';
import { pickRelatedByCategory, RELATED_INDEX_LINKS } from '../utils/relatedTickers.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { alignComparisonRows, filterRowsByDateRange, filterRowsByYearRange, normalizePeriodReturnsRows } from '../utils/statisticsComparisonSeries.js';
import { formatRelativePerfPct } from '../utils/marketCalculations.js';
import { fmtPctSigned, fmtPrice, fmtVolumeCompact } from '../utils/formatDisplayNumber.js';
import {
  alphaProfileIrlink,
  fetchCompanyOverviewCached,
  fmtCompact,
  getCompanyProfileApiKeyPresent,
  numOrNull
} from '../utils/companyOverviewProfile.js';
import { MonthlySeasonalitySection } from '../components/MonthlySeasonalitySection.jsx';
import { buildMonthlySeasonality } from '../utils/buildMonthlySeasonality.js';
import {
  applyDateEndChange,
  applyDateStartChange,
  applyYearEndChange,
  applyYearStartChange,
  coerceDateRange,
  dateInputBounds,
  yearOptionsForEnd,
  yearOptionsForStart
} from '../utils/dateRangeConstraints.js';
import '../styles/ticker-report.css';

const RESIZE_KEY_M_FIGMA = 'odin_ticker_monthly_resize_figma';
const RESIZE_KEY_M_POSNEG = 'odin_ticker_monthly_resize_posneg';
const RESIZE_KEY_M_MAIN = 'odin_ticker_monthly_resize_main';
const RESIZE_KEY_M_WF = 'odin_ticker_monthly_resize_waterfall';
const RETURNS_DEFAULT_START = '1980-01-01';
const DEFAULT_MONTHLY_START_YEAR = 2021;
const DEFAULT_MONTHLY_END_YEAR = 2026;
/** One full calendar year: prior year (e.g. 2025 when the current year is 2026). */
const DEFAULT_WEEKLY_YEAR = Math.max(1980, new Date().getFullYear() - 1);
const DEFAULT_WEEKLY_START_YEAR = DEFAULT_WEEKLY_YEAR;
const DEFAULT_WEEKLY_END_YEAR = DEFAULT_WEEKLY_YEAR;
const BENCHMARK = 'SPY';
const BENCHMARK_OPTIONS = ['SPY', 'QQQ', 'DIA'].map((v) => ({ id: v, label: v }));
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
const TABLE_PAGE_SIZE = 30;
const PAGER_SIBLING_COUNT = 1;
const TABLE_RANGE_YEARS = { '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10, '15Y': 15, '20Y': 20 };
const DEFAULT_TABLE_RANGE_PRESET = '3Y';
const TABLE_RANGE_DROPDOWN_OPTIONS = [
  { id: '1Y', label: '1Y' },
  { id: '3Y', label: '3Y' },
  { id: '5Y', label: '5Y' },
  { id: '10Y', label: '10Y' },
  { id: '15Y', label: '15Y' },
  { id: '20Y', label: '20Y' },
];

function minMaxDailyPeriod(rows) {
  let min = '';
  let max = '';
  if (!Array.isArray(rows)) return { min, max };
  for (const r of rows) {
    const p = String(r?.period ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) continue;
    if (!min || p < min) min = p;
    if (!max || p > max) max = p;
  }
  return { min, max };
}

function defaultDailyFetchRange(endIso) {
  const end = String(endIso || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const d = new Date(end + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return { start: '', end: '' };
  d.setMonth(d.getMonth() - 1);
  return { start: d.toISOString().slice(0, 10), end };
}

function normalizeDailyPair(prev, field, rawValue) {
  const v = String(rawValue ?? '').slice(0, 10);
  const start = field === 'start' ? v : String(prev.start ?? '').slice(0, 10);
  const end = field === 'end' ? v : String(prev.end ?? '').slice(0, 10);
  return coerceDateRange(start, end);
}

const DAILY_CHART_DATE_INPUT_CLASS =
  'app-date-input h-7 w-[110px] shrink-0 rounded-md border border-slate-400/45 bg-white px-1 py-0 text-[11px] leading-7 text-slate-900 shadow-sm outline-none focus:border-sky-500/80 dark:border-white/12 dark:bg-transparent dark:text-slate-100 dark:focus:border-sky-400/60';

/** Compact start/end dates for daily charts (same row as toolbar buttons; applies on change). */
function DailyChartDateRangeToolbar({ draft, pickerMax, onChangeStart, onChangeEnd }) {
  const bounds = dateInputBounds(draft.start, draft.end, {
    globalMin: RETURNS_DEFAULT_START,
    globalMax: pickerMax || undefined
  });
  return (
    <div className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 self-center mr-2" aria-label="Daily returns date range">
      <label className="inline-flex items-center gap-1.5">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Start
        </span>
        <input
          type="date"
          className={DAILY_CHART_DATE_INPUT_CLASS}
          value={draft.start}
          min={bounds.startMin}
          max={bounds.startMax}
          onChange={onChangeStart}
        />
      </label>
      <label className="inline-flex items-center gap-1.5">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          End
        </span>
        <input
          type="date"
          className={DAILY_CHART_DATE_INPUT_CLASS}
          value={draft.end}
          min={bounds.endMin}
          max={bounds.endMax}
          onChange={onChangeEnd}
        />
      </label>
    </div>
  );
}

function pctTone(v) {
  if (v == null || !Number.isFinite(Number(v))) return 'statistic-data__ret statistic-data__ret--flat';
  if (Number(v) > 0) return 'statistic-data__ret statistic-data__ret--up';
  if (Number(v) < 0) return 'statistic-data__ret statistic-data__ret--down';
  return 'statistic-data__ret statistic-data__ret--flat';
}
function pctClass(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  if (Number(n) > 0) return 'ticker-num--up';
  if (Number(n) < 0) return 'ticker-num--down';
  return '';
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
function sortRowsAsc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = rowDateToTimeKey(a);
    const tb = rowDateToTimeKey(b);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

function mapWeeklyRowsToReturns(weekly) {
  const rows = Array.isArray(weekly) ? weekly : [];
  return rows
    .map((r) => {
      const open = Number(r?.Open ?? r?.open);
      const close = Number(r?.Close ?? r?.close);
      let yearNum = Number(r?.year);
      let weekNum = Number(r?.week);
      const endDateRaw = String(r?.end_date ?? r?.Date ?? r?.date ?? '');
      const startDateRaw = String(r?.start_date ?? '');
      const weekStartRaw = String(r?.week_start ?? '');
      const startDate = startDateRaw.slice(0, 10);
      const endDate = endDateRaw.slice(0, 10);
      const weekStart = weekStartRaw.slice(0, 10);
      const period =
        endDate ||
        startDate ||
        weekStart ||
        (Number.isFinite(yearNum) && Number.isFinite(weekNum) && weekNum >= 1 && weekNum <= 53
          ? `${yearNum}-W${String(weekNum).padStart(2, '0')}`
          : '');
      const fallbackIw = endDate ? isoYearWeekFromIsoDate(endDate) : null;
      if ((!Number.isFinite(yearNum) || !Number.isFinite(weekNum)) && fallbackIw) {
        yearNum = fallbackIw.year;
        weekNum = fallbackIw.week;
      }
      if (!period || !Number.isFinite(open) || !Number.isFinite(close) || open === 0) return null;
      return {
        period,
        startDate: startDate || endDate,
        endDate: endDate || startDate,
        startPrice: open,
        endPrice: close,
        totalReturn: ((close - open) / open) * 100,
        isoYear: Number.isFinite(yearNum) ? yearNum : null,
        isoWeek: Number.isFinite(weekNum) ? weekNum : null
      };
    })
    .filter(Boolean);
}

function mapDailyRowsToReturns(rawRows) {
  const sorted = sortRowsAsc(rawRows);
  const mapped = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = pickNum(sorted[i - 1], ['Close', 'close']);
    const next = pickNum(sorted[i], ['Close', 'close']);
    const iso = rowDateToTimeKey(sorted[i]);
    if (!iso || prev == null || next == null || prev === 0) continue;
    mapped.push({
      period: iso,
      startDate: rowDateToTimeKey(sorted[i - 1]) || '',
      endDate: iso,
      startPrice: prev,
      endPrice: next,
      totalReturn: ((next - prev) / prev) * 100
    });
  }
  return mapped;
}

/** Map SSR periodic payload rows into chart/table return rows. */
function seedPeriodicReturns(ssrSeed, periodMode) {
  if (!ssrSeed) return { primary: [], benchmark: [] };
  if (periodMode === 'monthly') {
    return {
      primary: Array.isArray(ssrSeed.primaryReturnsRaw) ? ssrSeed.primaryReturnsRaw : [],
      benchmark: Array.isArray(ssrSeed.benchmarkReturnsRaw) ? ssrSeed.benchmarkReturnsRaw : []
    };
  }
  if (periodMode === 'weekly') {
    return {
      primary: mapWeeklyRowsToReturns(ssrSeed.primaryReturnsRaw),
      benchmark: mapWeeklyRowsToReturns(ssrSeed.benchmarkReturnsRaw)
    };
  }
  if (periodMode === 'daily') {
    return {
      primary: mapDailyRowsToReturns(ssrSeed.primaryReturnsRaw),
      benchmark: mapDailyRowsToReturns(ssrSeed.benchmarkReturnsRaw)
    };
  }
  return { primary: [], benchmark: [] };
}
function parseYear(period) {
  const m = String(period || '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function monthPeriodOrderKey(row) {
  const end = row?.endDate && String(row.endDate).slice(0, 10);
  if (end && !Number.isNaN(Date.parse(end))) return Date.parse(end);
  const start = row?.startDate && String(row.startDate).slice(0, 10);
  if (start && !Number.isNaN(Date.parse(start))) return Date.parse(start);
  const y = row?.year;
  if (Number.isFinite(y)) return y * 100;
  return 0;
}
function signalBucket(sig) {
  const s = String(sig || 'N').trim().toUpperCase();
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
  for (let i = 1; i < closes.length; i += 1) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) lr.push(Math.log(b / a));
  }
  if (lr.length < 2) return null;
  const mean = lr.reduce((s, x) => s + x, 0) / lr.length;
  const varSample = lr.reduce((s, x) => s + (x - mean) ** 2, 0) / (lr.length - 1);
  return Math.round(Math.sqrt(varSample) * Math.sqrt(252) * 100 * 10) / 10;
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
  const lastIso = rowDateToTimeKey(sortedAsc[sortedAsc.length - 1]);
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
  const lastIso = rowDateToTimeKey(sortedAsc[sortedAsc.length - 1]);
  if (!lastIso) return null;
  const lastD = new Date(lastIso + 'T12:00:00');
  const q = Math.floor(lastD.getMonth() / 3);
  const qStart = new Date(lastD.getFullYear(), q * 3, 1);
  return periodReturnFromRows(sortedAsc, (r) => {
    const iso = rowDateToTimeKey(r);
    return iso ? new Date(iso + 'T12:00:00') >= qStart : false;
  });
}
function IconTrendUp({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
<path d="M18.3332 5.83301L11.776 12.3902C11.446 12.7202 11.281 12.8852 11.0907 12.947C10.9233 13.0014 10.743 13.0014 10.5757 12.947C10.3854 12.8852 10.2204 12.7202 9.89036 12.3902L7.60931 10.1091C7.2793 9.77914 7.11429 9.61413 6.92402 9.55231C6.75665 9.49792 6.57636 9.49792 6.40899 9.55231C6.21872 9.61413 6.05371 9.77914 5.72369 10.1092L1.6665 14.1663M18.3332 11.6663V5.83301H12.4998" stroke="#38C35B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );
}
function IconTrendDown({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
<path d="M18.3332 14.1663L11.776 7.60915C11.446 7.27914 11.281 7.11413 11.0907 7.05231C10.9233 6.99792 10.743 6.99792 10.5757 7.05231C10.3854 7.11413 10.2204 7.27914 9.89036 7.60915L7.60931 9.8902C7.2793 10.2202 7.11429 10.3852 6.92402 10.447C6.75665 10.5014 6.57636 10.5014 6.40899 10.447C6.21872 10.3852 6.05371 10.2202 5.72369 9.8902L1.6665 5.83301M18.3332 8.33301V14.1663H12.4998" stroke="#FA4C60" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );
}

function buildPaginationItems(totalPages, currentPage, siblingCount = PAGER_SIBLING_COUNT) {
  if (totalPages <= 1) return [1];
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) return Array.from({ length: totalPages }, (_, i) => i + 1);
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

function IconChevronLeft({ double = false }) {
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

function IconChevronRight({ double = false }) {
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

function FigmaPagination({ page, totalPages, onPageChange }) {
  const items = useMemo(() => buildPaginationItems(totalPages, page), [totalPages, page]);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div className="statistic-data__pager-figma" role="navigation" aria-label="Table pagination">
      <button type="button" className="statistic-data__pg-btn statistic-data__pg-btn--icon" aria-label="First page" onClick={() => onPageChange(1)} disabled={!canPrev}>
        <IconChevronLeft double />
      </button>
      <button type="button" className="statistic-data__pg-btn statistic-data__pg-btn--icon" aria-label="Previous page" onClick={() => onPageChange(page - 1)} disabled={!canPrev}>
        <IconChevronLeft />
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
      <button type="button" className="statistic-data__pg-btn statistic-data__pg-btn--icon" aria-label="Next page" onClick={() => onPageChange(page + 1)} disabled={!canNext}>
        <IconChevronRight />
      </button>
      <button type="button" className="statistic-data__pg-btn statistic-data__pg-btn--icon" aria-label="Last page" onClick={() => onPageChange(totalPages)} disabled={!canNext}>
        <IconChevronRight double />
      </button>
    </div>
  );
}

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').PeriodicTickerInitialData | null} [props.initialData]
 * @param {'monthly' | 'weekly' | 'daily'} [props.periodMode]
 */
export default function TickerMonthlyPage({ periodMode = 'monthly', initialData = null }) {
  const isWeekly = periodMode === 'weekly';
  const isDaily = periodMode === 'daily';
  const modeLabel = isWeekly ? 'Weekly' : isDaily ? 'Daily' : 'Monthly';
  const modeSlug = isWeekly ? 'weekly' : isDaily ? 'daily' : 'monthly';
  const { symbol: symbolParam } = useParams();
  const navigate = useNavigate();
  const routeSym = sanitizeTickerPageInput(symbolParam) || 'AAPL';
  const ssrSeed =
    initialData?.symbol &&
    initialData.periodMode === periodMode &&
    String(initialData.symbol).toUpperCase() === String(routeSym).toUpperCase()
      ? initialData
      : null;
  const seededReturns = seedPeriodicReturns(ssrSeed, periodMode);
  const hasSeededReturns = seededReturns.primary.length > 0;
  const [sym, setSym] = useState(() => routeSym);
  const [loading, setLoading] = useState(() => !hasSeededReturns);
  const [error, setError] = useState('');
  const [benchmarkIndex, setBenchmarkIndex] = useState(BENCHMARK);
  const [asOfDate, setAsOfDate] = useState(() => ssrSeed?.asOfDate || new Date().toISOString().slice(0, 10));
  const [monthlyReturnsRaw, setMonthlyReturnsRaw] = useState(() => seededReturns.primary);
  const [benchmarkReturnsRaw, setBenchmarkReturnsRaw] = useState(() => seededReturns.benchmark);
  const [dynamicSym, setDynamicSym] = useState(() => ssrSeed?.dynamicSym ?? []);
  const [dynamicSpy, setDynamicSpy] = useState(() => ssrSeed?.dynamicSpy ?? []);
  const [statsRows, setStatsRows] = useState(() =>
    ssrSeed?.statsRows?.length ? sortRowsAsc(ssrSeed.statsRows) : []
  );
  const [statsRowsSpy, setStatsRowsSpy] = useState(() =>
    ssrSeed?.statsRowsSpy?.length ? sortRowsAsc(ssrSeed.statsRowsSpy) : []
  );
  const [detailRows, setDetailRows] = useState([]);
  const [chartStartYear, setChartStartYear] = useState(String(DEFAULT_MONTHLY_START_YEAR));
  const [chartEndYear, setChartEndYear] = useState(String(DEFAULT_MONTHLY_END_YEAR));
  const [weeklyStartYear, setWeeklyStartYear] = useState(String(DEFAULT_WEEKLY_START_YEAR));
  const [weeklyEndYear, setWeeklyEndYear] = useState(String(DEFAULT_WEEKLY_END_YEAR));
  const [tableRange, setTableRange] = useState(DEFAULT_TABLE_RANGE_PRESET);
  const [tableSort, setTableSort] = useState({ column: 'period', direction: 'desc' });
  const [tablePage, setTablePage] = useState(1);
  const [dailyFilter, setDailyFilter] = useState(() =>
    defaultDailyFetchRange(new Date().toISOString().slice(0, 10))
  );
  const [dailyFilterDraft, setDailyFilterDraft] = useState(() =>
    defaultDailyFetchRange(new Date().toISOString().slice(0, 10))
  );
  const [dailyFetchRange, setDailyFetchRange] = useState(() =>
    defaultDailyFetchRange(new Date().toISOString().slice(0, 10))
  );
  const [companyOverview, setCompanyOverview] = useState(null);
  const [companyOverviewBusy, setCompanyOverviewBusy] = useState(false);
  const [companyOverviewExpanded, setCompanyOverviewExpanded] = useState(false);
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');

  useEffect(() => {
    const next = sanitizeTickerPageInput(symbolParam) || 'AAPL';
    setSym((prev) => (prev === next ? prev : next));
  }, [symbolParam]);


  const onSymbolChange = useCallback((next) => {
    const s = sanitizeTickerPageInput(next) || 'AAPL';
    setSym(s);
    navigate(`/statistic/ticker-${modeSlug}/` + encodeURIComponent(s));
  }, [navigate, modeSlug]);

  useEffect(() => {
    let cancelled = false;
    if (!canFetchMarketData()) {
      if (!hasSeededReturns) {
        setError('Unable to load ticker data.');
        setMonthlyReturnsRaw([]);
      }
      return () => { cancelled = true; };
    }
    if (ssrSeed && benchmarkIndex === BENCHMARK && hasSeededReturns) {
      return () => { cancelled = true; };
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const end = new Date().toISOString().slice(0, 10);
        const tickerU = String(sym || '').toUpperCase().trim();
        const body = { ticker: tickerU, customStartDate: RETURNS_DEFAULT_START, customEndDate: end };
        const fallbackDaily = defaultDailyFetchRange(end);
        const dailyStart = dailyFetchRange.start || fallbackDaily.start;
        const dailyEnd = dailyFetchRange.end || fallbackDaily.end;
        const oneYearStart = new Date(end + 'T12:00:00');
        oneYearStart.setFullYear(oneYearStart.getFullYear() - 1);
        const oneYearStartIso = oneYearStart.toISOString().slice(0, 10);
        const primaryReq = isWeekly
          ? fetchJsonCached({
            path: '/api/market/weekly-ohlc',
            method: 'POST',
            body: { ticker: tickerU, start_date: RETURNS_DEFAULT_START, end_date: end },
            ttlMs: 5 * 60 * 1000
          })
          : isDaily
            ? fetchJsonCached({
              path: `/api/market/ohlc?symbol=${encodeURIComponent(tickerU)}&start_date=${encodeURIComponent(dailyStart)}&end_date=${encodeURIComponent(dailyEnd)}&limit=400`,
              method: 'GET',
              ttlMs: 5 * 60 * 1000
            })
          : fetchJsonCached({ path: '/api/market/ticker-monthly-returns', method: 'POST', body, ttlMs: 5 * 60 * 1000 });
        const benchmarkReq = isWeekly
          ? fetchJsonCached({
            path: '/api/market/weekly-ohlc',
            method: 'POST',
            body: { ticker: benchmarkIndex, start_date: RETURNS_DEFAULT_START, end_date: end },
            ttlMs: 5 * 60 * 1000
          })
          : isDaily
            ? fetchJsonCached({
              path: `/api/market/ohlc?symbol=${encodeURIComponent(benchmarkIndex)}&start_date=${encodeURIComponent(dailyStart)}&end_date=${encodeURIComponent(dailyEnd)}&limit=400`,
              method: 'GET',
              ttlMs: 5 * 60 * 1000
            })
            : fetchJsonCached({
              path: '/api/market/ticker-monthly-returns',
              method: 'POST',
              body: { ...body, ticker: benchmarkIndex },
              ttlMs: 5 * 60 * 1000
            });
        const [mRes, mBenchRes, coreSymRes, coreSpyRes, ohlcSymRes, ohlcSpyRes, detailsRes] = await Promise.all([
          primaryReq,
          benchmarkReq,
          fetchJsonCached({ path: '/api/market/ticker-core-returns', method: 'POST', body, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/ticker-core-returns', method: 'POST', body: { ...body, ticker: benchmarkIndex }, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({ path: `/api/market/ohlc?symbol=${encodeURIComponent(tickerU)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`, method: 'GET', ttlMs: 10 * 60 * 1000 }),
          fetchJsonCached({ path: `/api/market/ohlc?symbol=${encodeURIComponent(benchmarkIndex)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`, method: 'GET', ttlMs: 10 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/ticker-details', method: 'POST', body: { index: 'sp500', period: 'last-1-year' }, ttlMs: 30 * 60 * 1000 })
        ]);
        if (cancelled) return;
        const perf = mRes?.data?.performance || {};
        const coreSymPerf = coreSymRes?.data?.performance || {};
        const coreSpyPerf = coreSpyRes?.data?.performance || {};
        if (isWeekly) {
          setMonthlyReturnsRaw(mapWeeklyRowsToReturns(mRes?.data?.weeklyOHLC));
          setBenchmarkReturnsRaw(mapWeeklyRowsToReturns(mBenchRes?.data?.weeklyOHLC));
        } else if (isDaily) {
          const rawRows = Array.isArray(mRes?.data?.data) ? mRes.data.data : Array.isArray(mRes?.data) ? mRes.data : [];
          console.info('[DailyReturns] API response rows', {
            symbol: tickerU,
            startDate: dailyStart,
            endDate: dailyEnd,
            rawRows: rawRows.length
          });
          const mapped = mapDailyRowsToReturns(rawRows);
          console.info('[DailyReturns] Mapped return rows', {
            symbol: tickerU,
            mappedRows: mapped.length
          });
          setMonthlyReturnsRaw(mapped);
          const benchRawRows = Array.isArray(mBenchRes?.data?.data)
            ? mBenchRes.data.data
            : Array.isArray(mBenchRes?.data)
              ? mBenchRes.data
              : [];
          setBenchmarkReturnsRaw(mapDailyRowsToReturns(benchRawRows));
        } else {
          setMonthlyReturnsRaw(Array.isArray(perf.monthlyReturns) ? perf.monthlyReturns : []);
          const perfBench = mBenchRes?.data?.performance || {};
          setBenchmarkReturnsRaw(Array.isArray(perfBench.monthlyReturns) ? perfBench.monthlyReturns : []);
        }
        setDynamicSym(Array.isArray(coreSymPerf.dynamicPeriods) ? coreSymPerf.dynamicPeriods : []);
        setDynamicSpy(Array.isArray(coreSpyPerf.dynamicPeriods) ? coreSpyPerf.dynamicPeriods : []);
        const symRows = Array.isArray(ohlcSymRes?.data?.data) ? ohlcSymRes.data.data : Array.isArray(ohlcSymRes?.data) ? ohlcSymRes.data : [];
        const spyRows = Array.isArray(ohlcSpyRes?.data?.data) ? ohlcSpyRes.data.data : Array.isArray(ohlcSpyRes?.data) ? ohlcSpyRes.data : [];
        setStatsRows(sortRowsAsc(symRows));
        setStatsRowsSpy(sortRowsAsc(spyRows));
        setDetailRows(Array.isArray(detailsRes?.data?.data) ? detailsRes.data.data : []);
        setAsOfDate(String(mRes?.data?.asOfDate || end).slice(0, 10));
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || `Failed to load ${modeSlug} returns`);
          setMonthlyReturnsRaw([]);
          setBenchmarkReturnsRaw([]);
          setDynamicSym([]);
          setDynamicSpy([]);
          setStatsRows([]);
          setStatsRowsSpy([]);
          setDetailRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sym, isWeekly, isDaily, modeSlug, dailyFetchRange.start, dailyFetchRange.end, benchmarkIndex, ssrSeed, hasSeededReturns]);

  useEffect(() => {
    let cancelled = false;
    setCompanyOverviewExpanded(false);
    if (!getCompanyProfileApiKeyPresent()) {
      setCompanyOverview(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setCompanyOverviewBusy(true);
      try {
        const payload = await fetchCompanyOverviewCached(sym);
        if (cancelled) return;
        setCompanyOverview(payload && typeof payload === 'object' ? payload : null);
      } catch {
        if (!cancelled) setCompanyOverview(null);
      } finally {
        if (!cancelled) setCompanyOverviewBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym]);

  const dailyReturnsForUi = useMemo(() => {
    if (!isDaily) return null;
    return filterReturnsRows(monthlyReturnsRaw, dailyFilter.start, dailyFilter.end);
  }, [isDaily, monthlyReturnsRaw, dailyFilter.start, dailyFilter.end]);

  const dailyLoadedRange = useMemo(
    () => (isDaily ? minMaxDailyPeriod(monthlyReturnsRaw) : { min: '', max: '' }),
    [isDaily, monthlyReturnsRaw]
  );

  const dailyShownRange = useMemo(
    () => (isDaily ? minMaxDailyPeriod(dailyReturnsForUi || []) : { min: '', max: '' }),
    [isDaily, dailyReturnsForUi]
  );

  const onDailyToolbarDateChange = useCallback(
    (field, rawValue) => {
      setDailyFilterDraft((prev) => {
        const norm = normalizeDailyPair(prev, field, rawValue);
        setDailyFilter(norm);
        if (isDaily) {
          const fallback = defaultDailyFetchRange(new Date().toISOString().slice(0, 10));
          setDailyFetchRange({
            start: norm.start || fallback.start,
            end: norm.end || fallback.end
          });
        }
        return norm;
      });
    },
    [isDaily]
  );

  useEffect(() => {
    const fallback = defaultDailyFetchRange(new Date().toISOString().slice(0, 10));
    setDailyFilter(fallback);
    setDailyFilterDraft(fallback);
    setDailyFetchRange(fallback);
  }, [sym]);

  useEffect(() => {
    if (!isDaily) return;
    const sync = (prev) => {
      if (prev.start && prev.end) return prev;
      const start = dailyFetchRange.start || '';
      const end = dailyFetchRange.end || '';
      if (!start || !end) return prev;
      return { start, end };
    };
    setDailyFilter(sync);
    setDailyFilterDraft(sync);
  }, [isDaily, dailyFetchRange.start, dailyFetchRange.end, monthlyReturnsRaw]);

  const monthYearOptions = useMemo(() => {
    const rows = Array.isArray(monthlyReturnsRaw) ? monthlyReturnsRaw : [];
    const years = Array.from(
      new Set(
        rows
          .map((r) => parseYear(r?.period))
          .filter((y) => Number.isFinite(y))
      )
    ).sort((a, b) => a - b);
    return years.length ? years : Array.from({ length: 2026 - 1980 + 1 }, (_, i) => 1980 + i);
  }, [monthlyReturnsRaw]);
  const weekYearOptions = useMemo(() => {
    if (!isWeekly) return [];
    const rows = Array.isArray(monthlyReturnsRaw) ? monthlyReturnsRaw : [];
    const fromData = Array.from(
      new Set(rows.map((r) => parseYear(r?.period)).filter((y) => Number.isFinite(y)))
    );
    const maxCal = Math.max(2026, new Date().getFullYear());
    const hi = Math.max(maxCal, ...(fromData.length ? fromData : [maxCal]));
    const lo = 1980;
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [isWeekly, monthlyReturnsRaw]);
  const monthYearDropdownOptions = useMemo(
    () =>
      [...monthYearOptions]
        .sort((a, b) => b - a)
        .map((y) => ({ id: String(y), label: String(y) })),
    [monthYearOptions]
  );
  const weekYearDropdownOptions = useMemo(
    () =>
      [...weekYearOptions]
        .sort((a, b) => b - a)
        .map((y) => ({ id: String(y), label: String(y) })),
    [weekYearOptions]
  );
  const monthStartYearDropdownOptions = useMemo(
    () => yearOptionsForStart(monthYearDropdownOptions, chartEndYear),
    [monthYearDropdownOptions, chartEndYear]
  );
  const monthEndYearDropdownOptions = useMemo(
    () => yearOptionsForEnd(monthYearDropdownOptions, chartStartYear),
    [monthYearDropdownOptions, chartStartYear]
  );
  const weekStartYearDropdownOptions = useMemo(
    () => yearOptionsForStart(weekYearDropdownOptions, weeklyEndYear),
    [weekYearDropdownOptions, weeklyEndYear]
  );
  const weekEndYearDropdownOptions = useMemo(
    () => yearOptionsForEnd(weekYearDropdownOptions, weeklyStartYear),
    [weekYearDropdownOptions, weeklyStartYear]
  );
  const dailyPickerMax = asOfDate || new Date().toISOString().slice(0, 10);
  const dailyTableDateBounds = dateInputBounds(dailyFilterDraft.start, dailyFilterDraft.end, {
    globalMin: RETURNS_DEFAULT_START,
    globalMax: dailyPickerMax
  });

  /** Avoid resetting user-defined weekly start/end when only raw rows refresh; reset when span or symbol changes. */
  const weekYearSpanKey = useMemo(() => {
    if (!isWeekly || !weekYearOptions.length) return '';
    const lo = weekYearOptions[0];
    const hi = weekYearOptions[weekYearOptions.length - 1];
    return `${lo}:${hi}`;
  }, [isWeekly, weekYearOptions]);

  useEffect(() => {
    if (isDaily || isWeekly || !monthYearOptions.length) return;
    const hasDefaultStart = monthYearOptions.includes(DEFAULT_MONTHLY_START_YEAR);
    const hasDefaultEnd = monthYearOptions.includes(DEFAULT_MONTHLY_END_YEAR);
    const nextStart = hasDefaultStart ? DEFAULT_MONTHLY_START_YEAR : monthYearOptions[0];
    const nextEnd = hasDefaultEnd ? DEFAULT_MONTHLY_END_YEAR : monthYearOptions[monthYearOptions.length - 1];
    setChartStartYear((prev) => (monthYearOptions.includes(Number(prev)) ? prev : String(nextStart)));
    setChartEndYear((prev) => (monthYearOptions.includes(Number(prev)) ? prev : String(nextEnd)));
  }, [isDaily, isWeekly, monthYearOptions]);
  useEffect(() => {
    if (!isWeekly || !weekYearOptions.length) return;
    const preferred = weekYearOptions.includes(DEFAULT_WEEKLY_YEAR)
      ? DEFAULT_WEEKLY_YEAR
      : weekYearOptions[weekYearOptions.length - 1];
    setWeeklyStartYear(String(preferred));
    setWeeklyEndYear(String(preferred));
  }, [isWeekly, sym, weekYearSpanKey]);

  const monthlyChartRows = useMemo(() => {
    if (isDaily) return dailyReturnsForUi || [];
    if (isWeekly) {
      const rows = Array.isArray(monthlyReturnsRaw) ? monthlyReturnsRaw : [];
      const startY = Number(weeklyStartYear);
      const endY = Number(weeklyEndYear);
      if (!Number.isFinite(startY) || !Number.isFinite(endY)) return rows;
      const lo = Math.min(startY, endY);
      const hi = Math.max(startY, endY);
      return rows.filter((r) => {
        const y = parseYear(r?.period);
        return Number.isFinite(y) && y >= lo && y <= hi;
      });
    }
    const rows = Array.isArray(monthlyReturnsRaw) ? monthlyReturnsRaw : [];
    const startY = Number(chartStartYear);
    const endY = Number(chartEndYear);
    if (!Number.isFinite(startY) || !Number.isFinite(endY)) return rows;
    const lo = Math.min(startY, endY);
    const hi = Math.max(startY, endY);
    return rows.filter((r) => {
      const y = parseYear(r?.period);
      return Number.isFinite(y) && y >= lo && y <= hi;
    });
  }, [
    chartEndYear,
    chartStartYear,
    dailyReturnsForUi,
    isDaily,
    isWeekly,
    monthlyReturnsRaw,
    weeklyEndYear,
    weeklyStartYear
  ]);
  const benchmarkChartRows = useMemo(() => {
    if (isDaily) return filterReturnsRows(benchmarkReturnsRaw, dailyFilter.start, dailyFilter.end);
    if (isWeekly) {
      const rows = Array.isArray(benchmarkReturnsRaw) ? benchmarkReturnsRaw : [];
      return filterRowsByYearRange(
        normalizePeriodReturnsRows(rows, 'weekly'),
        weeklyStartYear,
        weeklyEndYear
      ).map((r) => ({ period: r.period, startDate: r.startDate, endDate: r.endDate, totalReturn: r.returnPct }));
    }
    const rows = Array.isArray(benchmarkReturnsRaw) ? benchmarkReturnsRaw : [];
    return filterRowsByYearRange(
      normalizePeriodReturnsRows(rows, 'monthly'),
      chartStartYear,
      chartEndYear
    ).map((r) => ({ period: r.period, startDate: r.startDate, endDate: r.endDate, totalReturn: r.returnPct }));
  }, [
    benchmarkReturnsRaw,
    chartEndYear,
    chartStartYear,
    dailyFilter.end,
    dailyFilter.start,
    isDaily,
    isWeekly,
    weeklyEndYear,
    weeklyStartYear
  ]);
  const comparisonRows = useMemo(() => {
    const modeForUtil = isDaily ? 'daily' : isWeekly ? 'weekly' : 'monthly';
    const tRows = normalizePeriodReturnsRows(monthlyChartRows, modeForUtil);
    const bRows = normalizePeriodReturnsRows(benchmarkChartRows, modeForUtil);
    let out = alignComparisonRows(tRows, bRows);
    if (isWeekly) out = filterRowsByYearRange(out, weeklyStartYear, weeklyEndYear);
    if (isDaily) out = filterRowsByDateRange(out, dailyFilter.start, dailyFilter.end);
    return out;
  }, [benchmarkChartRows, dailyFilter.end, dailyFilter.start, isDaily, isWeekly, monthlyChartRows, weeklyEndYear, weeklyStartYear]);

  const monthlyChartRangeControls = !isDaily && !isWeekly ? (
    <div className="ticker-page__custom-range" aria-label="Monthly chart year range">
      <span className="ticker-page__label ticker-page__label--inline">Start</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={chartStartYear}
        options={monthStartYearDropdownOptions}
        onChange={(v) => {
          const next = applyYearStartChange(chartStartYear, chartEndYear, v);
          setChartStartYear(next.start);
          setChartEndYear(next.end);
        }}
        title="Start year"
        ariaLabelPrefix="Start year"
        labelFallback={chartStartYear}
      />
      <span className="ticker-page__label ticker-page__label--inline">End</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={chartEndYear}
        options={monthEndYearDropdownOptions}
        onChange={(v) => {
          const next = applyYearEndChange(chartStartYear, chartEndYear, v);
          setChartStartYear(next.start);
          setChartEndYear(next.end);
        }}
        title="End year"
        ariaLabelPrefix="End year"
        labelFallback={chartEndYear}
      />
    </div>
  ) : null;
  const weeklyChartRangeControls = isWeekly ? (
    <div className="ticker-page__custom-range" aria-label="Weekly chart year range">
      <span className="ticker-page__label ticker-page__label--inline">Start</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={weeklyStartYear}
        options={weekStartYearDropdownOptions}
        onChange={(v) => {
          const next = applyYearStartChange(weeklyStartYear, weeklyEndYear, v);
          setWeeklyStartYear(next.start);
          setWeeklyEndYear(next.end);
        }}
        title="Weekly start year"
        ariaLabelPrefix="Start year"
        labelFallback={weeklyStartYear}
      />
      <span className="ticker-page__label ticker-page__label--inline">End</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={weeklyEndYear}
        options={weekEndYearDropdownOptions}
        onChange={(v) => {
          const next = applyYearEndChange(weeklyStartYear, weeklyEndYear, v);
          setWeeklyStartYear(next.start);
          setWeeklyEndYear(next.end);
        }}
        title="Weekly end year"
        ariaLabelPrefix="End year"
        labelFallback={weeklyEndYear}
      />
    </div>
  ) : null;
  const mkDailyDateToolbar = useCallback(
    () => (
      <DailyChartDateRangeToolbar
        draft={dailyFilterDraft}
        pickerMax={dailyPickerMax}
        onChangeStart={(e) => onDailyToolbarDateChange('start', e.target.value)}
        onChangeEnd={(e) => onDailyToolbarDateChange('end', e.target.value)}
      />
    ),
    [dailyFilterDraft, dailyPickerMax, onDailyToolbarDateChange]
  );
  const tableRowsFiltered = useMemo(() => {
    const source = isDaily ? dailyReturnsForUi || [] : monthlyReturnsRaw;
    const rows = (Array.isArray(source) ? source : [])
      .map((r) => ({
        period: r?.period,
        startDate: r?.startDate,
        endDate: r?.endDate,
        startClose: r?.startPrice,
        endClose: r?.endPrice,
        returnPct: r?.totalReturn,
        year: (() => {
          let y = parseYear(r?.period);
          if (!Number.isFinite(y)) y = Number(String(r?.startDate || '').slice(0, 4));
          if (!Number.isFinite(y)) y = Number(String(r?.endDate || '').slice(0, 4));
          return Number.isFinite(y) ? y : null;
        })()
      }))
      .filter((r) => r.period);
    if (isDaily) return rows;
    if (isWeekly) {
      const startY = Number(weeklyStartYear);
      const endY = Number(weeklyEndYear);
      if (!Number.isFinite(startY) || !Number.isFinite(endY)) return rows;
      const lo = Math.min(startY, endY);
      const hi = Math.max(startY, endY);
      return rows.filter((r) => Number.isFinite(r.year) && r.year >= lo && r.year <= hi);
    }
    const ys = rows.map((r) => r.year).filter(Number.isFinite);
    if (!ys.length) return [];
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const hi = maxY;
    let lo;
    if (tableRange === 'MAX') {
      lo = minY;
    } else {
      const span = TABLE_RANGE_YEARS[tableRange];
      if (!Number.isFinite(span)) return [];
      lo = hi - (span - 1);
      if (lo < minY) lo = minY;
    }
    return rows.filter((r) => Number.isFinite(r.year) && r.year >= lo && r.year <= hi);
  }, [
    monthlyReturnsRaw,
    tableRange,
    isDaily,
    dailyReturnsForUi,
    isWeekly,
    weeklyEndYear,
    weeklyStartYear
  ]);

  const monthlySeasonality = useMemo(() => {
    if (isWeekly || isDaily) return null;
    return buildMonthlySeasonality(monthlyReturnsRaw);
  }, [isWeekly, isDaily, monthlyReturnsRaw]);

  const tableRowsSorted = useMemo(() => {
    const rows = [...tableRowsFiltered];
    const { column, direction } = tableSort;
    const dir = direction === 'asc' ? 1 : -1;
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    rows.sort((a, b) => {
      let cmp = 0;
      switch (column) {
        case 'period':
          cmp = monthPeriodOrderKey(a) - monthPeriodOrderKey(b);
          break;
        case 'startDate':
          cmp = String(a.startDate || '').localeCompare(String(b.startDate || ''));
          break;
        case 'endDate':
          cmp = String(a.endDate || '').localeCompare(String(b.endDate || ''));
          break;
        case 'startPrice':
          cmp = (num(a.startClose) ?? -Infinity) - (num(b.startClose) ?? -Infinity);
          break;
        case 'endPrice':
          cmp = (num(a.endClose) ?? -Infinity) - (num(b.endClose) ?? -Infinity);
          break;
        case 'return':
          cmp = (num(a.returnPct) ?? -Infinity) - (num(b.returnPct) ?? -Infinity);
          break;
        default:
          cmp = 0;
      }
      return dir * cmp;
    });
    return rows;
  }, [tableRowsFiltered, tableSort]);

  const tableTotalPages = useMemo(() => Math.max(1, Math.ceil(tableRowsSorted.length / TABLE_PAGE_SIZE)), [tableRowsSorted.length]);
  const tablePageSafe = useMemo(() => Math.min(Math.max(1, tablePage), tableTotalPages), [tablePage, tableTotalPages]);
  const tablePageRows = useMemo(() => {
    const start = (tablePageSafe - 1) * TABLE_PAGE_SIZE;
    return tableRowsSorted.slice(start, start + TABLE_PAGE_SIZE);
  }, [tableRowsSorted, tablePageSafe]);

  const onTableSortClick = useCallback((column) => {
    setTableSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'desc' };
    });
  }, []);

  useEffect(() => {
    setTablePage(1);
  }, [sym, tableRange, dailyFilter.start, dailyFilter.end, isDaily, isWeekly, weeklyStartYear, weeklyEndYear, tableSort.column, tableSort.direction]);
  useEffect(() => { setTablePage((p) => Math.min(Math.max(1, p), tableTotalPages)); }, [tableTotalPages]);

  const symU = String(sym || '').toUpperCase();
  const myDetail = useMemo(() => detailRows.find((r) => String(r.Symbol || r.symbol || '').toUpperCase().trim() === symU) || null, [detailRows, symU]);
  const sector = String(myDetail?.Sector || myDetail?.sector || '').trim();
  const competitors = useMemo(
    () =>
      pickRelatedByCategory(
        detailRows,
        symU,
        sector,
        String(
          myDetail?.SubIndustry ||
            myDetail?.subIndustry ||
            myDetail?.subindustry ||
            myDetail?.Industry ||
            myDetail?.industry ||
            ''
        ).trim(),
        6
      ),
    [detailRows, symU, sector, myDetail]
  );
  const highs = statsRows.map((r) => pickNum(r, ['High', 'high'])).filter((v) => v != null);
  const lows = statsRows.map((r) => pickNum(r, ['Low', 'low'])).filter((v) => v != null);
  const vols = statsRows.map((r) => pickNum(r, ['Volume', 'volume', 'VOLUME'])).filter((v) => v != null);
  const closes = statsRows.map((r) => pickNum(r, ['Close', 'close'])).filter((v) => v != null);
  const hi52 = highs.length ? Math.max(...highs) : null;
  const lo52 = lows.length ? Math.min(...lows) : null;
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
  const vola = annualizedVol(closes);
  const lastRow = statsRows.length ? statsRows[statsRows.length - 1] : null;
  const lastSignal = lastRow && lastRow.signal != null ? String(lastRow.signal) : 'N';
  const activeBucket = signalBucket(lastSignal);
  const lastUpdatedIso = lastRow ? rowDateToTimeKey(lastRow) : asOfDate;
  const lastUpdatedFmt =
    lastUpdatedIso && !Number.isNaN(Date.parse(lastUpdatedIso))
      ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(lastUpdatedIso + 'T16:00:00'))
      : '—';
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
  const symMtd = mtdFromRows(statsRows);
  const symQtd = qtdFromRows(statsRows);
  const spyMtd = mtdFromRows(statsRowsSpy);
  const spyQtd = qtdFromRows(statsRowsSpy);
  const selectedIndexSeries = { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
  const selectedTickerSeries = { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd };

  const monthlyReturnsTableHeadActions = useMemo(
    () =>
      isDaily ? (
        <>
          <label className="statistic-data__range">
            <span>Start</span>
            <input
              type="date"
              className={DAILY_CHART_DATE_INPUT_CLASS}
              value={dailyFilterDraft.start}
              min={dailyTableDateBounds.startMin}
              max={dailyTableDateBounds.startMax}
              onChange={(e) => onDailyToolbarDateChange('start', e.target.value)}
            />
          </label>
          <label className="statistic-data__range">
            <span>End</span>
            <input
              type="date"
              className={DAILY_CHART_DATE_INPUT_CLASS}
              value={dailyFilterDraft.end}
              min={dailyTableDateBounds.endMin}
              max={dailyTableDateBounds.endMax}
              onChange={(e) => onDailyToolbarDateChange('end', e.target.value)}
            />
          </label>
        </>
      ) : isWeekly ? (
        <>
          <label className="statistic-data__range">
            <span>Start</span>
            <ThemedDropdown
              size="sm"
              style={{ minWidth: 86 }}
              value={weeklyStartYear}
              options={weekStartYearDropdownOptions}
              onChange={(v) => {
                const next = applyYearStartChange(weeklyStartYear, weeklyEndYear, v);
                setWeeklyStartYear(next.start);
                setWeeklyEndYear(next.end);
              }}
              title="Table start year"
              ariaLabelPrefix="Start"
              labelFallback={weeklyStartYear}
            />
          </label>
          <label className="statistic-data__range">
            <span>End</span>
            <ThemedDropdown
              size="sm"
              style={{ minWidth: 86 }}
              value={weeklyEndYear}
              options={weekEndYearDropdownOptions}
              onChange={(v) => {
                const next = applyYearEndChange(weeklyStartYear, weeklyEndYear, v);
                setWeeklyStartYear(next.start);
                setWeeklyEndYear(next.end);
              }}
              title="Table end year"
              ariaLabelPrefix="End"
              labelFallback={weeklyEndYear}
            />
          </label>
        </>
      ) : (
        <label className="statistic-data__range">
          <span>Range</span>
          <ThemedDropdown
            size="sm"
            style={{ minWidth: 86 }}
            value={tableRange}
            options={TABLE_RANGE_DROPDOWN_OPTIONS}
            onChange={setTableRange}
            title="Table range"
            ariaLabelPrefix="Range"
            labelFallback={TABLE_RANGE_DROPDOWN_OPTIONS.find((o) => o.id === tableRange)?.label ?? tableRange}
          />
        </label>
      ),
    [
      isDaily,
      isWeekly,
      dailyFilterDraft,
      dailyLoadedRange,
      dailyTableDateBounds,
      onDailyToolbarDateChange,
      weeklyStartYear,
      weeklyEndYear,
      weekStartYearDropdownOptions,
      weekEndYearDropdownOptions,
      tableRange
    ]
  );

  return (
    <div className="ticker-page">
      {error ? <div className="ticker-page__error" role="alert">{error}</div> : null}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="flex flex-wrap items-center justify-start gap-[10px]">
          <div className="inline-flex min-w-0 flex-wrap items-center gap-[10px] [&_.ticker-symbol-search]:min-w-[220px] [&_.ticker-symbol-search]:max-w-[420px]">
            <TickerSymbolCombobox symbol={sym} onSymbolChange={onSymbolChange} inputId={`ticker-${modeSlug}-symbol`} />
            {loading ? (<span className="ticker-page__loading-pill">Loading quarterly data…</span>) : null}
          </div>
          <div className="min-w-0">
            <h1 className="ticker-page__company ticker-page__company--hero">{symU} {modeLabel} Statistics</h1>
          </div>
        </div>
      </header>

      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <TickerAnnualReturnsFigma
            symbol={symU}
            annualReturns={monthlyChartRows}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_M_FIGMA}
            resizeDefaultHeight={260}
            periodMode={modeSlug}
            suppressChartDateFilter={isDaily}
            toolbarControls={isDaily ? mkDailyDateToolbar() : isWeekly ? weeklyChartRangeControls : monthlyChartRangeControls}
            loading={loading}
          />
          <TickerChartResizeScope storageKey={RESIZE_KEY_M_POSNEG} defaultHeight={260}>
            <TickerAnnualReturnsPosNeg
              symbol={symU}
              annualReturns={monthlyChartRows}
              asOfDate={asOfDate}
              periodMode={modeSlug}
              suppressChartDateFilter={isDaily || isWeekly}
              loading={loading}
            />
          </TickerChartResizeScope>
          {!isDaily ? (
          <TickerMonthlyReturnsChart
            symbol={symU}
            monthlyReturns={isWeekly ? monthlyReturnsRaw : monthlyChartRows}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_M_MAIN}
            resizeDefaultHeight={288}
            periodMode={modeSlug}
            suppressChartDateFilter={isDaily}
            hideChartDateApplyRow={isWeekly}
            useThemedYearDropdown={isWeekly}
            defaultToLatestYear={isWeekly}
            chartToolbarExtras={isDaily ? mkDailyDateToolbar() : null}
            loading={loading}
          />
          ) : null}
          {!isWeekly && !isDaily ? (
            <TickerChartResizeScope storageKey={RESIZE_KEY_M_WF} defaultHeight={300}>
              <TickerMonthlyReturnsWaterfallDonut
                symbol={symU}
                monthlyReturns={monthlyChartRows}
                asOfDate={asOfDate}
                periodMode={modeSlug}
                loading={loading}
              />
            </TickerChartResizeScope>
          ) : null}

          {!isWeekly && !isDaily ? (
            <MonthlySeasonalitySection
              seasonality={monthlySeasonality}
              placement="desktop"
              loading={loading}
            />
          ) : null}

          <section className="statistic-data__card">
            <div className="statistic-data__table-head">
              <div className="statistic-data__title-stack">
                <h2 className="statistic-data__table-title">{modeLabel} Returns</h2>
                {isDaily && (dailyLoadedRange.min || dailyLoadedRange.max) ? (
                  <p className="statistic-data__coverage ticker-page__muted">
                    <span className="statistic-data__coverage-label">Loaded data:</span>{' '}
                    {dailyLoadedRange.min || '—'} → {dailyLoadedRange.max || '—'}
                    {(dailyShownRange.min || dailyShownRange.max) &&
                    (dailyShownRange.min !== dailyLoadedRange.min || dailyShownRange.max !== dailyLoadedRange.max ||
                      dailyFilter.start ||
                      dailyFilter.end) ? (
                      <>
                        {' · '}
                        <span className="statistic-data__coverage-label">Showing:</span>{' '}
                        {dailyShownRange.min || '—'} → {dailyShownRange.max || '—'}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="statistic-data__head-actions">{monthlyReturnsTableHeadActions}</div>
            </div>
            <div className="statistic-data__table-wrap">
              <table className="statistic-data__table">
                <thead>
                  <tr>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onTableSortClick('period')}
                        aria-sort={
                          tableSort.column === 'period'
                            ? tableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Period
                        {tableSort.column === 'period' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {tableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onTableSortClick('startPrice')}
                        aria-sort={
                          tableSort.column === 'startPrice'
                            ? tableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Start Price
                        {tableSort.column === 'startPrice' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {tableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onTableSortClick('endPrice')}
                        aria-sort={
                          tableSort.column === 'endPrice'
                            ? tableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        End Price
                        {tableSort.column === 'endPrice' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {tableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onTableSortClick('return')}
                        aria-sort={
                          tableSort.column === 'return'
                            ? tableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Return
                        {tableSort.column === 'return' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {tableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tablePageRows.length ? (
                    tablePageRows.map((row) => (
                      <tr key={`monthly-table-${row.period}`}>
                        <td>{row.period}</td>
                        <td>{Number.isFinite(Number(row.startClose)) ? fmtPrice(row.startClose) : '—'}</td>
                        <td>{Number.isFinite(Number(row.endClose)) ? fmtPrice(row.endClose) : '—'}</td>
                        <td className={pctTone(row.returnPct)}>{fmtPctSigned(row.returnPct)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="statistic-data__empty">
                        No {modeSlug} rows yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tableTotalPages > 1 ? (
              <div className="statistic-data__pager">
                <FigmaPagination page={tablePageSafe} totalPages={tableTotalPages} onPageChange={setTablePage} />
                <span className="statistic-data__pager-meta">Page {tablePageSafe} of {tableTotalPages} ({tableRowsSorted.length} rows)</span>
              </div>
            ) : null}
          </section>

          {!isWeekly && !isDaily ? (
            <MonthlySeasonalitySection
              seasonality={monthlySeasonality}
              placement="mobile"
              loading={loading}
            />
          ) : null}
        </div>

        <aside className="ticker-page__aside ticker-page__aside-stack">
          {/* <section className="ticker-card ticker-card--signal" aria-labelledby="odin-signal-h-m">
            <div className="ticker-signal-head">
              <span className="ticker-signal-logo" aria-hidden />
              <h2 className="ticker-card__h ticker-card__h--inline" id="odin-signal-h-m">Odin Signal</h2>
            </div>
            <p className="ticker-signal-asof">As of {lastUpdatedFmt}</p>
            <div className="ticker-signal-lanes" role="list">
              {[{ k: 'L1', tone: 'green-dark' }, { k: 'L2', tone: 'green-dark' }, { k: 'L3', tone: 'green-bright' }, { k: 'S1', tone: 'orange' }, { k: 'S2', tone: 'orange-mid' }, { k: 'S3', tone: 'amber' }, { k: 'N', tone: 'gray' }].map((s) => (
                <div key={s.k} className={'ticker-signal-cell ticker-signal-cell--' + s.tone + (activeBucket === s.k ? ' ticker-signal-cell--active' : '')} role="listitem">{s.k}</div>
              ))}
            </div>
            <div className="ticker-signal-foot"><IconTrendUp className="ticker-signal-foot__ico" /><IconTrendDown className="ticker-signal-foot__ico" /></div>
          </section> */}

          <section className="mkt-mini-card ticker-aside-mini" aria-labelledby="key-data-h-m">
            <header className="mkt-mini-card__head">
              <h2 className="mkt-mini-card__k" id="key-data-h-m">
                Key data &amp; performance
              </h2>
              <span className="mkt-mini-card__head-actions">
                <ChartInfoTip tip={CHART_INFO_TIPS.keyData52Week} align="start" />
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
                <span>RELATED INDICES</span>
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

          <section className="mkt-mini-card ticker-aside-mini" aria-labelledby="ticker-monthly-rel-perf-h">
            <header className="mkt-mini-card__head">
              <span className="mkt-mini-card__k" id="ticker-monthly-rel-perf-h">
                Relative performance
                <span className="mkt-mini-card__tf">%</span>
              </span>
            </header>
            <div className="ticker-aside-mini__body">
              <div className="ticker-compare">
                <div className="ticker-compare__head">
                  <span />
                  <span>{symU}</span>
                  <span>{benchmarkIndex}</span>
                  <span>Diff</span>
                </div>
                {COMPARE_ROWS.map((row) => {
                  const symPct = row.period
                    ? pickDynamic(selectedIndexSeries.dynamicPeriods, row.period)
                    : row.mtd
                      ? selectedIndexSeries.mtd
                      : row.qtd
                        ? selectedIndexSeries.qtd
                        : null;
                  const spyPct = row.period
                    ? pickDynamic(selectedTickerSeries.dynamicPeriods, row.period)
                    : row.mtd
                      ? selectedTickerSeries.mtd
                      : row.qtd
                        ? selectedTickerSeries.qtd
                        : null;
                  const diff =
                    symPct != null && spyPct != null && Number.isFinite(symPct) && Number.isFinite(spyPct)
                      ? symPct - spyPct
                      : null;
                  return (
                    <div key={row.key} className="ticker-compare__row">
                      <span className="ticker-compare__tf">{row.key}</span>
                      <span className={'ticker-compare__cell ' + pctClass(symPct)}>{formatRelativePerfPct(symPct)}</span>
                      <span className={'ticker-compare__cell ' + pctClass(spyPct)}>{formatRelativePerfPct(spyPct)}</span>
                      <span className={'ticker-compare__cell ' + pctClass(diff)}>{formatRelativePerfPct(diff)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
          <section className="mkt-mini-card ticker-aside-mini ticker-company-overview" aria-labelledby="ticker-company-overview-h-monthly">
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
                <h2 className="mkt-mini-card__k" id="ticker-company-overview-h-monthly">
                  Company overview
                </h2>
              </span>
            </header>
            <div className="ticker-aside-mini__body ticker-company-overview__body">
              {companyOverviewBusy ? <p className="ticker-page__muted">Loading company profile…</p> : null}
              {!companyOverviewBusy ? (
                <>
                  <p className="ticker-company-overview__desc">
                    {companyOverviewDescriptionPreview ||
                      `${symU} profile details are not available for this symbol yet.`}
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
                      <p className="ticker-company-overview__metric-v">{companyOverviewSector || '—'}</p>
                    </article>
                    <article className="ticker-company-overview__metric">
                      <p className="ticker-company-overview__metric-k">Industry</p>
                      <p className="ticker-company-overview__metric-v">{companyOverviewIndustry || '—'}</p>
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
      </div>
    </div>
  );
}

