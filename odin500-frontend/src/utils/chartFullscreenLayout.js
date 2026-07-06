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

export const CHART_EXPORT_CAPTURE_CLASS = 'chart-export-capture';
export const CHART_EXPORT_CAPTURE_PLOT_CLASS = 'chart-export-capture-plot';
export const CHART_EXPORT_CAPTURE_BODY_CLASS = 'odin-chart-export-capture';

function getFullscreenElement() {
  const doc = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isElementFullscreen(el) {
  if (!el) return false;
  return getFullscreenElement() === el;
}

/** @returns {Promise<boolean>} */
export async function requestElementFullscreen(el) {
  if (!el || isElementFullscreen(el)) return true;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else {
      /** @type {{ webkitRequestFullscreen?: () => void }} */
      (el).webkitRequestFullscreen?.();
    }
    return true;
  } catch {
    return false;
  }
}

/** @returns {Promise<void>} */
export async function exitDocumentFullscreen() {
  const doc = /** @type {Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element | null }} */ (
    document
  );
  if (!(doc.fullscreenElement ?? doc.webkitFullscreenElement)) return;
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else doc.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
}

/** @returns {Promise<boolean>} */
export function waitForElementFullscreen(el, timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (isElementFullscreen(el)) {
      resolve(true);
      return;
    }
    const done = (ok) => {
      clearTimeout(timer);
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      resolve(ok);
    };
    const onChange = () => {
      if (isElementFullscreen(el)) done(true);
    };
    const timer = setTimeout(() => done(isElementFullscreen(el)), timeoutMs);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
  });
}

/** Allow charts to resize and redraw after a fullscreen transition. */
export async function settleChartLayoutAfterFullscreen() {
  notifyChartFullscreenLayout();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  await new Promise((resolve) => setTimeout(resolve, 120));
}

function stretchSvgsInRoot(root) {
  if (!root) return;
  root.querySelectorAll(FULLSCREEN_STRETCH_SVG_SELECTOR).forEach((svg) => {
    if (!svg.hasAttribute(FS_PAR_ATTR)) {
      svg.setAttribute(FS_PAR_ATTR, svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
    }
    svg.setAttribute('preserveAspectRatio', 'none');
  });
}

function restoreSvgsInRoot(root) {
  if (!root) return;
  root.querySelectorAll(`svg[${FS_PAR_ATTR}]`).forEach((svg) => {
    const prev = svg.getAttribute(FS_PAR_ATTR);
    if (prev) svg.setAttribute('preserveAspectRatio', prev);
    else svg.removeAttribute('preserveAspectRatio');
    svg.removeAttribute(FS_PAR_ATTR);
  });
}

/** Apply fullscreen-like layout for off-screen export capture (no browser fullscreen API). */
export function applyChartExportCaptureLayout(root, plotShell = null) {
  if (!(root instanceof HTMLElement) || typeof document === 'undefined') return;
  document.body.classList.add(CHART_EXPORT_CAPTURE_BODY_CLASS);
  root.classList.add(CHART_EXPORT_CAPTURE_CLASS);
  stretchSvgsInRoot(root);
  if (plotShell instanceof HTMLElement && plotShell !== root) {
    plotShell.classList.add(CHART_EXPORT_CAPTURE_PLOT_CLASS);
    stretchSvgsInRoot(plotShell);
  }
  notifyChartFullscreenLayout();
}

/** Tear down export capture layout. */
export function clearChartExportCaptureLayout(root, plotShell = null) {
  if (typeof document === 'undefined') return;
  if (root instanceof HTMLElement) {
    root.classList.remove(CHART_EXPORT_CAPTURE_CLASS);
    restoreSvgsInRoot(root);
  }
  if (plotShell instanceof HTMLElement) {
    plotShell.classList.remove(CHART_EXPORT_CAPTURE_PLOT_CLASS);
    restoreSvgsInRoot(plotShell);
  }
  document.body.classList.remove(CHART_EXPORT_CAPTURE_BODY_CLASS);
  notifyChartFullscreenLayout();
}

export async function settleChartExportCaptureLayout() {
  notifyChartFullscreenLayout();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
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
