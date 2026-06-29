'use client';
import { useCallback, useMemo, useRef } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { ReturnsChartClickableTitle } from './ReturnsChartClickableTitle.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ChartSectionIconActions } from './ChartSectionIconActions.jsx';
import { buildRelativeStrengthTickerHref } from '../utils/relativeStrengthNavigation.js';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';
import { fmtPctSigned, formatRelativePerfPct } from '../utils/marketCalculations.js';
import { ReturnsChartPieIcon } from './returnsChartToolbarIcons.jsx';
import { useGatedCsvDownload } from '../hooks/useGatedCsvDownload.js';

/** Green / red text for diff column (reuses ticker theme tokens). */
function valueToneClass(v) {
  if (v == null || !Number.isFinite(v)) return '';
  if (v > 0) return 'ticker-num--up';
  if (v < 0) return 'ticker-num--down';
  return '';
}

/** “Nice” step for axis ticks (similar spirit to chart tick heuristics). */
function niceChartStep(span, maxTicks = 7) {
  if (!Number.isFinite(span) || span <= 0) return 0.5;
  const raw = span / Math.max(2, maxTicks - 1);
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

/** Swatch colors for the two RS comparison tickers (left / right dropdown). */
const S17_COMPARISON_LEGEND_COLORS = ['#2563eb', '#64748b'];
const S17_DIFF_BAR_GRADIENT = 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)';

/** Y-axis / tick labels for relative-strength bar chart. */
function formatAxisPct(v) {
  return formatRelativePerfPct(v);
}

/** Linear map: axisMax → 0%, axisMin → 100%. */
function yPct(axisMax, axisMin, value) {
  const range = axisMax - axisMin;
  if (!Number.isFinite(range) || range <= 0) return 50;
  return ((axisMax - value) / range) * 100;
}

function buildRelativeStrengthChart(chartRows) {
  if (!chartRows.length) {
    return { ticks: [], bars: [], zeroTopPct: 50, fmtTick: formatAxisPct };
  }

  const vals = chartRows.map((r) => (Number.isFinite(r.value) ? Number(r.value) : null)).filter((v) => v != null);

  if (!vals.length) {
    const bars = chartRows.map((r, i) => ({
      key: `${r.label}-${i}`,
      label: r.label,
      value: null,
      topPct: 50,
      heightPct: 0,
      tone: 'flat'
    }));
    return {
      ticks: [
        { key: 't-1', value: 1, topPct: 0 },
        { key: 't0', value: 0, topPct: 50 },
        { key: 't1', value: -1, topPct: 100 }
      ],
      bars,
      zeroTopPct: 50,
      fmtTick: formatAxisPct
    };
  }

  let rawMax = Math.max(...vals);
  let rawMin = Math.min(...vals);
  if (!Number.isFinite(rawMax) || !Number.isFinite(rawMin)) {
    rawMax = 1;
    rawMin = -1;
  }
  if (rawMax === rawMin) {
    rawMax += 0.5;
    rawMin -= 0.5;
  }

  const span0 = rawMax - rawMin;
  const pad = Math.max(span0 * 0.06, 0.25);
  let axisMax = rawMax + pad;
  let axisMin = rawMin - pad;
  if (rawMin >= 0 && axisMin > 0) axisMin = 0;
  if (rawMax <= 0 && axisMax < 0) axisMax = 0;

  let span = axisMax - axisMin;
  let step = niceChartStep(span);
  if (!Number.isFinite(step) || step <= 0) step = Math.max(span / 6, 0.01);
  let maxTicks = Math.floor(span / step) + 2;
  while (maxTicks > 11 && step < span * 1.0001) {
    step *= 2;
    maxTicks = Math.floor(span / step) + 2;
  }

  const tickStart = Math.ceil((axisMin - 1e-9) / step) * step;
  const tickEnd = Math.floor((axisMax + 1e-9) / step) * step;
  const ticks = [];
  let ti = tickEnd;
  let guard = 0;
  while (ti >= tickStart - 1e-9 && guard++ < 64) {
    const value = Number.parseFloat(Number(ti).toPrecision(12));
    ticks.push({
      key: `y-${ticks.length}-${value}`,
      value,
      topPct: yPct(axisMax, axisMin, value)
    });
    ti -= step;
  }

  if (!ticks.length) {
    ticks.push(
      { key: 'y-max', value: axisMax, topPct: 0 },
      { key: 'y-zero', value: 0, topPct: yPct(axisMax, axisMin, 0) },
      { key: 'y-min', value: axisMin, topPct: 100 }
    );
  }

  const zeroTopPct = yPct(axisMax, axisMin, 0);
  const z = zeroTopPct;

  const bars = chartRows.map((r, i) => {
    const hasValue = Number.isFinite(r.value);
    const v = hasValue ? Number(r.value) : null;
    if (v == null) {
      return { key: `${r.label}-${i}`, label: r.label, value: null, topPct: z, heightPct: 0, tone: 'flat' };
    }
    const yv = yPct(axisMax, axisMin, v);
    if (v > 0) {
      const topPct = yv;
      const heightPct = Math.max(0, z - yv);
      return { key: `${r.label}-${i}`, label: r.label, value: v, topPct, heightPct, tone: 'up' };
    }
    if (v < 0) {
      const topPct = z;
      const heightPct = Math.max(0, yv - z);
      return { key: `${r.label}-${i}`, label: r.label, value: v, topPct, heightPct, tone: 'down' };
    }
    return { key: `${r.label}-${i}`, label: r.label, value: 0, topPct: z, heightPct: 0, tone: 'flat' };
  });

  return { ticks, bars, zeroTopPct, fmtTick: formatAxisPct };
}

/**
 * Figma-like compact table + mini bar section using existing TickerPage returns data.
 * No extra API calls.
 */
export function TickerSection16Section17({
  rows,
  compareRows,
  relativeStrengthTitle = 'Relative Strength (SP500)',
  relativeStrengthHeader = 'Relative Strength (SP500)',
  /** Rendered on the right-hand “bars” card header (e.g. Filters menu with RS dropdowns). */
  chartHeaderExtra = null,
  /** Ticker passed to Relative Strength “view more” when `onViewMore` is omitted. */
  viewMoreTicker = '',
  onViewMore: onViewMoreProp,
  /** When true, bar chart x-axis runs oldest→newest (table row order unchanged). */
  chartBarsAscending = false,
  /** Selected comparison tickers for the chart legend (e.g. `['XLK', 'SPX']`). */
  comparisonLegendLabels = null,
  /** Single legend for diff bars (e.g. `Nasdaq 100-S&P 500`). */
  comparisonLegendDiffLabel = null,
  /** When `'diff'`, bars use one orange gradient (left − right), not blue/orange by sign. */
  barChartVariant = 'comparison'
}) {
  const diffBarChart = barChartVariant === 'diff';
  const navigate = useNavigate();
  const onViewMore = useCallback(() => {
    if (typeof onViewMoreProp === 'function') {
      onViewMoreProp();
      return;
    }
    navigate(buildRelativeStrengthTickerHref(viewMoreTicker));
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }, [navigate, onViewMoreProp, viewMoreTicker]);
  const displayRows = useMemo(() => (Array.isArray(rows) ? rows.filter((r) => r && r.label) : []), [rows]);
  const chartRows = useMemo(() => {
    let rowsForChart;
    if (displayRows.length) {
      rowsForChart = displayRows;
    } else if (Array.isArray(compareRows)) {
      // Backward-compat fallback if only compare rows are passed.
      rowsForChart = compareRows
        .filter((r) => r && r.label)
        .map((r) => ({ label: r.label, value: Number.isFinite(r.value) ? Number(r.value) : Number(r.diff) }));
    } else {
      rowsForChart = [];
    }
    if (chartBarsAscending && rowsForChart.length > 1) {
      return [...rowsForChart].reverse();
    }
    return rowsForChart;
  }, [displayRows, compareRows, chartBarsAscending]);

  const chart = useMemo(() => buildRelativeStrengthChart(chartRows), [chartRows]);

  const diffLegendLabel = useMemo(() => {
    const explicit = String(comparisonLegendDiffLabel || '').trim();
    if (explicit) return explicit;
    if (!diffBarChart) return '';
    const m = String(relativeStrengthHeader || '').match(/\(([^)]+)\)/);
    if (!m) return '';
    return m[1]
      .split(/\s*-\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join('-');
  }, [comparisonLegendDiffLabel, diffBarChart, relativeStrengthHeader]);

  const legendLabels = useMemo(() => {
    if (diffBarChart && diffLegendLabel) return [];
    if (Array.isArray(comparisonLegendLabels) && comparisonLegendLabels.length) {
      return comparisonLegendLabels.map((l) => String(l || '').trim()).filter(Boolean);
    }
    const m = String(relativeStrengthHeader || '').match(/\(([^)]+)\)/);
    if (!m) return [];
    return m[1]
      .split(/\s*-\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [comparisonLegendLabels, relativeStrengthHeader, diffBarChart, diffLegendLabel]);

  const s17CardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const s17ChartFsRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const s17PlotRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const exportSymbol = String(viewMoreTicker || '').trim().toUpperCase() || 'chart';

  const exportS17Csv = useCallback(() => {
    const header = ['period', 'return_pct'];
    const lines = [header.join(',')];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    for (const r of chartRows) {
      const v = Number.isFinite(r.value) ? Number(r.value) : '';
      lines.push([esc(r.label), esc(v)].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportSymbol}-relative-strength-bars.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [chartRows, exportSymbol]);

  const exportS17CsvClick = useGatedCsvDownload(exportS17Csv);

  const buildS17SnapshotFilename = useCallback(
    () => buildTickerChartExportFilename('relative-strength-bars', exportSymbol),
    [exportSymbol]
  );

  const nCols = Math.max(1, chartRows.length);
  const chartGapPx = nCols > 12 ? 4 : nCols > 8 ? 6 : 8;
  const barMaxPx = nCols > 12 ? 12 : nCols > 8 ? 14 : 18;

  return (
    <section className="ticker-s16s17">
      <div className="ticker-s16s17__card ticker-s16">
        <div className="ticker-s16s17__head-row">
          <div className="ticker-card__h-with-tip">
            <div className="inline-flex shrink-0 items-center gap-2 uppercase">
              <ReturnsChartPieIcon />
              <ReturnsChartClickableTitle className="ticker-annual-figma__badge uppercase" onClick={onViewMore}>
                {relativeStrengthTitle}
              </ReturnsChartClickableTitle>
            </div>
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerRelativeStrength} align="start" />
          </div>
        </div>
        <div className="ticker-s16__body">
          <table className="ticker-s16__table">
            <thead>
              <tr>
                <th scope="col">{relativeStrengthHeader}</th>
                <th scope="col">Diff</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => {
                const v = Number.isFinite(r.value) ? Number(r.value) : null;
                return (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td className={valueToneClass(v)}>
                      {fmtPctSigned(v)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={s17CardRef} className="ticker-s16s17__card ticker-s17">
        <div className="ticker-s16s17__head-row">
          <div className="ticker-card__h-with-tip">
            <div className="inline-flex shrink-0 items-center gap-2 uppercase">
              <ReturnsChartPieIcon />
              <ReturnsChartClickableTitle className="ticker-annual-figma__badge uppercase" onClick={onViewMore}>
                Relative Strength Bars
              </ReturnsChartClickableTitle>
            </div>
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerRelativeStrength} align="start" />
          </div>
          <div className="ticker-s16s17__chart-head-tools">
            {chartHeaderExtra}
            <ReturnsChartToolbar
              className="ticker-s16s17__chart-toolbar-icons"
              showViewMore={false}
              showTableToggle={false}
              onDownload={exportS17CsvClick}
              downloadDisabled={!chartRows.length}
            />
            <ChartSectionIconActions
              snapshotRootRef={s17CardRef}
              plotHostRef={s17PlotRef}
              fullscreenTargetRef={s17ChartFsRef}
              buildFilename={buildS17SnapshotFilename}
              disabled={!chartRows.length}
              exportPreviewAlt="Exported relative strength bars chart"
              exportModalTitle="Export chart"
            />
          </div>
        </div>
        <div ref={s17ChartFsRef} className="ticker-chart-fs-shell ticker-s17__chart-shell">
        <div
          ref={s17PlotRef}
          className={
            'ticker-s17__chart ticker-s17__chart--no-yaxis' +
            (diffBarChart ? ' ticker-s17__chart--diff-bars' : '')
          }
          style={{
            '--ticker-s17-cols': String(nCols),
            '--ticker-s17-gap': `${chartGapPx}px`,
            '--ticker-s17-bar-max': `${barMaxPx}px`
          }}
        >
          <div className="ticker-s17__plot">
            <div className="ticker-s17__plot-area">
              <div className="ticker-s17__viz">
                {chart.ticks?.map((t) => (
                  <span key={`g-${t.key}`} className="ticker-s17__grid" style={{ top: `${t.topPct}%` }} />
                ))}
                <span className="ticker-s17__zero" style={{ top: `${chart.zeroTopPct ?? 50}%` }} />
                <div className="ticker-s17__bars">
                  {chart.bars?.map((b) => {
                    const tipText =
                      b.value == null ? `${b.label}: no data` : `${b.label}: ${formatRelativePerfPct(b.value)}`;
                    return (
                    <div key={b.key} className="ticker-s17__col">
                      <div className="ticker-s17__bar-zone">
                        <div
                          className={'ticker-s17__bar ticker-s17__bar--' + b.tone + (b.value == null ? ' ticker-s17__bar--empty' : '')}
                          style={{ top: `${b.topPct}%`, height: `${b.heightPct}%` }}
                        />
                        {b.value != null ? (
                          <span
                            className={'ticker-s17__bar-val ticker-s17__bar-val--' + b.tone}
                            style={{
                              top:
                                b.tone === 'down'
                                  ? `${b.topPct + b.heightPct}%`
                                  : `${b.topPct}%`
                            }}
                          >
                            {formatRelativePerfPct(b.value)}
                          </span>
                        ) : null}
                        <span className="ticker-s17__bar-tip" role="tooltip">
                          {tipText}
                        </span>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
              <div className="ticker-s17__xlabels">
                {chart.bars?.map((b) => (
                  <span key={`lab-${b.key}`} className="ticker-s17__lab">
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
        {diffBarChart && diffLegendLabel ? (
          <div className="ticker-annual-figma__legend ticker-s17__legend" aria-label="Relative strength difference">
            <div className="ticker-annual-figma__legend-row">
              <span className="ticker-annual-figma__legend-item">
                <span
                  className="ticker-annual-figma__swatch ticker-s17__legend-swatch--diff"
                  aria-hidden
                  style={{ background: S17_DIFF_BAR_GRADIENT }}
                />
                {diffLegendLabel}
              </span>
            </div>
          </div>
        ) : legendLabels.length ? (
          <div className="ticker-annual-figma__legend ticker-s17__legend" aria-label="Comparison tickers">
            <div className="ticker-annual-figma__legend-row">
              {legendLabels.map((label, i) => (
                <span key={`${label}-${i}`} className="ticker-annual-figma__legend-item">
                  <span
                    className="ticker-annual-figma__swatch"
                    aria-hidden
                    style={{
                      background:
                        S17_COMPARISON_LEGEND_COLORS[i % S17_COMPARISON_LEGEND_COLORS.length]
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

