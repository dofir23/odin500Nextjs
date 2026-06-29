import { applyTickerChartSnapshotCloneFixes } from '../hooks/useChartSnapshotExport.js';

/** Opaque export / plot chrome (matches `.np-card:fullscreen` on this page). */
export const RS_CHART_EXPORT_BG_DARK = '#0b243f';
export const RS_CHART_EXPORT_BG_LIGHT = '#f1f5f9';

export function getRelativeStrengthExportBackground(isLight) {
  return isLight ? RS_CHART_EXPORT_BG_LIGHT : RS_CHART_EXPORT_BG_DARK;
}

/** Lightweight-charts + SVG plot fill inside RS sections. */
export function getRelativeStrengthPlotBackground(isLight) {
  return isLight ? '#ffffff' : RS_CHART_EXPORT_BG_DARK;
}

/**
 * html2canvas onclone: opaque blue plot background + hide toolbar icons.
 * @param {Document} clonedDoc
 * @param {HTMLElement} clonedRoot
 * @param {boolean} isLight
 */
export function applyRelativeStrengthSnapshotCloneFixes(clonedDoc, clonedRoot, isLight) {
  applyTickerChartSnapshotCloneFixes(clonedDoc, clonedRoot);
  const outer = getRelativeStrengthExportBackground(isLight);
  const plot = getRelativeStrengthPlotBackground(isLight);
  const snapStyle = clonedDoc.createElement('style');
  snapStyle.setAttribute('data-rs-export-snapshot', '1');
  snapStyle.textContent = `
    .stats-cmp-chart,
    .relative-strength-page__chart-card,
    .np-chart-wrap {
      background: ${outer} !important;
    }
    .stats-cmp-chart__plot-host,
    .np-chart-stack,
    .relative-strength-page__chart-host-inner.np-chart,
    .np-chart {
      background: ${plot} !important;
    }
    .stats-cmp-chart__head,
    .stats-cmp-chart__returns-toolbar,
    .stats-cmp-chart__legend,
    .stats-cmp-chart__titlebox,
    .stats-cmp-chart__caption,
    .np-card__chips-row {
      background: transparent !important;
    }
  `;
  clonedDoc.head.appendChild(snapStyle);
  void clonedRoot.offsetHeight;
}
