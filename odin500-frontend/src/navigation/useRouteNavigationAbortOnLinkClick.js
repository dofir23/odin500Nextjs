'use client';
import { useEffect } from 'react';
import { useLocation } from '@/navigation/appRouterCompat.jsx';
import { resetRouteNavigationAbort } from './routeNavigationAbort.js';

function isInternalAppHref(href, origin) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const u = new URL(href);
      return u.origin === origin;
    } catch {
      return false;
    }
  }
  return href.startsWith('/');
}

/**
 * Abort in-flight route fetches as soon as the user clicks an internal link (capture phase),
 * before React Router switches routes — keeps heavy pages from blocking navigation.
 */
export function useRouteNavigationAbortOnLinkClick() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onClickCapture = (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = /** @type {Element | null} */ (event.target);
      const anchor = target?.closest?.('a[href]');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;

      const href = anchor.getAttribute('href') || '';
      if (!isInternalAppHref(href, window.location.origin)) return;

      let nextPath = href;
      let nextSearch = '';
      try {
        const u = new URL(href, window.location.origin);
        nextPath = u.pathname;
        nextSearch = u.search;
      } catch {
        return;
      }

      if (nextPath === location.pathname && nextSearch === location.search) return;

      resetRouteNavigationAbort({ force: true });
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [location.pathname, location.search]);
}
