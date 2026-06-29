'use client';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import { StatsCmpChartSkeleton } from './ChartSkeletons.jsx';
import { StatsCmpChartToolbarHead } from './StatsCmpChartToolbarHead.jsx';
import { StatsGroupedComparisonBarChart } from './StatsGroupedComparisonBarChart.jsx';
import { useChartFullscreenPlotSize } from '../hooks/useChartFullscreenPlotSize.js';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';
import { applyRelativeStrengthSnapshotCloneFixes } from '../utils/relativeStrengthChartExport.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { buildComparisonNarrative } from '../utils/seoChartNarratives.js';

export function AnnualReturnBarChart({
  mode,
  ticker,
  benchmarkIndex,
  startYear,
  endYear,
  selectedYear,
  startDate,
  endDate,
  theme = 'dark',
  rows = [],
  benchmarkOptions = [],
  onBenchmarkChange = () => {},
  tickerControl = null,
  controls = null,
  showDataTable = false,
  onToggleDataTable,
  onDownloadCsv,
  csvDisabled = false,
  loading = false,
  formatXAxisLabel = null,
  xAxisMaxLabels = 16,
  resizeStorageKey = null,
  resizeDefaultHeight = 300,
  plotHeight: plotHeightProp = null
}) {
  const sectionRef = useRef(null);
  const plotHostRef = useRef(null);
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const fsPlotSize = useChartFullscreenPlotSize(sectionRef);

  const externalH =
    plotHeightProp != null && Number.isFinite(Number(plotHeightProp)) ? Math.round(Number(plotHeightProp)) : null;
  const internalResize = useTickerPlotResize(
    externalH != null ? null : resizeStorageKey || null,
    resizeDefaultHeight,
    200,
    560
  );
  const heightPx = fsPlotSize != null ? null : externalH ?? internalResize.plotHeight;
  const resizeChrome = fsPlotSize != null || externalH != null || internalResize.enabled;
  const chartFullscreen = fsPlotSize != null;
  const chartPlotHeight = chartFullscreen
    ? Math.max(200, Math.round(fsPlotSize.height - 80))
    : heightPx ?? resizeDefaultHeight;

  const scopeStyle =
    internalResize.enabled && externalH == null && heightPx != null
      ? { '--ticker-resize-plot-h': `${Math.round(heightPx)}px` }
      : undefined;

  const rootClass = [
    'stats-cmp-chart',
    'stats-cmp-chart--chartjs',
    resizeChrome ? 'stats-cmp-chart--plot-resize' : '',
    internalResize.enabled && externalH == null ? 'ticker-chart-resize-scope' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const exportSymbol = `${ticker}-vs-${benchmarkIndex}`;
  const exportOnclone = useMemo(
    () => (clonedDoc, clonedRoot) =>
      applyRelativeStrengthSnapshotCloneFixes(clonedDoc, clonedRoot, chartTheme === 'light'),
    [chartTheme]
  );
  const seoNarrative = useMemo(
    () =>
      buildComparisonNarrative({
        rows,
        ticker,
        benchmark: benchmarkIndex,
        mode
      }),
    [rows, ticker, benchmarkIndex, mode]
  );

  return (
    <section ref={sectionRef} className={rootClass} style={scopeStyle}>
      {seoNarrative ? <p className="sr-only">{seoNarrative}</p> : null}
      <StatsCmpChartToolbarHead
        sectionRef={sectionRef}
        plotHostRef={plotHostRef}
        controls={controls}
        tickerControl={tickerControl}
        benchmarkIndex={benchmarkIndex}
        benchmarkOptions={benchmarkOptions}
        onBenchmarkChange={onBenchmarkChange}
        showDataTable={showDataTable}
        onToggleDataTable={onToggleDataTable}
        onDownloadCsv={onDownloadCsv}
        csvDisabled={csvDisabled}
        exportDisabled={loading || !rows.length}
        exportChartSlug={`rs-annual-${mode}`}
        exportSymbol={exportSymbol}
        exportPreviewAlt={`${ticker} vs ${benchmarkIndex} annual returns chart`}
        onclone={exportOnclone}
      />
      {loading ? (
        <StatsCmpChartSkeleton variant="groupedBar" />
      ) : !rows.length ? (
        <div className="stats-cmp-chart__state">No data available for selected range.</div>
      ) : (
        <>
          <div ref={plotHostRef} className="stats-cmp-chart__plot-host stats-cmp-chart__plot-host--chartjs">
            <div className="stats-cmp-chart__legend">
              <span>
                <i className="stats-cmp-chart__sw stats-cmp-chart__sw--ticker" /> {ticker}
              </span>
              <span>
                <i className="stats-cmp-chart__sw stats-cmp-chart__sw--bench1" /> {benchmarkIndex}
              </span>
            </div>
            <StatsGroupedComparisonBarChart
              rows={rows}
              tickerLabel={ticker}
              benchLabel={benchmarkIndex}
              formatXAxisLabel={formatXAxisLabel}
              xAxisMaxLabels={xAxisMaxLabels}
              plotHeight={chartPlotHeight}
              chartFullscreen={chartFullscreen}
            />
            <div className="stats-cmp-chart__titlebox">
              {ticker} vs {benchmarkIndex} — {mode} Returns
            </div>
            <div className="stats-cmp-chart__caption">
              {ticker} versus {benchmarkIndex} calendar-{mode} returns.
            </div>
          </div>
          {internalResize.enabled && externalH == null ? (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-valuemin={internalResize.ariaMin}
              aria-valuemax={internalResize.ariaMax}
              aria-valuenow={internalResize.ariaNow}
              className="ticker-chart-resize ticker-chart-resize--scope"
              title="Drag to resize chart height. Double-click to reset."
              onPointerDown={internalResize.onPointerDown}
              onDoubleClick={internalResize.onDoubleClick}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
