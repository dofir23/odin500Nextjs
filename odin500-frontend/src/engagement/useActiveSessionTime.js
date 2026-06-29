'use client';
import { useEffect, useRef, useState } from 'react';

const IDLE_MS = 60 * 1000;
const TICK_MS = 1000;

/**
 * Accumulates time while tab is visible and user is recently active.
 * @param {{ enabled?: boolean }} [options]
 */
export function useActiveSessionTime({ enabled = true } = {}) {
  const activeMsRef = useRef(0);
  const [activeMs, setActiveMs] = useState(0);
  const lastTickRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      activeMsRef.current = 0;
      setActiveMs(0);
      return undefined;
    }

    lastTickRef.current = Date.now();
    lastActivityRef.current = Date.now();
    pausedRef.current = false;

    const bumpActivity = () => {
      lastActivityRef.current = Date.now();
      if (pausedRef.current && !document.hidden) pausedRef.current = false;
    };

    const onVisibility = () => {
      if (document.hidden) {
        pausedRef.current = true;
        lastTickRef.current = Date.now();
      } else {
        lastTickRef.current = Date.now();
        lastActivityRef.current = Date.now();
        pausedRef.current = false;
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((ev) => window.addEventListener(ev, bumpActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);

    const interval = window.setInterval(() => {
      const now = Date.now();
      if (document.hidden) {
        lastTickRef.current = now;
        return;
      }
      const idle = now - lastActivityRef.current > IDLE_MS;
      if (idle) {
        pausedRef.current = true;
        lastTickRef.current = now;
        return;
      }
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      if (delta > 0 && delta < 5000) {
        activeMsRef.current += delta;
        setActiveMs(activeMsRef.current);
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, bumpActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  return { activeMs, activeSeconds: Math.floor(activeMs / 1000) };
}
