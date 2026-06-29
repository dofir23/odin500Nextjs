'use client';
import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * Track plot host width so SVG viewBox width matches the container (avoids letterboxing).
 * Uses a callback ref so measurement starts when the host element mounts.
 * @param {number} [fallback]
 */
export function useChartPlotWidth(fallback = 880) {
  const [width, setWidth] = useState(fallback);
  const [node, setNode] = useState(/** @type {HTMLElement | null} */ (null));

  useLayoutEffect(() => {
    if (!node) return;

    const measure = () => {
      const w = node.clientWidth;
      if (w > 0) setWidth(Math.round(w));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  const setPlotHostRef = useCallback((el) => {
    setNode(el);
  }, []);

  return { plotWidth: width, setPlotHostRef };
}
