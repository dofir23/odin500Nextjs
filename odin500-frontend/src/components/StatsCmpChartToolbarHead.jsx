'use client';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ChartSectionIconActions } from './ChartSectionIconActions.jsx';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';
import { getRelativeStrengthExportBackground } from '../utils/relativeStrengthChartExport.js';

/**
 * Inline toolbar for stats comparison charts: range controls, benchmark, table/download icons, export/fullscreen.
 * Parent must attach `sectionRef` to the chart `<section>` and `plotHostRef` to the plot wrapper (legend + svg).
 */
export function StatsCmpChartToolbarHead({
  sectionRef,
  plotHostRef,
  controls = null,
  /** Optional ticker search/select (left of benchmark dropdown). */
  tickerControl = null,
  benchmarkIndex,
  benchmarkOptions = [],
  onBenchmarkChange = () => {},
  showDataTable = false,
  onToggleDataTable,
  onDownloadCsv,
  csvDisabled = false,
  exportDisabled = false,
  exportChartSlug = 'stats-chart',
  exportSymbol = '',
  exportPreviewAlt = 'Exported chart',
  getBackgroundColor = getRelativeStrengthExportBackground,
  onclone
}) {
  const benchmarkDd = (
    <ThemedDropdown
      size="sm"
      className="stats-cmp-chart__benchmark-dd"
      value={benchmarkIndex}
      options={benchmarkOptions}
      onChange={onBenchmarkChange}
      title="Benchmark"
      ariaLabelPrefix="Benchmark"
      labelFallback={benchmarkIndex}
      wideLabel
    />
  );

  const selectorGroup =
    tickerControl || benchmarkOptions.length ? (
      <div className="stats-cmp-chart__toolbar-selectors">
        {tickerControl}
        {benchmarkDd}
      </div>
    ) : null;

  const buildFilename = () => buildTickerChartExportFilename(exportChartSlug, exportSymbol);

  return (
    <div className="stats-cmp-chart__head stats-cmp-chart__head--toolbar">
      <ReturnsChartToolbar
        className="stats-cmp-chart__returns-toolbar"
        rangeControls={controls}
        extraActions={selectorGroup}
        showViewMore={false}
        onToggleTable={onToggleDataTable}
        showTable={showDataTable}
        showTableToggle={typeof onToggleDataTable === 'function'}
        onDownload={onDownloadCsv}
        downloadDisabled={csvDisabled}
        showDownload={typeof onDownloadCsv === 'function'}
      />
      <ChartSectionIconActions
        className="stats-cmp-chart__section-icons"
        snapshotRootRef={sectionRef}
        plotHostRef={plotHostRef}
        fullscreenTargetRef={sectionRef}
        buildFilename={buildFilename}
        disabled={exportDisabled}
        getBackgroundColor={getBackgroundColor}
        onclone={onclone}
        exportPreviewAlt={exportPreviewAlt}
      />
    </div>
  );
}
