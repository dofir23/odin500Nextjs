/**
 * Route-scoped fetch cancellation: bump epoch + abort an AbortController on navigation
 * so in-flight fetch()/fetchJsonCached calls stop. Epoch checks remain as defense in depth.
 *
 * AbortErrors with message "Route navigation changed" are filtered from Next.js
 * unhandledrejection overlays via installRouteNavigationAbortErrorFilter().
 */

let routeNavigationEpoch = 0;
/** @type {AbortController} */
let routeNavController = new AbortController();
/** Last location key we already reset for (skips duplicate popstate + route-gate resets). */
let lastAbortLocationKey = null;
/** >0 while coalescing multiple reset calls in the same synchronous turn. */
let resetsThisSync = 0;

function scheduleSyncCoalesceRelease() {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => {
      resetsThisSync = 0;
    });
    return;
  }
  setTimeout(() => {
    resetsThisSync = 0;
  }, 0);
}

function locationKeyFromUrl(urlLike) {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(String(urlLike ?? ''), window.location.origin);
    const qs = url.search;
    return qs ? `${url.pathname}${qs}` : url.pathname;
  } catch {
    return '';
  }
}

function currentLocationKey() {
  if (typeof window === 'undefined') return '';
  const { pathname, search } = window.location;
  return search ? `${pathname}${search}` : pathname;
}

function abortPreviousRouteController() {
  const prev = routeNavController;
  routeNavController = new AbortController();
  try {
    prev.abort(new DOMException('Route navigation changed', 'AbortError'));
  } catch {
    /* ignore */
  }
}

function performRouteNavigationReset() {
  routeNavigationEpoch += 1;
  abortPreviousRouteController();
}

/**
 * Abort in-flight route fetches and bump epoch so loaders re-run / ignore stale work.
 * @param {{ force?: boolean, locationKey?: string | null }} [opts]
 */
export function resetRouteNavigationAbort(opts = {}) {
  const force = opts.force === true;
  const locationKey = opts.locationKey ?? null;

  if (!force && locationKey != null && locationKey === lastAbortLocationKey) {
    return;
  }
  if (locationKey != null) {
    lastAbortLocationKey = locationKey;
  }

  if (resetsThisSync > 0) {
    routeNavigationEpoch += 1;
    abortPreviousRouteController();
    return;
  }

  resetsThisSync += 1;
  scheduleSyncCoalesceRelease();
  performRouteNavigationReset();
}

/** Live AbortSignal aborted on each in-app route change. */
export function getRouteNavigationAbortSignal() {
  return routeNavController.signal;
}

export function getRouteNavigationEpoch() {
  return routeNavigationEpoch;
}

export function isAbortError(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  return err instanceof DOMException && err.name === 'AbortError';
}

/** AbortError from intentional route navigation (or composed signals). */
export function isRouteNavigationAbortError(err) {
  if (!isAbortError(err)) return false;
  const msg = String(err?.message || '');
  return (
    msg === 'Route navigation changed' ||
    msg === 'Aborted' ||
    msg === 'signal is aborted without reason'
  );
}

/**
 * True when a route-scoped loader should stop (unmounted or user navigated away).
 * @param {boolean} cancelled effect cleanup flag
 * @param {number} epochAtStart value from getRouteNavigationEpoch() when the effect started
 */
export function isRouteNavigationStale(cancelled, epochAtStart) {
  return cancelled || getRouteNavigationEpoch() !== epochAtStart;
}

/**
 * @param {...(AbortSignal | null | undefined)} extras
 * @returns {AbortSignal | undefined}
 */
export function composeAbortSignals(...extras) {
  const active = extras.filter(Boolean);
  if (!active.length) return undefined;
  if (active.length === 1) return active[0];

  const controller = new AbortController();
  const onAbort = (event) => {
    if (controller.signal.aborted) return;
    const source = /** @type {AbortSignal | undefined} */ (event?.target);
    const reason =
      source?.reason !== undefined
        ? source.reason
        : new DOMException('Aborted', 'AbortError');
    controller.abort(reason);
  };
  for (const sig of active) {
    if (sig.aborted) {
      controller.abort(
        sig.reason !== undefined ? sig.reason : new DOMException('Aborted', 'AbortError')
      );
      return controller.signal;
    }
    sig.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

/**
 * Prevent Next.js dev overlay from treating route-navigation aborts as app crashes.
 * @returns {() => void} cleanup
 */
export function installRouteNavigationAbortErrorFilter() {
  if (typeof window === 'undefined') return () => {};

  const onUnhandledRejection = (event) => {
    if (isRouteNavigationAbortError(event.reason)) {
      event.preventDefault();
    }
  };

  window.addEventListener('unhandledrejection', onUnhandledRejection);
  return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
}

/** Yield the main thread so route changes can paint before heavy sync work. */
export function yieldToMain() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 32 });
      return;
    }
    setTimeout(resolve, 0);
  });
}

function isInternalAppHref(href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Abort previous route work as soon as the user clicks an in-app link (capture phase).
 * @returns {() => void} cleanup
 */
export function installInternalLinkNavigationAbort() {
  if (typeof document === 'undefined') return () => {};

  const onClick = (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!anchor) return;
    if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href');
    if (!isInternalAppHref(href)) return;

    const next = new URL(href, window.location.origin);
    const cur = window.location;
    if (next.pathname === cur.pathname && next.search === cur.search && next.hash === cur.hash) {
      return;
    }

    resetRouteNavigationAbort({ force: true });
  };

  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

function historyUrlChanged(nextUrl) {
  if (nextUrl == null || nextUrl === '') return false;
  try {
    const next = new URL(String(nextUrl), window.location.origin);
    const cur = window.location;
    return next.pathname !== cur.pathname || next.search !== cur.search;
  } catch {
    return true;
  }
}

/** Abort when history changes without a link click. */
export function installHistoryNavigationAbort() {
  if (typeof window === 'undefined') return () => {};

  const { pushState, replaceState } = history;
  history.pushState = function (...args) {
    if (historyUrlChanged(args[2])) {
      resetRouteNavigationAbort({ locationKey: locationKeyFromUrl(args[2]) });
    }
    return pushState.apply(this, args);
  };
  history.replaceState = function (...args) {
    if (historyUrlChanged(args[2])) {
      resetRouteNavigationAbort({ locationKey: locationKeyFromUrl(args[2]) });
    }
    return replaceState.apply(this, args);
  };
  const onPopState = () => {
    resetRouteNavigationAbort({ locationKey: currentLocationKey() });
  };
  window.addEventListener('popstate', onPopState);

  return () => {
    history.pushState = pushState;
    history.replaceState = replaceState;
    window.removeEventListener('popstate', onPopState);
  };
}
