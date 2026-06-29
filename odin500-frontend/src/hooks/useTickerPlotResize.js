'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_MIN = 160;
const DEFAULT_MAX = 700;

function readStoredHeight(storageKey, lo, hi) {
  try {
    const raw = localStorage.getItem(storageKey);
    const n = raw != null ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= lo && n <= hi) return n;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Vertical plot resize for ticker SVG blocks (session-only unless `persistHeight` is true).
 * @param {string | null | undefined} storageKey — omit or null to disable resize rail entirely.
 * @param {number} defaultHeight
 * @param {number} [min]
 * @param {number} [max]
 * @param {boolean} [persistHeight] — when true, save height to localStorage (default true for backward compatibility).
 */
export function useTickerPlotResize(storageKey, defaultHeight, min, max, persistHeight = true) {
  const enabled = typeof storageKey === 'string' && storageKey.length > 0;
  const minV = min ?? DEFAULT_MIN;
  const maxV = max ?? DEFAULT_MAX;
  const lo = Math.max(80, minV);
  const hi = Math.max(lo + 20, maxV);
  const def = Number.isFinite(defaultHeight) ? Math.min(hi, Math.max(lo, Math.round(defaultHeight))) : 280;

  const [userH, setUserH] = useState(/** @type {number | null} */ (null));

  useEffect(() => {
    if (!enabled || !persistHeight || !storageKey) return;
    const stored = readStoredHeight(storageKey, lo, hi);
    if (stored != null) {
      setUserH((prev) => (prev === stored ? prev : stored));
    }
    // Intentionally mount-only: bounds (lo/hi) may track responsive defaults and must not re-read storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, persistHeight, storageKey]);

  const defRef = useRef(def);
  defRef.current = def;
  const resizeDragRef = useRef(/** @type {{ active: boolean, startY: number, startH: number } | null} */ (null));

  const effective = !enabled ? null : userH == null ? def : Math.min(hi, Math.max(lo, userH));

  const onPointerDown = useCallback(
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      const startH = userH ?? defRef.current;
      resizeDragRef.current = { active: true, startY: e.clientY, startH };
      const onMove = (ev) => {
        const drag = resizeDragRef.current;
        if (!drag?.active) return;
        const dy = ev.clientY - drag.startY;
        const next = Math.round(Math.min(hi, Math.max(lo, drag.startH + dy)));
        setUserH(next);
      };
      const onUp = () => {
        if (resizeDragRef.current) resizeDragRef.current.active = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (persistHeight && storageKey) {
          setUserH((prev) => {
            const v = prev == null ? defRef.current : prev;
            try {
              localStorage.setItem(storageKey, String(v));
            } catch {
              /* ignore */
            }
            return prev;
          });
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [enabled, persistHeight, userH, hi, lo, storageKey]
  );

  const onDoubleClick = useCallback(
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      if (persistHeight && storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
      }
      setUserH(null);
    },
    [enabled, persistHeight, storageKey]
  );

  return {
    enabled,
    /** Pixel height for charts when enabled; otherwise null */
    plotHeight: effective,
    onPointerDown,
    onDoubleClick,
    ariaMin: lo,
    ariaMax: hi,
    ariaNow: effective ?? def
  };
}
