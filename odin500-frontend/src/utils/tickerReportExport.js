import { getDocumentTheme } from './documentTheme.js';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {object} report
 */
export function buildTickerReportCsv(report) {
  const m = report.meta;
  const lines = [];
  lines.push(`Symbol,${escapeCsvCell(m.symbol)}`);
  lines.push(`Company,${escapeCsvCell(m.companyName)}`);
  lines.push(`Period,${escapeCsvCell(m.periodLabel)}`);
  lines.push(`Benchmark,${escapeCsvCell(m.benchmark)}`);
  lines.push('');
  lines.push('Metric,Value');
  for (const row of report.statsGrid || []) {
    lines.push(`${escapeCsvCell(row.label)},${escapeCsvCell(row.value)}`);
  }
  lines.push('');
  lines.push('Trailing Returns,,');
  lines.push('Period,Ticker,S&P 500 (SPY),Excess');
  for (const row of report.trailingReturns || []) {
    lines.push(
      [row.period, row.ticker, row.bench, row.excess].map(escapeCsvCell).join(',')
    );
  }
  lines.push('');
  lines.push('Monthly Statistics,,');
  for (const row of report.monthlyStatsLeft || []) {
    lines.push(`${escapeCsvCell(row.label)},${escapeCsvCell(row.value)}`);
  }
  for (const row of report.monthlyStatsRight || []) {
    lines.push(`${escapeCsvCell(row.label)},${escapeCsvCell(row.value)}`);
  }
  lines.push('');
  lines.push('Drawdown Metrics,,');
  for (const row of report.drawdownMetrics || []) {
    lines.push(`${escapeCsvCell(row.label)},${escapeCsvCell(row.value)}`);
  }
  lines.push('');
  lines.push('Relative Strength,,');
  for (const row of report.relativeStrength || []) {
    lines.push(`${escapeCsvCell(row.label)},${escapeCsvCell(row.value)}`);
  }
  lines.push('');
  lines.push('FAQs,,');
  for (const item of report.faqs || []) {
    lines.push(`Q,${escapeCsvCell(item.q)}`);
    lines.push(`A,${escapeCsvCell(item.a)}`);
  }
  return lines.join('\n');
}

/**
 * @param {object} report
 */
export function downloadTickerReportCsv(report) {
  const csv = buildTickerReportCsv(report);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const filename = `${report.meta.symbol}_${report.meta.periodKey}_report.csv`;
  downloadBlob(blob, filename);
}

const PDF_SCALE = 2;
const PDF_MARGIN_MM = 10;
const PDF_PAGE_W_MM = 210;
const PDF_PAGE_H_MM = 297;
const PDF_CONTENT_W_MM = PDF_PAGE_W_MM - PDF_MARGIN_MM * 2;
const PDF_CONTENT_H_MM = PDF_PAGE_H_MM - PDF_MARGIN_MM * 2;

/** Never slice through these — move the whole block to the next page when possible. */
const PDF_ATOMIC_SELECTORS = [
  'figure.ticker-report__chart',
  '.ticker-report__heatmap-wrap',
  '.ticker-report__table-wrap',
  '.ticker-report__split-cols',
  '.ticker-report__takeaways',
  '.ticker-report__stats-grid',
  '.ticker-report__scorecard',
  '.ticker-report__faq',
  '.ticker-report__disclosure',
  '.ticker-report__related'
];

const PDF_SOFT_BREAK_SELECTORS = [
  'h1',
  'h2',
  'h3',
  '.ticker-report__header',
  '.ticker-report__summaries',
  '.ticker-report__summary',
  '.ticker-report__narrative',
  '.ticker-report__article > p',
  '.ticker-report__footer'
];

function isOpaqueCssColor(c) {
  const s = String(c || '').trim();
  if (!s || s === 'transparent') return false;
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!m) return true;
  const a = m[4] != null ? Number(m[4]) : 1;
  return Number.isFinite(a) && a >= 0.92;
}

/**
 * @param {HTMLElement} rootEl
 * @param {boolean} isDark
 */
function resolvePdfBackground(rootEl, isDark) {
  const candidates = [
    rootEl.querySelector('.ticker-report__article'),
    rootEl,
    rootEl.closest('.ticker-report-page'),
    rootEl.closest('.app-main__content'),
    document.body
  ].filter(Boolean);

  for (const el of candidates) {
    const bg = getComputedStyle(el).backgroundColor;
    if (isOpaqueCssColor(bg)) return bg;
  }

  return isDark ? '#0f172a' : '#ffffff';
}

/** @param {HTMLElement} el */
function findScrollParent(el) {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** @param {HTMLElement} el */
function captureScrollPosition(el) {
  const scrollParent = findScrollParent(el);
  if (scrollParent) {
    return { kind: 'element', el: scrollParent, left: scrollParent.scrollLeft, top: scrollParent.scrollTop };
  }
  return { kind: 'window', left: window.scrollX, top: window.scrollY };
}

/** @param {{ kind: 'element' | 'window', el?: Element, left: number, top: number }} saved */
function restoreScrollPosition(saved) {
  if (saved.kind === 'element' && saved.el instanceof Element) {
    saved.el.scrollLeft = saved.left;
    saved.el.scrollTop = saved.top;
    return;
  }
  window.scrollTo(saved.left, saved.top);
}

/**
 * @param {HTMLElement} rootEl
 * @param {number} scale
 * @param {number} pageContentHeightPx
 */
function collectPdfAtomicBlocks(rootEl, scale, pageContentHeightPx) {
  const rootRect = rootEl.getBoundingClientRect();
  const seen = new Set();
  const blocks = [];

  const addBlock = (el, atomic) => {
    if (!(el instanceof HTMLElement) || seen.has(el)) return;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.height < 4 || r.width < 4) return;

    const top = (r.top - rootRect.top) * scale;
    const bottom = (r.bottom - rootRect.top) * scale;
    const height = bottom - top;
    const tallerThanPage = height >= pageContentHeightPx * 0.97;

    blocks.push({
      top,
      bottom,
      height,
      atomic: atomic && !tallerThanPage
    });
  };

  for (const sel of PDF_ATOMIC_SELECTORS) {
    for (const el of rootEl.querySelectorAll(sel)) addBlock(el, true);
  }
  for (const sel of PDF_SOFT_BREAK_SELECTORS) {
    for (const el of rootEl.querySelectorAll(sel)) addBlock(el, false);
  }

  blocks.sort((a, b) => a.top - b.top);

  return blocks.filter((r, i) => {
    for (let j = 0; j < blocks.length; j++) {
      if (i === j) continue;
      const o = blocks[j];
      if (o.top <= r.top + 1 && o.bottom >= r.bottom - 1 && o.height > r.height + 2) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Pick the next Y slice boundary — never through atomic charts/tables when avoidable.
 */
function computeNextPdfBreakY(pageStart, pageContentHeightPx, canvasHeight, blocks, gapPx) {
  const target = pageStart + pageContentHeightPx;
  if (target >= canvasHeight - 2) return canvasHeight;

  let breakY = target;

  for (const b of blocks) {
    if (!b.atomic) continue;

    const wouldCut = breakY > b.top + gapPx && breakY < b.bottom - gapPx;
    const startsOnPage = b.top >= pageStart - 1 && b.top < target;
    const overflowPage = startsOnPage && b.bottom > target + gapPx;

    if (overflowPage && b.top > pageStart + gapPx * 2) {
      breakY = Math.min(breakY, b.top - gapPx);
      continue;
    }

    if (!wouldCut) continue;

    if (b.top > pageStart + gapPx * 2) {
      breakY = Math.min(breakY, b.top - gapPx);
    } else if (b.height <= pageContentHeightPx - gapPx * 2) {
      breakY = Math.min(canvasHeight, b.bottom + gapPx);
    }
  }

  for (const b of blocks) {
    if (b.atomic) continue;
    if (breakY > b.top + gapPx && breakY < b.bottom - gapPx && b.top > pageStart + gapPx) {
      breakY = Math.min(breakY, b.top - gapPx);
    }
  }

  if (breakY <= pageStart + gapPx) {
    breakY = Math.min(pageStart + pageContentHeightPx, canvasHeight);
  }

  return Math.min(Math.max(breakY, pageStart + 1), canvasHeight);
}

/**
 * @param {number} canvasHeight
 * @param {number} pageContentHeightPx
 * @param {{ top: number, bottom: number, atomic: boolean }[]} blocks
 */
function buildPdfSlicePoints(canvasHeight, pageContentHeightPx, blocks) {
  const gap = 10 * PDF_SCALE;
  const points = [0];
  let cursor = 0;

  while (cursor < canvasHeight - 2) {
    const remaining = canvasHeight - cursor;
    if (remaining <= pageContentHeightPx + gap) break;

    const next = computeNextPdfBreakY(cursor, pageContentHeightPx, canvasHeight, blocks, gap);
    if (next <= cursor + gap) break;

    points.push(next);
    cursor = next;
  }

  if (points[points.length - 1] !== canvasHeight) {
    points.push(canvasHeight);
  }

  return points;
}

/**
 * @param {HTMLCanvasElement} source
 * @param {number} y0
 * @param {number} y1
 * @param {string} bg
 */
function cropCanvasSlice(source, y0, y1, bg) {
  const h = Math.max(1, Math.round(y1 - y0));
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return out;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, y0, source.width, h, 0, 0, out.width, h);
  return out;
}

/**
 * @param {Document} clonedDoc
 * @param {HTMLElement} clonedRoot
 * @param {boolean} isDark
 * @param {string} pageBg
 */
function applyPdfCloneFixes(clonedDoc, clonedRoot, isDark, pageBg) {
  clonedDoc.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

  const style = clonedDoc.createElement('style');
  style.setAttribute('data-ticker-report-pdf', '1');
  style.textContent = `
    .ticker-report-price-chart__status { display: none !important; }
    .ticker-report__article { padding-bottom: 32px !important; }

    .ticker-report-page,
    .ticker-report-page__main,
    .ticker-report__article {
      background: ${pageBg} !important;
    }

    ${
      isDark
        ? `
    .ticker-report-price-chart__plot,
    .ticker-report-drawdown-chart__plot,
    .ticker-report-rs-chart__plot,
    .ticker-report__chart-canvas {
      background: rgba(15, 23, 42, 0.95) !important;
    }
    .ticker-report-rs-chart__legend,
    .ticker-report-drawdown-chart__legend {
      background: rgba(15, 23, 42, 0.92) !important;
      box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.2) !important;
    }
    `
        : `
    .ticker-report-price-chart__plot,
    .ticker-report-drawdown-chart__plot,
    .ticker-report-rs-chart__plot,
    .ticker-report__chart-canvas {
      background: #ffffff !important;
    }
    `
    }
  `;
  clonedDoc.head.appendChild(style);
  void clonedRoot.offsetHeight;
}

/**
 * @param {HTMLElement} rootEl
 * @param {object} report
 */
export async function downloadTickerReportPdf(rootEl, report) {
  if (!rootEl || typeof document === 'undefined') return;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);

  const isDark = getDocumentTheme() === 'dark';
  const exportBg = resolvePdfBackground(rootEl, isDark);
  const scrollSnap = captureScrollPosition(rootEl);

  try {
    const estCanvasWidth = Math.max(1, rootEl.offsetWidth) * PDF_SCALE;
    const pageContentHeightPx = (PDF_CONTENT_H_MM * estCanvasWidth) / PDF_CONTENT_W_MM;
    const atomicBlocks = collectPdfAtomicBlocks(rootEl, PDF_SCALE, pageContentHeightPx);

    const canvas = await html2canvas(rootEl, {
      scale: PDF_SCALE,
      useCORS: true,
      backgroundColor: exportBg,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: Math.max(document.documentElement.clientHeight, rootEl.scrollHeight),
      height: rootEl.scrollHeight,
      width: rootEl.scrollWidth,
      onclone: (clonedDoc, clonedRoot) => {
        if (clonedRoot instanceof HTMLElement) {
          applyPdfCloneFixes(clonedDoc, clonedRoot, isDark, exportBg);
        }
      }
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const slicePoints = buildPdfSlicePoints(canvas.height, pageContentHeightPx, atomicBlocks);

    for (let i = 0; i < slicePoints.length - 1; i++) {
      if (i > 0) pdf.addPage();
      const y0 = slicePoints[i];
      const y1 = slicePoints[i + 1];
      const slice = cropCanvasSlice(canvas, y0, y1, exportBg);
      const sliceHmm = (slice.height * PDF_CONTENT_W_MM) / canvas.width;
      pdf.addImage(
        slice.toDataURL('image/png'),
        'PNG',
        PDF_MARGIN_MM,
        PDF_MARGIN_MM,
        PDF_CONTENT_W_MM,
        sliceHmm
      );
    }

    pdf.save(`${report.meta.symbol}_${report.meta.periodKey}_report.pdf`);
  } finally {
    restoreScrollPosition(scrollSnap);
  }
}
