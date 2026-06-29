'use client';
import { useSyncExternalStore } from 'react';

const DEFAULT_HEIGHT = 320;

/** Breakpoint heights for the main ticker/index chart (Lightweight Charts is not fluid vertically). */
function heightFromMatchMedia() {
  if (typeof window === 'undefined') return DEFAULT_HEIGHT;
  if (window.matchMedia('(max-width: 479px)').matches) return 300;
  if (window.matchMedia('(max-width: 767px)').matches) return 320;
  if (window.matchMedia('(max-width: 1023px)').matches) return 300;
  return DEFAULT_HEIGHT;
}

const MEDIA_QUERIES = [
  '(max-width: 479px)',
  '(min-width: 480px) and (max-width: 767px)',
  '(min-width: 768px) and (max-width: 1023px)',
  '(min-width: 1024px)'
];

function subscribe(onStoreChange) {
  const mqs = MEDIA_QUERIES.map((q) => window.matchMedia(q));
  const onChange = () => onStoreChange();
  mqs.forEach((mq) => {
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
  });
  return () => {
    mqs.forEach((mq) => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    });
  };
}

/**
 * Responsive main-chart height. Uses matchMedia (not innerWidth + resize) so layout
 * height changes do not feed back into an update loop.
 */
export function useMediaChartHeight() {
  return useSyncExternalStore(subscribe, heightFromMatchMedia, () => DEFAULT_HEIGHT);
}
