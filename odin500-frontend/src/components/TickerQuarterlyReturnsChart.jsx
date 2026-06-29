'use client';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { useChartFullscreenPlotSize } from '../hooks/useChartFullscreenPlotSize.js';
import { chartSvgPreserveAspectRatio, tickerSvgPlotStyle } from '../utils/tickerChartResize.js';
import { getReturnsChartViewMoreHref } from '../utils/returnsViewMoreNavigation.js';
import { DEFAULT_TICKER_ROUTE_SYMBOL } from '../utils/tickerUrlSync.js';
import { QuarterlyDualPanelChartSkeleton, QuarterlyReturnsToolbarBadge } from './ChartSkeletons.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ChartSectionIconActions, useChartFullscreen } from './ChartSectionIconActions.jsx';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';
import { chartAxisLabelColors } from '../utils/chartAxisLabelColors.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { fmtPct, fmtPctSigned } from '../utils/formatDisplayNumber.js';
import { buildReturnNarrative } from '../utils/seoChartNarratives.js';

const COL_GRID = 'rgba(148, 163, 184, 0.14)';
const COL_GRID_ZERO = 'rgba(148, 163, 184, 0.35)';

/** Q1–Q4 colors (left chart series). */
const QUARTER_COLORS = ['#38bdf8', '#f97316', '#64748b', '#eab308'];

/** Distinct colors per calendar year (right chart series), dark-mode friendly. */
const YEAR_PALETTE = ['#38bdf8', '#f97316', '#64748b', '#eab308', '#7dd3fc', '#a78bfa', '#34d399', '#fb7185', '#f472b6', '#22d3ee'];

/** @param {string} period e.g. "2022-Q1" */
function parseQuarter(period) {
  const m = String(period || '').match(/^(\d{4})-Q([1-4])$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const q = parseInt(m[2], 10);
  if (!Number.isFinite(year) || q < 1 || q > 4) return null;
  return { year, q };
}

function yForValue(v, innerTop, innerH, yMin, yMax) {
  const c = Math.min(yMax, Math.max(yMin, v));
  return innerTop + ((yMax - c) / (yMax - yMin)) * innerH;
}

function buildRows(quarterlyReturns) {
  if (!Array.isArray(quarterlyReturns)) return [];
  const out = [];
  for (const r of quarterlyReturns) {
    const meta = parseQuarter(r.period);
    if (!meta) continue;
    const tr = Number(r.totalReturn);
    if (!Number.isFinite(tr)) continue;
    out.push({
      period: r.period,
      startDate: r.startDate,
      endDate: r.endDate,
      totalReturn: tr,
      year: meta.year,
      q: meta.q
    });
  }
  out.sort((a, b) => a.year - b.year || a.q - b.q);
  return out;
}

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

/** Tailwind-only caption under quarterly panel SVGs (above legend). */
const QTR_TOTAL_YEARS_CAPTION =
  'm-0 w-full shrink-0 px-2 pt-1.5 pb-0 text-center text-[0.72rem] font-semibold leading-snug';

const QTR_TOTAL_YEARS_STRONG = 'font-extrabold text-slate-900 dark:text-slate-100';

/**
 * Two grouped quarterly bar charts (by year | by quarter), dark UI + per-panel info tips.
 * @param {{ symbol: string, quarterlyReturns?: unknown[], quarterlyReturnsAll?: unknown[], asOfDate?: string, plotHeight?: number, showOpenPeriodPageButton?: boolean, toolbarControls?: import('react').ReactNode, loading?: boolean }} props
 */
export function TickerQuarterlyReturnsChart({
  symbol,
  quarterlyReturns,
  quarterlyReturnsAll,
  asOfDate,
  plotHeight,
  showOpenPeriodPageButton = false,
  toolbarControls = null,
  loading = false
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const sectionRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartFsShellRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const { isFullscreen: chartFs } = useChartFullscreen(chartFsShellRef);
  const fsPlotSize = useChartFullscreenPlotSize(chartFsShellRef);
  const plotHeightEffective = fsPlotSize?.height ?? plotHeight;
  const panelWidthEffective = fsPlotSize ? Math.max(280, Math.floor(fsPlotSize.width / 2) - 28) : 460;
  const svgFs = Boolean(fsPlotSize);
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const { axis: colAxis, label: colLabel } = useMemo(
    () => chartAxisLabelColors(chartTheme),
    [chartTheme]
  );
  const rowsAll = useMemo(() => buildRows(quarterlyReturnsAll ?? quarterlyReturns), [quarterlyReturnsAll, quarterlyReturns]);
  const rows = useMemo(() => buildRows(quarterlyReturns), [quarterlyReturns]);
  const [showTable, setShowTable] = useState(false);
  const filteredRows = useMemo(() => rows, [rows]);

  const { years, byYear, byQuarter, yMin, yMax } = useMemo(() => {
    if (!filteredRows.length) {
      return { years: [], byYear: new Map(), byQuarter: [{}, {}, {}, {}], yMin: -30, yMax: 50 };
    }
    const byYear = new Map();
    const byQuarter = [{}, {}, {}, {}];
    const vals = [];
    for (const r of filteredRows) {
      vals.push(r.totalReturn);
      if (!byYear.has(r.year)) byYear.set(r.year, {});
      byYear.get(r.year)[r.q] = r.totalReturn;
      byQuarter[r.q - 1][r.year] = r.totalReturn;
    }
    const years = [...new Set(filteredRows.map((x) => x.year))].sort((a, b) => a - b);
    const minR = Math.min(...vals);
    const maxR = Math.max(...vals);
    const yMin = Math.min(-30, Math.floor(minR / 10) * 10);
    const yMax = Math.max(50, Math.ceil(maxR / 10) * 10);
    return { years, byYear, byQuarter, yMin, yMax };
  }, [filteredRows]);

  const yearColors = useMemo(() => {
    const m = new Map();
    years.forEach((y, i) => m.set(y, YEAR_PALETTE[i % YEAR_PALETTE.length]));
    return m;
  }, [years]);

  const totalYearsInSelection = years.length;
  const seoNarrative = useMemo(
    () =>
      buildReturnNarrative({
        rows: filteredRows,
        symbol,
        mode: 'quarterly',
        valueField: 'totalReturn'
      }),
    [filteredRows, symbol]
  );

  const leftSvg = useMemo(() => {
    if (!years.length) return null;
    const W = panelWidthEffective;
    const H = Math.max(200, plotHeightEffective ?? 288);
    const padL = 50;
    const padR = 14;
    const padT = 18;
    const padB = 58;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const n = years.length;
    const groupW = iw / n;
    const innerPad = 0.12 * groupW;
    const clusterW = groupW - innerPad * 2;
    const barW = clusterW / 4 - 1;

    const yTicks = [];
    for (let t = yMin; t <= yMax + 1e-9; t += 10) yTicks.push(t);

    const gridLines = yTicks.map((t, ti) => {
      const y = yForValue(t, padT, ih, yMin, yMax);
      return (
        <g key={`yl-${ti}-${t}`}>
          <line
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke={t === 0 ? COL_GRID_ZERO : COL_GRID}
            strokeWidth={t === 0 ? 1.35 : 1}
          />
          <text x={padL - 8} y={y + 4} textAnchor="end" fill={colAxis} fontSize="10" fontWeight="600">
            {fmtPct(t, { plainPositive: true })}
          </text>
        </g>
      );
    });

    const bars = [];
    years.forEach((yr, gi) => {
      const gx = padL + gi * groupW + innerPad;
      const ymap = byYear.get(yr) || {};
      for (let qi = 0; qi < 4; qi++) {
        const q = qi + 1;
        const v = ymap[q];
        if (!Number.isFinite(v)) continue;
        const x = gx + qi * (barW + 1);
        const y0 = yForValue(0, padT, ih, yMin, yMax);
        const y1 = yForValue(v, padT, ih, yMin, yMax);
        const top = Math.min(y0, y1);
        const h = Math.abs(y1 - y0);
        const showLab = chartFs || h >= 14;
        const labY = v >= 0 ? top - 4 : top + h + 11;
        bars.push(
          <g key={`${yr}-Q${q}`}>
            <rect x={x} y={top} width={barW} height={Math.max(h, 1)} rx={1.5} fill={QUARTER_COLORS[qi]} />
            {showLab ? (
              <text x={x + barW / 2} y={labY} textAnchor="middle" fill={colLabel} fontSize="8" fontWeight="700">
                {fmtPct(v, { plainPositive: true })}
              </text>
            ) : null}
          </g>
        );
      }
    });

    const xLabels = years.map((yr, gi) => {
      const cx = padL + gi * groupW + groupW / 2;
      return (
        <text key={yr} x={cx} y={H - 20} textAnchor="middle" fill={colAxis} fontSize="11" fontWeight="600">
          {yr}
        </text>
      );
    });

    return (
      <svg
        className="ticker-annual-figma__svg ticker-quarterly__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio={chartSvgPreserveAspectRatio(svgFs)}
        style={tickerSvgPlotStyle(plotHeightEffective, { fullscreen: svgFs })}
      >
        {gridLines}
        {bars}
        {xLabels}
      </svg>
    );
  }, [chartFs, colAxis, colLabel, years, byYear, yMin, yMax, panelWidthEffective, plotHeightEffective, svgFs]);

  const rightSvg = useMemo(() => {
    if (!years.length) return null;
    const W = panelWidthEffective;
    const H = Math.max(200, plotHeightEffective ?? 288);
    const padL = 50;
    const padR = 14;
    const padT = 18;
    const padB = 58;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const nQ = 4;
    const groupW = iw / nQ;
    const innerPad = 0.12 * groupW;
    const ny = years.length;
    const clusterW = groupW - innerPad * 2;
    const barW = ny > 0 ? clusterW / ny - 0.75 : 0;

    const yTicks = [];
    for (let t = yMin; t <= yMax + 1e-9; t += 10) yTicks.push(t);

    const gridLines = yTicks.map((t, ti) => (
      <g key={`yr-${ti}-${t}`}>
        <line
          x1={padL}
          y1={yForValue(t, padT, ih, yMin, yMax)}
          x2={W - padR}
          y2={yForValue(t, padT, ih, yMin, yMax)}
          stroke={t === 0 ? COL_GRID_ZERO : COL_GRID}
          strokeWidth={t === 0 ? 1.35 : 1}
        />
        <text x={padL - 8} y={yForValue(t, padT, ih, yMin, yMax) + 4} textAnchor="end" fill={colAxis} fontSize="10" fontWeight="600">
          {fmtPct(t, { plainPositive: true })}
        </text>
      </g>
    ));

    const bars = [];
    for (let qi = 0; qi < 4; qi++) {
      const q = qi + 1;
      const gx = padL + qi * groupW + innerPad;
      const ymap = byQuarter[qi];
      years.forEach((yr, yi) => {
        const v = ymap[yr];
        if (!Number.isFinite(v)) return;
        const x = gx + yi * (barW + 0.75);
        const y0 = yForValue(0, padT, ih, yMin, yMax);
        const y1 = yForValue(v, padT, ih, yMin, yMax);
        const top = Math.min(y0, y1);
        const h = Math.abs(y1 - y0);
        const showLab = chartFs || (h >= 14 && barW >= 10);
        const labY = v >= 0 ? top - 3 : top + h + 10;
        bars.push(
          <g key={`Q${q}-${yr}`}>
            <rect x={x} y={top} width={barW} height={Math.max(h, 1)} rx={1.5} fill={yearColors.get(yr)} />
            {showLab ? (
              <text x={x + barW / 2} y={labY} textAnchor="middle" fill={colLabel} fontSize="7.5" fontWeight="700">
                {fmtPct(v, { plainPositive: true })}
              </text>
            ) : null}
          </g>
        );
      });
    }

    const xLabels = [1, 2, 3, 4].map((q, qi) => {
      const cx = padL + qi * groupW + groupW / 2;
      return (
        <text key={q} x={cx} y={H - 20} textAnchor="middle" fill={colAxis} fontSize="11" fontWeight="600">
          Q{q}
        </text>
      );
    });

    return (
      <svg
        className="ticker-annual-figma__svg ticker-quarterly__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio={chartSvgPreserveAspectRatio(svgFs)}
        style={tickerSvgPlotStyle(plotHeightEffective, { fullscreen: svgFs })}
      >
        {gridLines}
        {bars}
        {xLabels}
      </svg>
    );
  }, [chartFs, colAxis, colLabel, years, byQuarter, yearColors, yMin, yMax, panelWidthEffective, plotHeightEffective, svgFs]);

  const symU = String(symbol || 'ticker').toUpperCase();

  const onDownloadCsv = useCallback(() => {
    if (!filteredRows.length) return;
    const headers = ['period', 'year', 'quarter', 'startDate', 'endDate', 'totalReturn'];
    const lines = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [csvEscape(r.period), r.year, `Q${r.q}`, csvEscape(r.startDate), csvEscape(r.endDate), r.totalReturn].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symU}-quarterly-returns.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, symU]);

  const onViewMore = useCallback(() => {
    const to = getReturnsChartViewMoreHref({
      pathname: location.pathname,
      search: location.search,
      periodMode: 'quarterly',
      symbol
    });
    navigate(to);
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }, [navigate, location.pathname, location.search, symbol]);

  const buildExportFilename = useCallback(
    () => buildTickerChartExportFilename('quarterly-returns', symbol),
    [symbol]
  );
  const chartExportDisabled = loading || !filteredRows.length;

  const onOpenQuarterlyPage = useCallback(() => {
    const symPart = String(symbol || '').trim() || DEFAULT_TICKER_ROUTE_SYMBOL;
    navigate('/statistic/ticker-quarterly/' + encodeURIComponent(symPart));
  }, [navigate, symbol]);

  const quarterlyRangeControls = toolbarControls ? (
    <div className="ticker-annual-figma__external-controls">{toolbarControls}</div>
  ) : null;

  const quarterlyExtraActions = showOpenPeriodPageButton ? (
    <button type="button" className="ticker-annual-figma__btn ticker-annual-figma__btn--outline shrink-0" onClick={onOpenQuarterlyPage}>
      Open Quarterly Page
    </button>
  ) : null;

  if (!rowsAll.length) {
    if (loading) {
      return <QuarterlyDualPanelChartSkeleton toolbarControls={toolbarControls} />;
    }
    return (
      <div className="ticker-quarterly">
        {seoNarrative ? <p className="sr-only">{seoNarrative}</p> : null}
        <div ref={sectionRef} className="ticker-annual-figma__section">
          <div className="ticker-annual-figma__toolbar">
            <QuarterlyReturnsToolbarBadge onClick={onViewMore} />
            <ChartSectionIconActions
              snapshotRootRef={sectionRef}
              plotHostRef={chartCardRef}
              fullscreenTargetRef={chartFsShellRef}
              buildFilename={buildExportFilename}
              disabled
              exportPreviewAlt={`Quarterly returns for ${symU}`}
            />
          </div>
          <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
            <div ref={chartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
              <p className="ticker-annual-figma__empty">
                No quarterly return data for <strong>{symU}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-quarterly">
      {seoNarrative ? <p className="sr-only">{seoNarrative}</p> : null}
      <div ref={sectionRef} className="ticker-annual-figma__section">
        <div className="ticker-annual-figma__toolbar">
          <QuarterlyReturnsToolbarBadge onClick={onViewMore} />
          <div className="ticker-annual-figma__toolbar-end">
            <ReturnsChartToolbar
              rangeControls={quarterlyRangeControls}
              showViewMore={false}
              onToggleTable={() => setShowTable((v) => !v)}
              showTable={showTable}
              onDownload={onDownloadCsv}
              downloadDisabled={!filteredRows.length}
              extraActions={quarterlyExtraActions}
            />
            <ChartSectionIconActions
              snapshotRootRef={sectionRef}
              plotHostRef={chartCardRef}
              fullscreenTargetRef={chartFsShellRef}
              buildFilename={buildExportFilename}
              disabled={chartExportDisabled}
              exportPreviewAlt={`Quarterly returns chart for ${symU}`}
            />
          </div>
        </div>
        {rows.length > 0 && !filteredRows.length ? (
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
            <p className="ticker-annual-figma__empty">No quarterly rows overlap the selected date range.</p>
          </div>
        ) : (
          <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
          <div ref={chartCardRef} className="ticker-quarterly__split">
          <div className="ticker-quarterly__panel ticker-annual-figma__chart-card">
            <div className="ticker-quarterly__panel-head">
              <span className="ticker-quarterly__panel-spacer" aria-hidden />
              <h3 className="ticker-quarterly__panel-title">By calendar year</h3>
              <div className="ticker-quarterly__panel-tip">
                <ChartInfoTip tip={CHART_INFO_TIPS.quarterlyByYear} align="end" />
              </div>
            </div>
            {leftSvg}
            <p className={QTR_TOTAL_YEARS_CAPTION}>
              Total years: <strong className={QTR_TOTAL_YEARS_STRONG}>{totalYearsInSelection}</strong>
            </p>
            <div className="ticker-quarterly__legend-row">
              {[1, 2, 3, 4].map((q) => (
                <span key={q} className="ticker-annual-figma__legend-item">
                  <span className="ticker-quarterly__swatch-mini" style={{ background: QUARTER_COLORS[q - 1] }} aria-hidden />
                  Q{q}
                </span>
              ))}
            </div>
          </div>

          <div className="ticker-quarterly__panel ticker-annual-figma__chart-card">
            <div className="ticker-quarterly__panel-head">
              <span className="ticker-quarterly__panel-spacer" aria-hidden />
              <h3 className="ticker-quarterly__panel-title">By quarter</h3>
              <div className="ticker-quarterly__panel-tip">
                <ChartInfoTip tip={CHART_INFO_TIPS.quarterlyByQuarter} align="end" />
              </div>
            </div>
            {rightSvg}
            <p className={QTR_TOTAL_YEARS_CAPTION}>
              Total years: <strong className={QTR_TOTAL_YEARS_STRONG}>{totalYearsInSelection}</strong>
            </p>
            <div className="ticker-quarterly__legend-row ticker-quarterly__legend-row--wrap">
              {years.map((yr) => (
                <span key={yr} className="ticker-annual-figma__legend-item">
                  <span className="ticker-quarterly__swatch-mini" style={{ background: yearColors.get(yr) }} aria-hidden />
                  {yr}
                </span>
              ))}
            </div>
          </div>
        </div>
        </div>
        )}
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
                {[...filteredRows].reverse().map((r) => (
                  <tr key={`qr-row-${r.period}`}>
                    <td>{r.period}</td>
                    <td>{r.startDate || '—'}</td>
                    <td>{r.endDate || '—'}</td>
                    <td className={r.totalReturn >= 0 ? 'ticker-num--up' : 'ticker-num--down'}>
                      {r.totalReturn >= 0 ? '+' : ''}
                      {fmtPctSigned(r.totalReturn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
