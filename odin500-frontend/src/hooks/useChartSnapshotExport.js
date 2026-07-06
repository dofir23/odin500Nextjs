'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { captureChartPlotHost } from '../utils/chartExportImage.js';

function defaultTickerChartBg(isLight) {
  return isLight ? '#ffffff' : '#0f172a';
}

/** Prefer explicit export bg when the card uses a transparent CSS background. */
function isMostlyOpaqueCssColor(c) {
  const s = String(c || '').trim();
  if (!s || s === 'transparent') return false;
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (!m) return true;
  const a = m[4] != null ? Number(m[4]) : 1;
  return Number.isFinite(a) && a >= 0.85;
}

/**
 * Capture chart area → preview modal → PNG download (NormalizedPerformanceCard flow).
 * @param {{
 *   snapshotRootRef: import('react').RefObject<HTMLElement | null>,
 *   plotHostRef: import('react').RefObject<HTMLElement | null>,
 *   buildFilename: () => string,
 *   disabled?: boolean,
 *   getBackgroundColor?: (isLight: boolean) => string,
 *   getFallbackCanvas?: () => HTMLCanvasElement | null,
 *   onclone?: (clonedDoc: Document, clonedRoot: HTMLElement) => void,
 *   fullscreenTargetRef?: import('react').RefObject<HTMLElement | null>,
 * }} opts
 */
export function useChartSnapshotExport({
  snapshotRootRef,
  plotHostRef,
  buildFilename,
  disabled = false,
  getBackgroundColor = defaultTickerChartBg,
  getFallbackCanvas,
  onclone,
  fullscreenTargetRef: _fullscreenTargetRef = null
}) {
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const [exportingSnapshot, setExportingSnapshot] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalStatus, setExportModalStatus] = useState('idle');
  const [exportPreviewUrl, setExportPreviewUrl] = useState(null);
  const [exportFilename, setExportFilename] = useState('');
  const [exportModalError, setExportModalError] = useState('');

  const closeExportModal = useCallback(() => {
    setExportModalOpen(false);
    setExportModalStatus('idle');
    setExportPreviewUrl(null);
    setExportFilename('');
    setExportModalError('');
  }, []);

  const downloadFromExportModal = useCallback(() => {
    if (!exportPreviewUrl || !exportFilename) return;
    const link = document.createElement('a');
    link.href = exportPreviewUrl;
    link.download = exportFilename;
    link.click();
  }, [exportPreviewUrl, exportFilename]);

  const openExportModal = useCallback(async () => {
    const root = snapshotRootRef.current;
    const host = plotHostRef.current;
    if (!host || disabled) return;

    const filename = buildFilename();

    setExportModalOpen(true);
    setExportModalStatus('capturing');
    setExportPreviewUrl(null);
    setExportFilename(filename);
    setExportModalError('');

    setExportingSnapshot(true);

    try {
      const isLight = chartTheme === 'light';
      let exportBg = getBackgroundColor(isLight);
      const bgSource = host || root;
      if (bgSource && typeof window !== 'undefined') {
        const c = window.getComputedStyle(bgSource).backgroundColor;
        if (isMostlyOpaqueCssColor(c)) exportBg = c;
      }

      const mergedOnclone = (clonedDoc, clonedRoot) => {
        if (clonedRoot instanceof HTMLElement) {
          clonedRoot.classList.add('chart-export-snapshot');
        }
        onclone?.(clonedDoc, clonedRoot);
      };

      let canvas = await captureChartPlotHost(host, {
        backgroundColor: exportBg,
        root,
        onclone: mergedOnclone
      });

      if ((!canvas || canvas.width < 8 || canvas.height < 8) && typeof getFallbackCanvas === 'function') {
        canvas = getFallbackCanvas();
      }

      if (!canvas || canvas.width < 8 || canvas.height < 8) {
        setExportModalError('Could not capture the chart. Try again after the chart finishes loading.');
        setExportModalStatus('error');
        return;
      }

      setExportPreviewUrl(canvas.toDataURL('image/png'));
      setExportModalStatus('ready');
    } catch (e) {
      console.warn('[useChartSnapshotExport] capture failed', e);
      setExportModalError(e?.message || 'Capture failed.');
      setExportModalStatus('error');
    } finally {
      setExportingSnapshot(false);
    }
  }, [
    buildFilename,
    chartTheme,
    disabled,
    getBackgroundColor,
    getFallbackCanvas,
    onclone,
    plotHostRef,
    snapshotRootRef
  ]);

  useEffect(() => {
    if (!exportModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeExportModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exportModalOpen, closeExportModal]);

  useEffect(() => {
    if (!exportModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [exportModalOpen]);

  return {
    exportingSnapshot,
    exportModalOpen,
    exportModalStatus,
    exportPreviewUrl,
    exportFilename,
    exportModalError,
    openExportModal,
    closeExportModal,
    downloadFromExportModal
  };
}

/** Hide footer controls in ticker chart snapshots. */
export function applyTickerChartSnapshotCloneFixes(_clonedDoc, clonedRoot) {
  if (!(clonedRoot instanceof HTMLElement)) return;
  clonedRoot.classList.add('chart-export-snapshot');
  clonedRoot
    .querySelectorAll('.ticker-chart-footer-icons, .ticker-chart-resize, .chart-section-icon-actions')
    .forEach((el) => el.remove());
}
