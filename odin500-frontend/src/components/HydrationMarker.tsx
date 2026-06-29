'use client';

import { useEffect } from 'react';

/** Marks the document as hydrated so SSR fallback shell can be hidden. */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.appHydrated = 'true';
  }, []);
  return null;
}
