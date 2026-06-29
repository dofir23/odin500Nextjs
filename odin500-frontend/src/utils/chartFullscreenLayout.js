/** SVG chart classes that should stretch to fill fullscreen height (not letterbox with meet). */
export const FULLSCREEN_STRETCH_SVG_SELECTOR = [
  'svg.stats-cmp-chart__svg',
  'svg.ticker-annual-figma__svg:not(.ticker-annual-figma__donut-svg)',
  'svg.ticker-monthly__svg',
  'svg.ticker-quarterly__svg',
  'svg.ticker-monthly-adv__svg:not(.ticker-annual-figma__donut-svg)',
  'svg.market-movers-page__bar-svg'
].join(', ');

const FS_PAR_ATTR = 'data-odin-fs-par';

function getFullscreenElement() {
  const doc = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** Remove letterboxing: stretch plot SVGs to the fullscreen panel (restore on exit). */
export function syncFullscreenSvgAspect() {
  if (typeof document === 'undefined') return;
  const fs = getFullscreenElement();

  document.querySelectorAll(`svg[${FS_PAR_ATTR}]`).forEach((svg) => {
    if (fs && fs.contains(svg)) return;
    const prev = svg.getAttribute(FS_PAR_ATTR);
    if (prev) svg.setAttribute('preserveAspectRatio', prev);
    else svg.removeAttribute('preserveAspectRatio');
    svg.removeAttribute(FS_PAR_ATTR);
  });

  if (!fs) return;

  fs.querySelectorAll(FULLSCREEN_STRETCH_SVG_SELECTOR).forEach((svg) => {
    if (!svg.hasAttribute(FS_PAR_ATTR)) {
      svg.setAttribute(FS_PAR_ATTR, svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
    }
    svg.setAttribute('preserveAspectRatio', 'none');
  });
}

let armed = false;

function armFullscreenSvgAspectSync() {
  if (armed || typeof document === 'undefined') return;
  armed = true;
  const run = () => notifyChartFullscreenLayout();
  document.addEventListener('fullscreenchange', run);
  document.addEventListener('webkitfullscreenchange', run);
}

/** Notify SVG / lightweight-charts listeners to remeasure after fullscreen transitions. */
export function notifyChartFullscreenLayout() {
  armFullscreenSvgAspectSync();
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    syncFullscreenSvgAspect();
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new CustomEvent('odin-chart-layout'));
  });
}

armFullscreenSvgAspectSync();
