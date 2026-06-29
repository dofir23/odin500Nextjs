'use client';

import { startTransition, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getHomePagePrefetchRoutes } from '@/content/homePageContent';

function isModifiedPointer(event: PointerEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function internalHref(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return null;

  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/**
 * Single client island for the homepage: prefetch linked routes and start navigation on
 * pointerdown (before click) so the URL updates immediately — no per-link client bundles.
 */
export function HomeInstantNav({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    for (const path of getHomePagePrefetchRoutes()) {
      try {
        router.prefetch(path);
      } catch {
        /* ignore prefetch failures */
      }
    }
  }, [router]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (isModifiedPointer(event) || event.defaultPrevented) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('.home-page a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const dest = internalHref(anchor);
      if (!dest) return;

      const cur = window.location.pathname + window.location.search + window.location.hash;
      if (dest === cur) return;

      event.preventDefault();
      startTransition(() => {
        router.push(dest);
      });
    };

    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true });
  }, [router]);

  return <div className="home-page">{children}</div>;
}
