'use client';

import { useEffect, useRef } from 'react';

/**
 * Marks its own .full-ssr-page wrapper as client-ready.
 *
 * Rendered inside the client subtree, so it only runs if that subtree actually mounted. The swap
 * used to key off a single global `data-app-hydrated` flag set in providers, which fired on mount
 * regardless of route: if one route's client view suspended or threw, its server-rendered content
 * was hidden anyway and the page went blank for users and crawlers alike. Scoping the signal per
 * page means the server content stays visible whenever the client view does not come up.
 */
export function ClientReadyMarker() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const page = ref.current?.closest('[data-full-ssr-page]');
    if (page instanceof HTMLElement) page.dataset.clientReady = 'true';
  }, []);

  return <span ref={ref} hidden aria-hidden="true" />;
}
