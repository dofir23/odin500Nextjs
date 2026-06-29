export const CHART_SVG_ASPECT_DEFAULT = 'xMidYMid meet';

/** `none` in fullscreen removes top/bottom letterboxing; `meet` in normal view keeps aspect. */
export function chartSvgPreserveAspectRatio(fullscreen) {
  return fullscreen ? 'none' : CHART_SVG_ASPECT_DEFAULT;
}

/** Inline styles so resizable ticker SVGs override global `.ticker-annual-figma__svg` rules (`height: auto`, `max-height`). */
export function tickerSvgPlotStyle(plotHeight, options = {}) {
  const fullscreen = Boolean(options.fullscreen);
  if (plotHeight == null || !Number.isFinite(plotHeight)) {
    if (!fullscreen) return undefined;
    return {
      height: '100%',
      maxHeight: '100%',
      minHeight: 0,
      width: '100%',
      maxWidth: '100%',
      flex: '1 1 auto',
      alignSelf: 'stretch',
      display: 'block',
      boxSizing: 'border-box'
    };
  }
  const h = Math.round(plotHeight);
  return {
    height: fullscreen ? '100%' : h,
    maxHeight: fullscreen ? '100%' : 'none',
    minHeight: fullscreen ? 0 : Math.min(100, h),
    width: '100%',
    maxWidth: '100%',
    flex: fullscreen ? '1 1 auto' : undefined,
    alignSelf: fullscreen ? 'stretch' : undefined,
    display: 'block',
    boxSizing: 'border-box'
  };
}
