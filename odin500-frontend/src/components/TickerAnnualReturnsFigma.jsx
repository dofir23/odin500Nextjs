'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { useChartFullscreenPlotSize } from '../hooks/useChartFullscreenPlotSize.js';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { formatWeekAxisDate, isoYearWeekFromIsoDate } from '../utils/isoWeek.js';
import { periodModeNouns } from '../utils/periodModeNouns.js';
import { getReturnsChartViewMoreHref } from '../utils/returnsViewMoreNavigation.js';
import { DEFAULT_TICKER_ROUTE_SYMBOL } from '../utils/tickerUrlSync.js';
import { fmtPctSigned, fmtPrice } from '../utils/formatDisplayNumber.js';
import { AnnualReturnsFigmaChartSkeleton, badgeLabelForPeriodMode } from './ChartSkeletons.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ReturnsChartClickableTitle } from './ReturnsChartClickableTitle.jsx';
import { ChartSectionIconActions, useChartFullscreen } from './ChartSectionIconActions.jsx';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';
import { ReturnsChartPieIcon } from './returnsChartToolbarIcons.jsx';
import { buildReturnNarrative } from '../utils/seoChartNarratives.js';
import {
  StatsTickerReturnsBarChart,
  TICKER_RETURNS_COL_NEG,
  TICKER_RETURNS_YEAR_PALETTE
} from './StatsTickerReturnsBarChart.jsx';
import { StatsTickerReturnsSummaryBarChart } from './StatsTickerReturnsSummaryBarChart.jsx';
import { StatsTickerReturnsPosNegDonut } from './StatsTickerReturnsPosNegDonut.jsx';
import {
  applyYearEndChange,
  applyYearStartChange,
  yearOptionsForEnd,
  yearOptionsForStart
} from '../utils/dateRangeConstraints.js';

/** Match `TickerLightweightChart` / dark ticker cards. */
const COL_BAR = '#2563eb';
const COL_NEG = '#f59e0b';
const COL_ORANGE = '#f97316';
const COL_GRID = 'rgba(148, 163, 184, 0.14)';
const COL_GRID_ZERO = 'rgba(148, 163, 184, 0.35)';
const YEAR_PALETTE = ['#38bdf8', '#f97316', '#64748b', '#eab308', '#7dd3fc', '#a78bfa', '#34d399', '#fb7185', '#f472b6', '#22d3ee'];

/** “Nice” tick step for ~`targetCount` intervals across `span`. */
function pickNiceStep(span, targetCount) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / Math.max(2, targetCount);
  const pow10 = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const err = raw / pow10;
  let nice = 10;
  if (err <= 1.5) nice = 1;
  else if (err <= 3) nice = 2;
  else if (err <= 7) nice = 5;
  return nice * pow10;
}

function buildTicks(yMin, yMax, step) {
  const ticks = [];
  const k0 = Math.ceil((yMin - 1e-9) / step);
  const k1 = Math.floor((yMax + 1e-9) / step);
  for (let k = k0; k <= k1; k++) {
    const t = Math.round(k * step * 1e8) / 1e8;
    ticks.push(t);
  }
  if (!ticks.length) ticks.push(0);
  return ticks;
}

/**
 * Y-axis from data (min/max of series + 0, optional avg). Tick count grows when the chart is taller (`plotPx`).
 * @param {number[]} seriesValues
 * @param {number | null} avgExtra — include in domain so the average line stays visible
 * @param {number | undefined} plotPx — rendered SVG height in CSS px (resize)
 * @param {number} svgHeight — viewBox height of this chart
 * @param {number} innerHViewBox — plot inner height in SVG units
 */
function computePercentAxis(seriesValues, avgExtra, plotPx, svgHeight, innerHViewBox) {
  const vals = seriesValues.filter((v) => Number.isFinite(v));
  if (!vals.length) {
    return { yMin: -20, yMax: 60, ticks: [-20, -10, 0, 10, 20, 30, 40, 50, 60], step: 10 };
  }
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  if (avgExtra != null && Number.isFinite(avgExtra)) {
    lo = Math.min(lo, avgExtra);
    hi = Math.max(hi, avgExtra);
  }
  let span = hi - lo;
  if (span < 1e-6) {
    lo -= 5;
    hi += 5;
    span = 10;
  }
  const pad = Math.max(span * 0.08, 2);
  lo -= pad;
  hi += pad;

  const effPlot = plotPx != null && Number.isFinite(plotPx) ? plotPx : svgHeight;
  const renderedInnerPx = innerHViewBox * (effPlot / svgHeight);
  const minPxPerTick = renderedInnerPx < 200 ? 28 : renderedInnerPx < 340 ? 22 : renderedInnerPx < 500 ? 18 : 14;
  const targetCount = Math.min(22, Math.max(5, Math.round(renderedInnerPx / minPxPerTick)));

  const step = pickNiceStep(hi - lo, targetCount);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const ticks = buildTicks(yMin, yMax, step);
  return { yMin, yMax, ticks, step };
}

function yForValueAxis(v, innerTop, innerH, yMin, yMax) {
  if (!Number.isFinite(v)) return innerTop + innerH / 2;
  const c = Math.min(yMax, Math.max(yMin, v));
  if (Math.abs(yMax - yMin) < 1e-12) return innerTop + innerH / 2;
  return innerTop + ((yMax - c) / (yMax - yMin)) * innerH;
}

function parseYear(period) {
  const m = String(period || '').match(/(\d{4})/);
  const y = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(y) ? y : NaN;
}

function parseQuarter(period) {
  const m = String(period || '').match(/^(\d{4})-Q([1-4])$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const q = parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(q)) return null;
  return { year, q };
}

/** Display label for quarterly periods (e.g. `2025-Q2` → `Q2-2025`). */
function formatQuarterLabel(period) {
  const q = parseQuarter(period);
  if (!q) return String(period || '');
  return `Q${q.q}-${q.year}`;
}

/** Display label for monthly periods (e.g. `2025-07` → `07-2025`). */
function formatMonthLabel(period) {
  const m = parseMonth(period);
  if (!m) return String(period || '');
  return `${String(m.month).padStart(2, '0')}-${m.year}`;
}

function parseMonth(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function parseWeek(period) {
  const m = String(period || '').match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  return { year, week };
}

function parseDaily(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function median(nums) {
  const arr = nums.filter((n) => Number.isFinite(n));
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

/**
 * Figma-style annual returns + stats (uses `performance.annualReturns` from ticker-returns API).
 * @param {{ symbol: string, annualReturns?: unknown[], asOfDate?: string, plotHeight?: number, resizeStorageKey?: string, resizeDefaultHeight?: number, persistPlotResize?: boolean, periodMode?: 'annual' | 'quarterly' | 'monthly' | 'weekly' | 'daily', suppressChartDateFilter?: boolean, showOpenPeriodPageButton?: boolean, toolbarControls?: import('react').ReactNode, hideStatsSection?: boolean, enableInlineYearDropdowns?: boolean, defaultStartYear?: number, defaultEndYear?: number, loading?: boolean }} props
 */
export function TickerAnnualReturnsFigma({
  symbol,
  annualReturns,
  asOfDate,
  plotHeight,
  resizeStorageKey,
  resizeDefaultHeight = 260,
  persistPlotResize = true,
  periodMode = 'annual',
  suppressChartDateFilter = false,
  showOpenPeriodPageButton = false,
  toolbarControls = null,
  hideStatsSection = false,
  enableInlineYearDropdowns = false,
  defaultStartYear,
  defaultEndYear,
  loading = false
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const resize = useTickerPlotResize(resizeStorageKey ?? null, resizeDefaultHeight, undefined, undefined, persistPlotResize);
  const plotPx = resize.plotHeight ?? plotHeight;
  const sectionRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartFsShellRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const assignChartCardRef = useCallback((el) => {
    chartCardRef.current = el;
  }, []);
  const { isFullscreen: chartFs } = useChartFullscreen(chartFsShellRef);
  const fsPlotSize = useChartFullscreenPlotSize(chartFsShellRef);
  const plotPxEffective = fsPlotSize?.height ?? plotPx;

  const [showTable, setShowTable] = useState(false);

  const rows = useMemo(() => {
    if (!Array.isArray(annualReturns)) return [];
    const mapped = [...annualReturns]
      .map((r) => {
        const period = String(r?.period || '');
        const totalReturn = Number(r?.totalReturn);
        if (!Number.isFinite(totalReturn)) return null;
        if (periodMode === 'quarterly') {
          const q = parseQuarter(period);
          if (!q) return null;
          return {
            period,
            startDate: r?.startDate,
            endDate: r?.endDate,
            startPrice: r?.startPrice,
            endPrice: r?.endPrice,
            totalReturn,
            year: q.year,
            quarter: q.q,
            rowKey: period,
            xLabel: formatQuarterLabel(period)
          };
        }
        if (periodMode === 'monthly') {
          const m = parseMonth(period);
          if (!m) return null;
          return {
            period,
            startDate: r?.startDate,
            endDate: r?.endDate,
            startPrice: r?.startPrice,
            endPrice: r?.endPrice,
            totalReturn,
            year: m.year,
            quarter: null,
            month: m.month,
            rowKey: period,
            xLabel: formatMonthLabel(period)
          };
        }
        if (periodMode === 'weekly') {
          let w = parseWeek(period);
          const iy = Number(r?.isoYear);
          const iw = Number(r?.isoWeek);
          if (!w && Number.isFinite(iy) && Number.isFinite(iw) && iw >= 1 && iw <= 53) {
            w = { year: iy, week: iw };
          }
          if (!w && /^\d{4}-\d{2}-\d{2}$/.test(period)) {
            const ip = isoYearWeekFromIsoDate(period);
            if (ip && ip.week >= 1 && ip.week <= 53) w = { year: ip.year, week: ip.week };
          }
          if (!w) return null;
          const endIso = String(r?.endDate ?? period ?? '').slice(0, 10);
          const dateLbl = formatWeekAxisDate(endIso);
          return {
            period,
            startDate: r?.startDate,
            endDate: r?.endDate,
            startPrice: r?.startPrice,
            endPrice: r?.endPrice,
            totalReturn,
            year: w.year,
            quarter: null,
            month: null,
            week: w.week,
            rowKey: period,
            xLabel: dateLbl || period
          };
        }
        if (periodMode === 'daily') {
          const d = parseDaily(period);
          if (!d) return null;
          return {
            period,
            startDate: r?.startDate,
            endDate: r?.endDate,
            startPrice: r?.startPrice,
            endPrice: r?.endPrice,
            totalReturn,
            year: d.year,
            quarter: null,
            month: d.month,
            week: null,
            day: d.day,
            rowKey: period,
            xLabel: period
          };
        }
        const y = parseYear(period);
        if (!Number.isFinite(y)) return null;
        return {
          period,
          startDate: r?.startDate,
          endDate: r?.endDate,
          startPrice: r?.startPrice,
          endPrice: r?.endPrice,
          totalReturn,
          year: y,
          quarter: null,
          rowKey: String(y),
          xLabel: String(y)
        };
      })
      .filter(Boolean);
    mapped.sort(
      (a, b) =>
        a.year - b.year ||
        (a.quarter || 0) - (b.quarter || 0) ||
        (a.month || 0) - (b.month || 0) ||
        (a.week || 0) - (b.week || 0) ||
        (a.day || 0) - (b.day || 0)
    );
    return mapped;
  }, [annualReturns, periodMode]);

  const yearOptions = useMemo(() => {
    const ys = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
    return ys;
  }, [rows]);
  const [chartStartYear, setChartStartYear] = useState('');
  const [chartEndYear, setChartEndYear] = useState('');

  useEffect(() => {
    if (!yearOptions.length) {
      setChartStartYear('');
      setChartEndYear('');
      return;
    }
    const minY = yearOptions[0];
    const maxY = yearOptions[yearOptions.length - 1];
    const defaultStart = Number(defaultStartYear);
    const defaultEnd = Number(defaultEndYear);
    const startFallback = Number.isFinite(defaultStart) && yearOptions.includes(defaultStart) ? defaultStart : minY;
    const endFallback = Number.isFinite(defaultEnd) && yearOptions.includes(defaultEnd) ? defaultEnd : maxY;
    setChartStartYear((prev) => (yearOptions.some((y) => String(y) === prev) ? prev : String(startFallback)));
    setChartEndYear((prev) => (yearOptions.some((y) => String(y) === prev) ? prev : String(endFallback)));
  }, [yearOptions, defaultStartYear, defaultEndYear]);

  const displayRows = useMemo(() => {
    if (!enableInlineYearDropdowns) return rows;
    if (!(periodMode === 'annual' || periodMode === 'quarterly' || periodMode === 'monthly')) return rows;
    const startNum = Number(chartStartYear);
    const endNum = Number(chartEndYear);
    if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) return rows;
    const lo = Math.min(startNum, endNum);
    const hi = Math.max(startNum, endNum);
    return rows.filter((r) => r.year >= lo && r.year <= hi);
  }, [rows, periodMode, chartStartYear, chartEndYear, enableInlineYearDropdowns]);

  const stats = useMemo(() => {
    if (!displayRows.length) return null;
    const rets = displayRows.map((r) => r.totalReturn);
    const pos = displayRows.filter((r) => r.totalReturn > 0).length;
    const neg = displayRows.filter((r) => r.totalReturn < 0).length;
    const avg = rets.reduce((a, b) => a + b, 0) / rets.length;
    return {
      pos,
      neg,
      avg,
      max: Math.max(...rets),
      min: Math.min(...rets),
      med: median(rets)
    };
  }, [displayRows]);
  const selectionTotal = useMemo(() => {
    const count =
      periodMode === 'annual'
        ? new Set(displayRows.map((r) => Number(r.year)).filter((y) => Number.isFinite(y))).size
        : displayRows.length;
    const unit =
      periodMode === 'annual'
        ? count === 1
          ? 'Year'
          : 'Years'
        : periodMode === 'quarterly'
          ? count === 1
            ? 'Quarter'
            : 'Quarters'
          : periodMode === 'monthly'
            ? count === 1
              ? 'Month'
              : 'Months'
            : periodMode === 'weekly'
              ? count === 1
                ? 'Week'
                : 'Weeks'
              : periodMode === 'daily'
                ? count === 1
                  ? 'Day'
                  : 'Days'
                : count === 1
                  ? 'Period'
                  : 'Periods';
    return { count, unit };
  }, [displayRows, periodMode]);
  const seoNarrative = useMemo(
    () =>
      buildReturnNarrative({
        rows: displayRows,
        symbol,
        mode: periodMode,
        valueField: 'totalReturn'
      }),
    [displayRows, symbol, periodMode]
  );

  const pn = useMemo(() => periodModeNouns(periodMode), [periodMode]);
  const dropdownYearOptions = useMemo(
    () =>
      [...yearOptions]
        .sort((a, b) => b - a)
        .map((y) => ({ id: String(y), label: String(y) })),
    [yearOptions]
  );
  const startYearDropdownOptions = useMemo(
    () => yearOptionsForStart(dropdownYearOptions, chartEndYear),
    [dropdownYearOptions, chartEndYear]
  );
  const endYearDropdownOptions = useMemo(
    () => yearOptionsForEnd(dropdownYearOptions, chartStartYear),
    [dropdownYearOptions, chartStartYear]
  );

  const onDownloadCsv = useCallback(() => {
    if (!displayRows.length) return;
    const headers = ['period', 'year', 'startDate', 'endDate', 'totalReturn', 'startPrice', 'endPrice'];
    const lines = [
      headers.join(','),
      ...displayRows.map((r) =>
        [
          csvEscape(r.period),
          r.year,
          csvEscape(r.startDate),
          csvEscape(r.endDate),
          r.totalReturn,
          r.startPrice ?? '',
          r.endPrice ?? ''
        ].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(symbol || 'ticker').toUpperCase()}-${periodMode === 'quarterly' ? 'quarterly' : periodMode === 'monthly' ? 'monthly' : periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'annual'}-returns.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [displayRows, symbol, periodMode]);

  const onViewMore = useCallback(() => {
    const to = getReturnsChartViewMoreHref({
      pathname: location.pathname,
      search: location.search,
      periodMode,
      symbol
    });
    navigate(to);
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }, [navigate, location.pathname, location.search, periodMode, symbol]);

  const buildExportFilename = useCallback(
    () => buildTickerChartExportFilename(`${periodMode}-returns`, symbol),
    [periodMode, symbol]
  );
  const chartExportDisabled = loading || !displayRows.length;

  const onOpenPeriodPage = useCallback(() => {
    const symPart = String(symbol || '').trim() || DEFAULT_TICKER_ROUTE_SYMBOL;
    const suffix = '/' + encodeURIComponent(symPart);
    const path =
      periodMode === 'quarterly'
        ? '/statistic/ticker-quarterly'
        : periodMode === 'monthly'
          ? '/statistic/ticker-monthly'
          : periodMode === 'weekly'
            ? '/statistic/ticker-weekly'
            : periodMode === 'daily'
              ? '/statistic/ticker-daily'
              : '/statistic/ticker-annual';
    navigate(path + suffix);
  }, [navigate, periodMode, symbol]);

  const annualFigRangeControls = useMemo(() => {
    if (enableInlineYearDropdowns && (periodMode === 'annual' || periodMode === 'quarterly' || periodMode === 'monthly')) {
      return (
        <div className="ticker-annual-figma__range-inline">
          <span className="ticker-annual-figma__range-label">Start</span>
          <ThemedDropdown
            size="sm"
            value={chartStartYear}
            options={startYearDropdownOptions}
            onChange={(v) => {
              const next = applyYearStartChange(chartStartYear, chartEndYear, v);
              setChartStartYear(next.start);
              setChartEndYear(next.end);
            }}
            title="Start year"
            ariaLabelPrefix="Start year"
            labelFallback="Start"
          />
          <span className="ticker-annual-figma__range-label">End</span>
          <ThemedDropdown
            size="sm"
            value={chartEndYear}
            options={endYearDropdownOptions}
            onChange={(v) => {
              const next = applyYearEndChange(chartStartYear, chartEndYear, v);
              setChartStartYear(next.start);
              setChartEndYear(next.end);
            }}
            title="End year"
            ariaLabelPrefix="End year"
            labelFallback="End"
          />
        </div>
      );
    }
    if (toolbarControls) {
      return <div className="ticker-annual-figma__external-controls">{toolbarControls}</div>;
    }
    return null;
  }, [
    enableInlineYearDropdowns,
    periodMode,
    chartStartYear,
    chartEndYear,
    startYearDropdownOptions,
    endYearDropdownOptions,
    toolbarControls
  ]);

  const annualFigExtraActions = showOpenPeriodPageButton ? (
    <button type="button" className="ticker-annual-figma__btn ticker-annual-figma__btn--outline" onClick={onOpenPeriodPage}>
      Open {periodMode === 'quarterly' ? 'Quarterly' : periodMode === 'monthly' ? 'Monthly' : periodMode === 'weekly' ? 'Weekly' : periodMode === 'daily' ? 'Daily' : 'Annual'} Page
    </button>
  ) : null;

  const annualFigTitleBadge = (
    <div className="flex align-centers">
      <ReturnsChartPieIcon />
      <span className="ticker-annual-figma__badge uppercase">
        <ReturnsChartClickableTitle className="ticker-annual-figma__badge uppercase" onClick={onViewMore}>
          {periodMode === 'quarterly'
            ? 'Quarterly statistics'
            : periodMode === 'monthly'
              ? 'Monthly statistics'
              : periodMode === 'weekly'
                ? 'Weekly statistics'
                : periodMode === 'daily'
                  ? 'Daily statistics'
                  : 'Annual statistics'}
        </ReturnsChartClickableTitle>{' '}
        <ChartInfoTip tip={CHART_INFO_TIPS.tickerAnnualReturns} align="end" />
      </span>
    </div>
  );

  const annualFigToolbarIcons = (
    <div className="ticker-annual-figma__toolbar-icons">
      <ReturnsChartToolbar
        rangeControls={null}
        showViewMore={false}
        onToggleTable={() => setShowTable((v) => !v)}
        showTable={showTable}
        onDownload={onDownloadCsv}
        downloadDisabled={!displayRows.length}
        extraActions={annualFigExtraActions}
      />
      <ChartSectionIconActions
        snapshotRootRef={sectionRef}
        plotHostRef={chartCardRef}
        fullscreenTargetRef={chartFsShellRef}
        buildFilename={buildExportFilename}
        disabled={chartExportDisabled}
        exportPreviewAlt={`${periodMode} returns chart for ${symbol}`}
      />
    </div>
  );

  const monthlyYearLegend = useMemo(() => {
    if (periodMode !== 'monthly' || !displayRows.length) return [];
    const years = [...new Set(displayRows.map((r) => r.year))].sort((a, b) => a - b);
    return years.map((y, i) => ({ year: y, color: TICKER_RETURNS_YEAR_PALETTE[i % TICKER_RETURNS_YEAR_PALETTE.length] }));
  }, [displayRows, periodMode]);

  const summaryPlotHeight = plotPxEffective != null ? Math.min(plotPxEffective, fsPlotSize ? plotPxEffective : 320) : 240;
  const donutPlotHeight = plotPxEffective != null ? Math.min(plotPxEffective, fsPlotSize ? plotPxEffective : 220) : 220;

  if (!rows.length) {
    if (loading) {
      return (
        <AnnualReturnsFigmaChartSkeleton
          periodMode={periodMode}
          plotHeightPx={plotPx ?? resizeDefaultHeight}
          toolbarControls={toolbarControls}
          showOpenPeriodPageButton={showOpenPeriodPageButton}
          enableInlineYearDropdowns={enableInlineYearDropdowns}
        />
      );
    }
    return (
      <div className="ticker-annual-figma">
        {seoNarrative ? <p className="sr-only">{seoNarrative}</p> : null}
        <div ref={sectionRef} className="ticker-annual-figma__section">
          <div className="ticker-annual-figma__toolbar ticker-annual-figma__toolbar--split">
            <div className="ticker-annual-figma__toolbar-head">
              <ReturnsChartClickableTitle className="ticker-annual-figma__badge uppercase" onClick={onViewMore}>
                {badgeLabelForPeriodMode(periodMode)}
              </ReturnsChartClickableTitle>
              <div className="ticker-annual-figma__toolbar-icons">
                <ChartSectionIconActions
                  snapshotRootRef={sectionRef}
                  plotHostRef={chartCardRef}
                  fullscreenTargetRef={chartFsShellRef}
                  buildFilename={buildExportFilename}
                  disabled
                  exportPreviewAlt={`${badgeLabelForPeriodMode(periodMode)} for ${symbol}`}
                />
              </div>
            </div>
          </div>
          <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
            <div ref={assignChartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
              <p className="ticker-annual-figma__empty">No {badgeLabelForPeriodMode(periodMode).replace(' returns', '').toLowerCase()} return data for {String(symbol).toUpperCase()}.</p>
              {asOfDate ? <p className="ticker-annual-figma__empty-sub">As of {asOfDate}.</p> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-annual-figma">
      {seoNarrative ? <p className="sr-only">{seoNarrative}</p> : null}
      <div
        ref={sectionRef}
        className={
          'ticker-annual-figma__section ticker-annual-figma__section--chartjs' +
          (resize.enabled ? ' ticker-annual-figma__section--resize' : '')
        }
        style={
          resize.enabled && plotPx != null
            ? { '--ticker-resize-plot-h': `${Math.round(plotPx)}px` }
            : undefined
        }
      >
        <div className="ticker-annual-figma__toolbar ticker-annual-figma__toolbar--split">
          <div className="ticker-annual-figma__toolbar-head">
            {annualFigTitleBadge}
            {annualFigToolbarIcons}
          </div>
          {annualFigRangeControls ? (
            <div className="ticker-annual-figma__toolbar-range">{annualFigRangeControls}</div>
          ) : null}
        </div>
        <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
          <div ref={assignChartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--chartjs">
            {displayRows.length && stats ? (
              <StatsTickerReturnsBarChart
                rows={displayRows}
                periodMode={periodMode}
                avgReturn={stats.avg}
                plotHeight={Math.max(140, plotPxEffective ?? resizeDefaultHeight)}
                chartFullscreen={chartFs}
              />
            ) : (
              <p className="ticker-annual-figma__empty" style={{ padding: '24px 16px' }}>
                No annual rows overlap the selected start/end dates. Clear the filter or widen the range.
              </p>
            )}
          </div>
        </div>
        <div className="ticker-annual-figma__legend">
          <div className="ticker-annual-figma__legend-row">
            {periodMode === 'monthly' ? (
              monthlyYearLegend.map((it) => (
                <span key={`yl-${it.year}`} className="ticker-annual-figma__legend-item">
                  <span className="ticker-annual-figma__swatch" aria-hidden style={{ background: it.color }} />
                  {it.year}
                </span>
              ))
            ) : (
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--blue" aria-hidden />
                {pn.statsLabel} return (%)
              </span>
            )}
            <span className="ticker-annual-figma__legend-item">
              <span className="ticker-annual-figma__swatch-line" aria-hidden />
              Av. return (%)
            </span>
          </div>
          <div className="ticker-annual-figma__legend-total-years">
            Total : <strong>{selectionTotal.count}</strong> {selectionTotal.unit}
          </div>
        </div>
        {showTable ? (
          <div className="ticker-annual-figma__table-wrap">
            <table className="ticker-annual-figma__table">
              <thead>
                <tr>
                  <th>{periodMode === 'annual' ? 'Year' : 'Period'}</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Start price</th>
                  <th>End price</th>
                  <th>Total return %</th>
                </tr>
              </thead>
              <tbody>
                {[...displayRows].reverse().map((r) => (
                  <tr key={r.rowKey}>
                    <td>{periodMode === 'annual' ? r.year : r.xLabel ?? r.period}</td>
                    <td>{r.startDate ?? '—'}</td>
                    <td>{r.endDate ?? '—'}</td>
                    <td>{fmtPrice(r.startPrice)}</td>
                    <td>{fmtPrice(r.endPrice)}</td>
                    <td className={r.totalReturn >= 0 ? 'ticker-num--up' : 'ticker-num--down'}>
                      {fmtPctSigned(r.totalReturn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {resize.enabled ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-valuemin={resize.ariaMin}
            aria-valuemax={resize.ariaMax}
            aria-valuenow={resize.ariaNow}
            className="ticker-chart-resize ticker-chart-resize--scope ticker-chart-resize--in-section"
            title="Drag to resize chart height. Double-click to reset."
            onPointerDown={resize.onPointerDown}
            onDoubleClick={resize.onDoubleClick}
          />
        ) : null}
      </div>

      {!hideStatsSection ? (
        <div className="ticker-annual-figma__section">
          <div className="ticker-annual-figma__stats-head">
            <span className="ticker-annual-figma__badge">
              <ReturnsChartPieIcon />
              <span className="ticker-annual-figma__badge-text uppercase">
                {pn.statsLabel} stats — positive / negative, min max
              </span>
              <ChartInfoTip tip={CHART_INFO_TIPS.tickerAnnualStats} align="end" />
            </span>
            <div className="ticker-annual-figma__stats-actions">
              <ReturnsChartToolbar
                showViewMore={false}
                showDownload={false}
                onToggleTable={() => setShowTable((v) => !v)}
                showTable={showTable}
              />
            </div>
          </div>

          <div className="ticker-annual-figma__split">
            <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--donut ticker-annual-figma__chart-card--chartjs">
              {stats ? (
                <StatsTickerReturnsPosNegDonut
                  pos={stats.pos}
                  neg={stats.neg}
                  plotHeight={donutPlotHeight}
                  chartFullscreen={chartFs}
                />
              ) : null}
              <p className="ticker-annual-figma__total-years-caption">
                Total : <strong>{selectionTotal.count}</strong> {selectionTotal.unit}
              </p>
              <div className="ticker-annual-figma__legends ticker-annual-figma__legend--donut flex">
                <span className="ticker-annual-figma__legend-item">
                  <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--blue" aria-hidden />
                  # positive {pn.lower}
                </span>
                <span className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch" aria-hidden style={{ background: TICKER_RETURNS_COL_NEG }} />
                  # negative {pn.lower}
                </span>
              </div>
            </div>
            <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--summary ticker-annual-figma__chart-card--chartjs">
              {stats ? (
                <StatsTickerReturnsSummaryBarChart
                  stats={stats}
                  plotHeight={summaryPlotHeight}
                  chartFullscreen={chartFs}
                />
              ) : null}
              {stats ? (
                <div className="ticker-annual-figma__summary-total-years">
                  Total : <strong>{selectionTotal.count}</strong> {selectionTotal.unit}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
