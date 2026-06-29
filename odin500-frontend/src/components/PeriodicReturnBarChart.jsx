'use client';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import { StatsCmpChartSkeleton } from './ChartSkeletons.jsx';
import { StatsCmpChartToolbarHead } from './StatsCmpChartToolbarHead.jsx';
import { StatsGroupedComparisonBarChart } from './StatsGroupedComparisonBarChart.jsx';
import { useChartFullscreenPlotSize } from '../hooks/useChartFullscreenPlotSize.js';
import { applyRelativeStrengthSnapshotCloneFixes } from '../utils/relativeStrengthChartExport.js';
import { CHART_CMP_COLOR_BENCH2 } from '../utils/chartComparisonTheme.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { buildComparisonNarrative } from '../utils/seoChartNarratives.js';

export function PeriodicReturnBarChart({
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
  controls = null,
  showDataTable = false,
  onToggleDataTable,
  onDownloadCsv,
  csvDisabled = false,
  loading = false,
  formatXAxisLabel = null,
  xAxisMaxLabels = 12,
  plotHeight: plotHeightProp = null,
  resizeDefaultHeight = 280
}) {
  const sectionRef = useRef(null);
  const plotHostRef = useRef(null);
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const fsPlotSize = useChartFullscreenPlotSize(sectionRef);

  const externalH =
    plotHeightProp != null && Number.isFinite(Number(plotHeightProp)) ? Math.round(Number(plotHeightProp)) : null;
  const resizeChrome = fsPlotSize != null || externalH != null;
  const chartFullscreen = fsPlotSize != null;
  const chartPlotHeight = chartFullscreen
    ? Math.max(200, Math.round(fsPlotSize.height - 80))
    : externalH ?? resizeDefaultHeight;

  const scopeStyle =
    externalH != null && !chartFullscreen ? { '--ticker-resize-plot-h': `${externalH}px` } : undefined;

  const rootClass = [
    'stats-cmp-chart',
    'stats-cmp-chart--chartjs',
    resizeChrome ? 'stats-cmp-chart--plot-resize' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const showBarLabels = chartFullscreen || rows.length <= 20;

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
        benchmarkIndex={benchmarkIndex}
        benchmarkOptions={benchmarkOptions}
        onBenchmarkChange={onBenchmarkChange}
        showDataTable={showDataTable}
        onToggleDataTable={onToggleDataTable}
        onDownloadCsv={onDownloadCsv}
        csvDisabled={csvDisabled}
        exportDisabled={loading || !rows.length}
        exportChartSlug={`rs-periodic-${mode}`}
        exportSymbol={exportSymbol}
        exportPreviewAlt={`${ticker} vs ${benchmarkIndex} periodic returns chart`}
        onclone={exportOnclone}
      />
      {loading ? (
        <StatsCmpChartSkeleton variant="denseBars" />
      ) : !rows.length ? (
        <div className="stats-cmp-chart__state">No data available for selected range.</div>
      ) : (
        <div ref={plotHostRef} className="stats-cmp-chart__plot-host stats-cmp-chart__plot-host--chartjs">
          <div className="stats-cmp-chart__legend">
            <span>
              <i className="stats-cmp-chart__sw stats-cmp-chart__sw--ticker" /> {ticker}
            </span>
            <span>
              <i className="stats-cmp-chart__sw stats-cmp-chart__sw--bench2" /> {benchmarkIndex}
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
            showBarLabels={showBarLabels}
            benchBarColor={CHART_CMP_COLOR_BENCH2}
          />
        </div>
      )}
    </section>
  );
}
