'use client';
import { useSyncExternalStore } from 'react';
import { CHART_EXPORT_CAPTURE_BODY_CLASS } from '../utils/chartFullscreenLayout.js';

function subscribe(onStoreChange) {
  if (typeof document === 'undefined') return () => {};
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function getSnapshot() {
  if (typeof document === 'undefined') return false;
  return document.body.classList.contains(CHART_EXPORT_CAPTURE_BODY_CLASS);
}

/** True while a chart export snapshot is being captured (simulated fullscreen layout). */
export function useChartExportCapture() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
