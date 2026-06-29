'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { ChartDateApplyRow } from './ChartDateApplyRow.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { formatWeekAxisDate, isoYearWeekFromIsoDate } from '../utils/isoWeek.js';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';
import { useChartFullscreenPlotSize } from '../hooks/useChartFullscreenPlotSize.js';
import { getReturnsChartViewMoreHref } from '../utils/returnsViewMoreNavigation.js';
import { DEFAULT_TICKER_ROUTE_SYMBOL } from '../utils/tickerUrlSync.js';
import { fmtPctSigned } from '../utils/formatDisplayNumber.js';
import { MonthlyReturnsChartSkeleton } from './ChartSkeletons.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ReturnsChartClickableTitle } from './ReturnsChartClickableTitle.jsx';
import { ChartSectionIconActions, useChartFullscreen } from './ChartSectionIconActions.jsx';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';
import { ReturnsChartPieIcon } from './returnsChartToolbarIcons.jsx';
import { buildReturnNarrative } from '../utils/seoChartNarratives.js';
import { StatsPeriodSlotReturnsBarChart } from './StatsPeriodSlotReturnsBarChart.jsx';
import { TICKER_RETURNS_COL_AVG } from './StatsTickerReturnsBarChart.jsx';

const DEFAULT_YEAR = 2025;
/** Weekly statistic chart year picker lists every calendar year in this span (descending in UI). */
const WEEKLY_YEAR_SELECT_MIN = 1980;

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

function parseMonthRow(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function parseWeekRow(period) {
  const m = String(period || '').match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  if (!Number.isFinite(year) || week < 1 || week > 53) return null;
  return { year, month: week };
}

/** Slot weekly rows on the ISO week grid using api isoYear/isoWeek or period (YYYY-Www or end date). */
function weeklyRowMeta(r) {
  const wy = Number(r?.isoYear);
  const wk = Number(r?.isoWeek);
  if (Number.isFinite(wy) && Number.isFinite(wk) && wk >= 1 && wk <= 53) {
    return { year: wy, month: wk };
  }
  const fromLegacy = parseWeekRow(r.period);
  if (fromLegacy) return fromLegacy;
  const p = String(r?.period || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const iw = isoYearWeekFromIsoDate(p);
    if (iw && iw.week >= 1 && iw.week <= 53) return { year: iw.year, month: iw.week };
  }
  return null;
}

function parseDailyRow(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month: day };
}

/**
 * Monthly returns for one calendar year (Figma-style), with year dropdown + info tip.
 * @param {{ symbol: string, monthlyReturns?: unknown[], asOfDate?: string, plotHeight?: number, resizeStorageKey?: string, resizeDefaultHeight?: number, persistPlotResize?: boolean, periodMode?: 'monthly' | 'weekly' | 'daily', suppressChartDateFilter?: boolean, showOpenPeriodPageButton?: boolean, useThemedYearDropdown?: boolean, defaultToLatestYear?: boolean, hideChartDateApplyRow?: boolean, chartToolbarExtras?: import('react').ReactNode, loading?: boolean }} props
 */
export function TickerMonthlyReturnsChart({
  symbol,
  monthlyReturns,
  asOfDate,
  plotHeight,
  resizeStorageKey,
  resizeDefaultHeight = 278,
  persistPlotResize = true,
  periodMode = 'monthly',
  suppressChartDateFilter = false,
  showOpenPeriodPageButton = false,
  useThemedYearDropdown = false,
  defaultToLatestYear = false,
  hideChartDateApplyRow = false,
  chartToolbarExtras = null,
  loading = false
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMonthlyMode = periodMode === 'monthly';
  const [showTable, setShowTable] = useState(false);
  const [rangeApplied, setRangeApplied] = useState({ start: '', end: '' });
  const showDateApplyRow = !isMonthlyMode && !suppressChartDateFilter && !hideChartDateApplyRow;
  const sectionRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartFsShellRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const assignChartCardRef = useCallback((el) => {
    chartCardRef.current = el;
  }, []);
  const { isFullscreen: chartFs } = useChartFullscreen(chartFsShellRef);
  const resize = useTickerPlotResize(resizeStorageKey ?? null, resizeDefaultHeight, undefined, undefined, persistPlotResize);
  const plotPx = resize.plotHeight ?? plotHeight;
  const fsPlotSize = useChartFullscreenPlotSize(chartFsShellRef);
  const plotPxEffective = fsPlotSize?.height ?? plotPx;

  const rows = useMemo(() => {
    if (!Array.isArray(monthlyReturns)) return [];
    const out = [];
    for (const r of monthlyReturns) {
      const meta =
        periodMode === 'weekly'
          ? weeklyRowMeta(r)
          : periodMode === 'daily'
            ? parseDailyRow(r.period)
            : parseMonthRow(r.period);
      if (!meta) continue;
      const tr = Number(r.totalReturn);
      if (!Number.isFinite(tr)) continue;
      out.push({
        period: r.period,
        startDate: r.startDate,
        endDate: r.endDate,
        totalReturn: tr,
        year: meta.year,
        month: meta.month
      });
    }
    out.sort((a, b) => a.year - b.year || a.month - b.month);
    return out;
  }, [monthlyReturns, periodMode]);

  const filteredRows = useMemo(
    () =>
      suppressChartDateFilter ? rows : filterReturnsRows(rows, rangeApplied.start, rangeApplied.end),
    [rows, rangeApplied.start, rangeApplied.end, suppressChartDateFilter]
  );

  const availableYears = useMemo(() => {
    const ys = [...new Set(filteredRows.map((r) => r.year))].sort((a, b) => b - a);
    return ys;
  }, [filteredRows]);

  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);

  useEffect(() => {
    if (!availableYears.length) return;
    setSelectedYear((prev) => {
      if (availableYears.includes(prev)) return prev;
      if (defaultToLatestYear) return availableYears[0];
      return availableYears.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : availableYears[0];
    });
  }, [availableYears, defaultToLatestYear]);

  const monthValues = useMemo(() => {
    const size = periodMode === 'weekly' ? 53 : periodMode === 'daily' ? 31 : 12;
    const arr = Array.from({ length: size }, () => null);
    for (const r of filteredRows) {
      if (r.year === selectedYear && r.month >= 1 && r.month <= size) arr[r.month - 1] = r.totalReturn;
    }
    return arr;
  }, [filteredRows, selectedYear, periodMode]);

  /** Map ISO week index (1–53) → short date label for the x-axis (week ending). */
  const weekAxisLabels = useMemo(() => {
    const m = new Map();
    if (periodMode !== 'weekly') return m;
    for (const r of filteredRows) {
      if (r.year !== selectedYear) continue;
      const slot = r.month;
      if (slot < 1 || slot > 53) continue;
      const end = String(r.endDate || '').slice(0, 10);
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : String(r.period || '').slice(0, 10);
      const lbl = formatWeekAxisDate(iso);
      if (lbl) m.set(slot, lbl);
    }
    return m;
  }, [filteredRows, selectedYear, periodMode]);

  const { yMin, yMax } = useMemo(() => {
    const vals = monthValues.filter((v) => v != null && Number.isFinite(v));
    if (!vals.length) return { yMin: -15, yMax: 25 };
    let lo = Math.min(-15, ...vals);
    let hi = Math.max(25, ...vals);
    lo = Math.floor(lo / 5) * 5;
    hi = Math.ceil(hi / 5) * 5;
    if (hi <= lo) hi = lo + 5;
    return { yMin: lo, yMax: hi };
  }, [monthValues]);
  const avgReturn = useMemo(() => {
    const vals = monthValues.filter((v) => v != null && Number.isFinite(v));
    if (!vals.length) return null;
    return vals.reduce((sum, v) => sum + Number(v), 0) / vals.length;
  }, [monthValues]);

  const symU = String(symbol || 'ticker').toUpperCase();
  const yearOptions = useMemo(() => {
    if (hideChartDateApplyRow && periodMode === 'weekly') {
      if (availableYears.length) return availableYears;
      const hi = Math.max(2026, new Date().getFullYear());
      const arr = [];
      for (let y = hi; y >= WEEKLY_YEAR_SELECT_MIN; y -= 1) arr.push(y);
      return arr;
    }
    return availableYears.length ? availableYears : [DEFAULT_YEAR];
  }, [hideChartDateApplyRow, periodMode, availableYears]);
  /** Always present newest-first (2026, 2025, …) in menus and native selects. */
  const sortedYearOptionsDesc = useMemo(
    () => [...yearOptions].sort((a, b) => b - a),
    [yearOptions]
  );
  const yearDropdownOptions = useMemo(
    () => sortedYearOptionsDesc.map((y) => ({ id: String(y), label: String(y) })),
    [sortedYearOptionsDesc]
  );
  const selectedYearRows = useMemo(
    () => filteredRows.filter((r) => r.year === selectedYear).sort((a, b) => a.month - b.month),
    [filteredRows, selectedYear]
  );
  const seoNarrative = useMemo(
    () =>
      buildReturnNarrative({
        rows: selectedYearRows,
        symbol,
        mode: periodMode,
        valueField: 'totalReturn'
      }),
    [selectedYearRows, symbol, periodMode]
  );
  const onDownloadCsv = useCallback(() => {
    if (!selectedYearRows.length) return;
    const headers = ['period', 'year', 'month', 'startDate', 'endDate', 'totalReturn'];
    const lines = [
      headers.join(','),
      ...selectedYearRows.map((r) =>
        [csvEscape(r.period), r.year, r.month, csvEscape(r.startDate), csvEscape(r.endDate), r.totalReturn].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symU}-${periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'monthly'}-returns-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedYearRows, selectedYear, symU, periodMode]);

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
  const chartExportDisabled = loading || !selectedYearRows.length;

  const onOpenPeriodPage = useCallback(() => {
    const symPart = String(symbol || '').trim() || DEFAULT_TICKER_ROUTE_SYMBOL;
    const suffix = '/' + encodeURIComponent(symPart);
    const base =
      periodMode === 'weekly'
        ? '/statistic/ticker-weekly'
        : periodMode === 'daily'
          ? '/statistic/ticker-daily'
          : '/statistic/ticker-monthly';
    navigate(base + suffix);
  }, [navigate, periodMode, symbol]);

  const showYearInToolbar = isMonthlyMode || hideChartDateApplyRow;

  const yearDropdownMenuMaxHeight =
    hideChartDateApplyRow && periodMode === 'weekly' ? 'min(260px, 45vh)' : undefined;

  const renderYearDropdown = (buttonId) => (
    <ThemedDropdown
      buttonId={buttonId}
      className="ticker-monthly__select-dd"
      size="sm"
      value={String(selectedYear)}
      options={yearDropdownOptions}
      onChange={(v) => setSelectedYear(Number(v))}
      title="Year"
      ariaLabelPrefix="Year"
      labelFallback={String(selectedYear)}
      menuMaxHeight={yearDropdownMenuMaxHeight}
    />
  );

  const yearToolbarDropdown =
    !suppressChartDateFilter || useThemedYearDropdown ? (
      <div className="ticker-monthly__select-wrap ticker-monthly__select-wrap--toolbar">
        <label className="ticker-monthly__select-label" htmlFor="ticker-monthly-year-toolbar">
          Year
        </label>
        {renderYearDropdown('ticker-monthly-year-toolbar')}
      </div>
    ) : null;

  const yearTrailingSelect =
    !isMonthlyMode && !suppressChartDateFilter && !hideChartDateApplyRow ? (
      <div className="ticker-monthly__select-wrap">
        <label className="ticker-monthly__select-label" htmlFor="ticker-monthly-year-trailing">
          Year
        </label>
        {renderYearDropdown('ticker-monthly-year-trailing')}
      </div>
    ) : null;

  const monthlyRangeControls = (
    <>
      {chartToolbarExtras}
      {showYearInToolbar ? yearToolbarDropdown : yearTrailingSelect}
    </>
  );

  const monthlyExtraActions = showOpenPeriodPageButton ? (
    <button type="button" className="ticker-annual-figma__btn ticker-annual-figma__btn--outline shrink-0" onClick={onOpenPeriodPage}>
      Open {periodMode === 'weekly' ? 'Weekly' : periodMode === 'daily' ? 'Daily' : 'Monthly'} Page
    </button>
  ) : null;

  const monthlyTitleLabel =
    periodMode === 'weekly' ? 'WEEKLY STATISTICS' : periodMode === 'daily' ? 'DAILY STATISTICS' : 'MONTHLY STATISTICS';

  const hasMonthlyHeadRange =
    Boolean(chartToolbarExtras) ||
    Boolean(showYearInToolbar) ||
    Boolean(!isMonthlyMode && !suppressChartDateFilter && !hideChartDateApplyRow);

  const renderMonthlyHead = (iconsDisabled) => (
    <div className="ticker-monthly__head ticker-monthly__head--split">
      <div className="ticker-monthly__title-block">
        <div className="flex align-centers">
          <ReturnsChartPieIcon />
        </div>
        <ReturnsChartClickableTitle className="ticker-monthly__title uppercase" onClick={onViewMore}>
          {monthlyTitleLabel}
        </ReturnsChartClickableTitle>
        <ChartInfoTip
          tip={!rows.length && !loading ? CHART_INFO_TIPS.monthlyReturnsByYear : CHART_INFO_TIPS.monthlyReturnsChart}
          align="end"
        />
      </div>
      <div className="ticker-monthly__head-icons">
        {hasMonthlyHeadRange ? (
          <div className="ticker-monthly__head-controls">{monthlyRangeControls}</div>
        ) : null}
        <ReturnsChartToolbar
          className="ticker-monthly__toolbar-icons-bar"
          rangeControls={null}
          showViewMore={false}
          onToggleTable={() => setShowTable((v) => !v)}
          showTable={showTable}
          onDownload={onDownloadCsv}
          downloadDisabled={iconsDisabled || !selectedYearRows.length}
          extraActions={monthlyExtraActions}
        />
        <ChartSectionIconActions
          snapshotRootRef={sectionRef}
          plotHostRef={chartCardRef}
          fullscreenTargetRef={chartFsShellRef}
          buildFilename={buildExportFilename}
          disabled={iconsDisabled || chartExportDisabled}
          exportPreviewAlt={`${periodMode} returns chart for ${symU}`}
        />
      </div>
    </div>
  );

  if (!rows.length) {
    if (loading) {
      return (
        <MonthlyReturnsChartSkeleton
          periodMode={periodMode}
          plotHeightPx={plotPx ?? resizeDefaultHeight}
          resizeEnabled={resize.enabled}
        />
      );
    }
    return (
      <div className="ticker-monthly">
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
          {renderMonthlyHead(true)}
          {showDateApplyRow ? (
            <ChartDateApplyRow
              idPrefix="monthly-returns-empty"
              maxDate={asOfDate}
              onApply={({ start, end }) => setRangeApplied({ start, end })}
            />
          ) : null}
          <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
            <div ref={assignChartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
              <p className="ticker-annual-figma__empty">
                No {periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'monthly'} return data for <strong>{symU}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-monthly">
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
        {renderMonthlyHead(false)}
        {showDateApplyRow ? (
          <ChartDateApplyRow
            idPrefix="monthly-returns"
            maxDate={asOfDate}
            onApply={({ start, end }) => setRangeApplied({ start, end })}
          />
        ) : null}

        <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
          <div ref={assignChartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--chartjs">
            {rows.length > 0 && !filteredRows.length ? (
              <p className="ticker-annual-figma__empty" style={{ padding: '1.25rem' }}>
                No monthly rows overlap the selected date range.
              </p>
            ) : (
              <StatsPeriodSlotReturnsBarChart
                slotValues={monthValues}
                periodMode={periodMode}
                weekAxisLabels={weekAxisLabels}
                avgReturn={avgReturn}
                yMin={yMin}
                yMax={yMax}
                plotHeight={Math.max(140, plotPxEffective ?? resizeDefaultHeight)}
                chartFullscreen={chartFs}
              />
            )}
          </div>
        </div>

        <div className="ticker-annual-figma__legends ticker-monthly__legend justify-center" >
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-monthly__swatch" aria-hidden />
            {selectedYear}
          </span>
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-annual-figma__swatch-line" style={{ borderTopColor: TICKER_RETURNS_COL_AVG }} aria-hidden />
            Avg return
          </span>
        </div>
        {showTable ? (
          <div className="ticker-annual-figma__table-wrap">
            <table className="ticker-annual-figma__table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Total Return</th>
                </tr>
              </thead>
              <tbody>
                {[...selectedYearRows].reverse().map((r) => (
                  <tr key={`mr-row-${r.period}`}>
                    <td>{r.period}</td>
                    <td>{r.startDate || '—'}</td>
                    <td>{r.endDate || '—'}</td>
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
    </div>
  );
}
