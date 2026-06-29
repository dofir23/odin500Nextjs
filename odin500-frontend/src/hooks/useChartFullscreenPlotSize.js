'use client';
import { useEffect, useState } from 'react';

function isFsElement(el) {
  if (!el) return false;
  const doc = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
  const fs = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  return fs === el;
}

/**
 * When `shellRef` is the browser fullscreen element, returns its inner plot dimensions.
 * @param {import('react').RefObject<HTMLElement | null>} shellRef
 */
export function useChartFullscreenPlotSize(shellRef) {
  const [size, setSize] = useState(/** @type {{ width: number, height: number } | null} */ (null));

  useEffect(() => {
    const el = shellRef?.current;
    if (!el) {
      setSize(null);
      return;
    }

    const measure = () => {
      if (!isFsElement(el)) {
        setSize((prev) => (prev == null ? prev : null));
        return;
      }
      const w = Math.max(240, Math.round(el.clientWidth));
      const h = Math.max(180, Math.round(el.clientHeight));
      setSize((prev) => (prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    document.addEventListener('fullscreenchange', measure);
    document.addEventListener('webkitfullscreenchange', measure);
    measure();

    return () => {
      ro.disconnect();
      document.removeEventListener('fullscreenchange', measure);
      document.removeEventListener('webkitfullscreenchange', measure);
    };
  }, [shellRef]);

  return size;
}
