/** SVG axis tick labels (Y/X) — dark theme. */
export const CHART_AXIS_COLOR_DARK = '#94a3b8';
/** SVG bar value labels — dark theme. */
export const CHART_LABEL_COLOR_DARK = '#e2e8f0';
/** SVG axis tick labels — light theme. */
export const CHART_AXIS_COLOR_LIGHT = 'rgb(15, 23, 42)';
/** SVG bar value labels — light theme. */
export const CHART_LABEL_COLOR_LIGHT = 'rgb(15, 23, 42)';

/**
 * @param {'light' | 'dark' | string} theme
 * @returns {{ axis: string, label: string }}
 */
export function chartAxisLabelColors(theme) {
  return theme === 'light'
    ? { axis: CHART_AXIS_COLOR_LIGHT, label: CHART_LABEL_COLOR_LIGHT }
    : { axis: CHART_AXIS_COLOR_DARK, label: CHART_LABEL_COLOR_DARK };
}
