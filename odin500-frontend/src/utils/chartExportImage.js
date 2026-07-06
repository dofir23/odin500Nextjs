import html2canvas from 'html2canvas';
import { Chart } from 'chart.js';
import './chartJsSetup.js';
import {
  CHART_EXPORT_CAPTURE_BODY_CLASS,
  notifyChartFullscreenLayout
} from './chartFullscreenLayout.js';

function waitFrames(count = 2) {
  return new Promise((resolve) => {
    let left = count;
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function copyCanvasWithBackground(source, backgroundColor) {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);
  return out;
}

/**
 * Resize a Chart.js instance for export, then restore container + chart.
 * @param {import('chart.js').Chart} chart
 * @param {{ width: number, height: number }} size
 */
async function withChartExportSize(chart, size, run) {
  const canvasEl = chart.canvas;
  const parent = canvasEl?.parentElement;
  const saved = parent
    ? {
        width: parent.style.width,
        height: parent.style.height,
        minHeight: parent.style.minHeight,
        flex: parent.style.flex
      }
    : null;

  if (parent) {
    parent.style.width = `${size.width}px`;
    parent.style.height = `${size.height}px`;
    parent.style.minHeight = `${size.height}px`;
    parent.style.flex = 'none';
  }

  chart.resize();
  chart.update('none');
  await waitFrames(3);

  try {
    return await run();
  } finally {
    if (parent && saved) {
      parent.style.width = saved.width;
      parent.style.height = saved.height;
      parent.style.minHeight = saved.minHeight;
      parent.style.flex = saved.flex;
    }
    chart.resize();
    chart.update('none');
    notifyChartFullscreenLayout();
  }
}

function pickExportSize(host) {
  const baseW = Math.max(host?.clientWidth || 0, 640);
  const width = Math.min(1600, Math.max(Math.round(baseW * 1.6), 960));
  const height = Math.min(900, Math.max(Math.round(width * 0.56), 420));
  return { width, height };
}

function findChartCanvas(host) {
  if (!host) return null;
  const canvases = [...host.querySelectorAll('canvas')];
  if (!canvases.length) return null;
  return canvases.reduce((best, el) => {
    const area = el.width * el.height;
    const bestArea = best ? best.width * best.height : 0;
    return area > bestArea ? el : best;
  }, null);
}

function prefersDomCapture(host) {
  if (!host) return false;
  if (host.querySelector('svg')) return true;
  return Boolean(
    host.querySelector(
      '.stats-cmp-chart__legend, .stats-cmp-chart__titlebox, .stats-cmp-chart__caption'
    )
  );
}

/**
 * Capture a plot host to a canvas (Chart.js-first, html2canvas fallback).
 * @param {HTMLElement} host
 * @param {{ backgroundColor?: string, root?: HTMLElement | null, onclone?: (doc: Document, root: HTMLElement) => void }} opts
 * @returns {Promise<HTMLCanvasElement | null>}
 */
export async function captureChartPlotHost(host, { backgroundColor = '#0f172a', root = null, onclone } = {}) {
  if (!host) return null;

  document.body.classList.add(CHART_EXPORT_CAPTURE_BODY_CLASS);
  notifyChartFullscreenLayout();
  await waitFrames(2);
  await new Promise((resolve) => setTimeout(resolve, 200));

  try {
    const canvasEl = findChartCanvas(host);
    const chart = canvasEl ? Chart.getChart(canvasEl) : undefined;
    const useDom = prefersDomCapture(host);

    if (chart && !useDom) {
      const size = pickExportSize(host);
      return await withChartExportSize(chart, size, async () => {
        return copyCanvasWithBackground(chart.canvas, backgroundColor);
      });
    }

    const captureEl = host || root;
    if (!captureEl) return null;

    return await html2canvas(captureEl, {
      backgroundColor,
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      foreignObjectRendering: false,
      imageTimeout: 20000,
      onclone: onclone
        ? (clonedDoc, clonedRoot) => {
            if (clonedRoot instanceof HTMLElement) onclone(clonedDoc, clonedRoot);
          }
        : undefined
    });
  } finally {
    document.body.classList.remove(CHART_EXPORT_CAPTURE_BODY_CLASS);
    notifyChartFullscreenLayout();
  }
}
