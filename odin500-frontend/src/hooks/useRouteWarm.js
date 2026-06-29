'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { prefetchRouteChunks } from '../utils/routePrefetch.js';

function routePath(to) {
  const raw = typeof to === 'string' ? to : to && typeof to.pathname === 'string' ? to.pathname : '';
  if (!raw || raw === '#') return '';
  const path = raw.split('?')[0].split('#')[0];
  return path.startsWith('/') ? path : '';
}

/** Warm JS chunks and the Next.js RSC payload for a route. */
export function useRouteWarm() {
  const router = useRouter();

  return useCallback(
    (to) => {
      const path = routePath(to);
      if (!path) return;
      prefetchRouteChunks(path);
      try {
        router.prefetch(path);
      } catch {
        /* ignore prefetch failures */
      }
    },
    [router]
  );
}
