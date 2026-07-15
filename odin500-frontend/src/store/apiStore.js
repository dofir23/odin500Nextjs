import { apiUrl } from '../utils/apiOrigin.js';
import { isAuthDisabled as envAuthDisabled } from '../lib/env.js';
import {
  composeAbortSignals,
  getRouteNavigationAbortSignal,
  getRouteNavigationEpoch,
  isAbortError,
  isRouteNavigationStale
} from '../navigation/routeNavigationAbort.js';

export { isAbortError, isRouteNavigationStale, getRouteNavigationEpoch };

const CACHE_VERSION = 'v2';
const CACHE_KEY = 'odin500_api_cache_' + CACHE_VERSION;
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const EXPIRES_AT_KEY = 'auth_expires_at';

/** Refresh access token this many ms before JWT expiry (proactive). */
const PROACTIVE_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const memoryStore = {
  token: '',
  cache: new Map(),
  inFlight: new Map()
};
let cachePersistWarned = false;

let refreshInFlight = null;
let proactiveTimerId = null;
const REFRESH_RETRY_DELAYS_MS = [0, 2000, 8000];

let authHydrated = false;
let authHydrationPromise = null;

export function isAuthHydrated() {
  return authHydrated;
}

function markAuthHydrated() {
  if (authHydrated) return;
  authHydrated = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('odin-auth-hydrated'));
  }
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function loadCacheFromSessionStorage() {
  if (typeof window === 'undefined') return;
  const raw = sessionStorage.getItem(CACHE_KEY);
  if (!raw) return;
  const parsed = safeParse(raw, {});
  const entries = Object.entries(parsed);
  for (const [key, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    if (!('ts' in value)) continue;
    memoryStore.cache.set(key, value);
  }
}

function persistCacheToSessionStorage() {
  if (typeof window === 'undefined') return;
  const entries = Array.from(memoryStore.cache.entries());
  const writeEntries = (pairs) => {
    const obj = {};
    for (const [key, value] of pairs) {
      obj[key] = value;
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  };
  try {
    writeEntries(entries);
  } catch (err) {
    // Session storage can exceed quota with large API payloads.
    // Keep the newest 25% entries and retry once; if that fails, skip persistence.
    const sorted = [...entries].sort((a, b) => {
      const ta = Number(a?.[1]?.ts) || 0;
      const tb = Number(b?.[1]?.ts) || 0;
      return tb - ta;
    });
    const keep = Math.max(8, Math.ceil(sorted.length * 0.25));
    memoryStore.cache = new Map(sorted.slice(0, keep));
    try {
      writeEntries(Array.from(memoryStore.cache.entries()));
    } catch {
      if (!cachePersistWarned) {
        cachePersistWarned = true;
        console.warn('API cache persistence disabled: sessionStorage quota exceeded.');
      }
    }
  }
}

function getBodyKey(body) {
  if (body == null) return '';
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function makeRequestKey(method, path, body) {
  return method.toUpperCase() + '::' + path + '::' + getBodyKey(body);
}

let cacheLoaded = false;
function ensureCacheLoaded() {
  if (cacheLoaded || typeof window === 'undefined') return;
  cacheLoaded = true;
  loadCacheFromSessionStorage();
}

function dispatchAuthUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('odin-auth-updated'));
}

function clearProactiveTimer() {
  if (proactiveTimerId != null && typeof window !== 'undefined') {
    window.clearTimeout(proactiveTimerId);
    proactiveTimerId = null;
  }
}

function getRefreshToken() {
  return '';
}

function getExpiresAtSec() {
  return '';
}

/** Persist session via httpOnly cookies (Next BFF) and sync client auth state. */
export async function applyAuthSession(session, options = {}) {
  if (!session?.access_token) return false;
  memoryStore.token = 'cookie';
  if (typeof window === 'undefined') return true;

  try {
    const body = { session };
    // Only send remember when explicitly provided — omitting it preserves the cookie on refresh.
    if (Object.prototype.hasOwnProperty.call(options, 'remember')) {
      body.remember = Boolean(options.remember);
    }
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin'
    });
    if (!res.ok) {
      memoryStore.token = '';
      dispatchAuthUpdated();
      return false;
    }
    dispatchAuthUpdated();
    scheduleProactiveRefresh();
    return true;
  } catch {
    memoryStore.token = '';
    dispatchAuthUpdated();
    return false;
  }
}

/** True when httpOnly session cookies are present (same check as GET /api/auth/session). */
export async function hasAuthSessionCookies() {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    return Boolean(payload?.authenticated);
  } catch {
    return false;
  }
}

const REFRESH_LOCK_KEY = 'odin_auth_refresh_lock';
const REFRESH_LOCK_MS = 20_000;

function tryAcquireRefreshLock() {
  if (typeof window === 'undefined') return true;
  try {
    const now = Date.now();
    const prev = safeParse(localStorage.getItem(REFRESH_LOCK_KEY), null);
    if (prev && typeof prev.ts === 'number' && now - prev.ts < REFRESH_LOCK_MS) {
      return false;
    }
    const token = `${now}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ ts: now, token }));
    const check = safeParse(localStorage.getItem(REFRESH_LOCK_KEY), null);
    return check?.token === token;
  } catch {
    return true;
  }
}

function releaseRefreshLock() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function scheduleProactiveRefresh() {
  clearProactiveTimer();
  if (typeof window === 'undefined') return;
  if (!getAuthToken()) return;

  proactiveTimerId = window.setTimeout(async () => {
    proactiveTimerId = null;
    const ok = await refreshSessionOnce();
    if (ok || getAuthToken()) scheduleProactiveRefresh();
  }, 50 * 60 * 1000);
}

let visibilityRefreshInstalled = false;
function installVisibilityRefresh() {
  if (typeof document === 'undefined' || visibilityRefreshInstalled) return;
  visibilityRefreshInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!getAuthToken()) return;
    void refreshSessionOnce();
  });
}

/**
 * On app load: restore session from cookies. Renew access in the background without
 * clearing Remember me. Avoid aggressive multi-tab refresh races.
 */
export async function initAuthSessionOnLoad() {
  if (typeof window === 'undefined') return;
  if (authHydrationPromise) return authHydrationPromise;

  authHydrationPromise = (async () => {
    ensureCacheLoaded();
    installVisibilityRefresh();

    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (payload?.authenticated) {
        memoryStore.token = 'cookie';
        dispatchAuthUpdated();
        // Background renew — skip if another tab holds the refresh lock.
        void refreshSessionOnce();
        scheduleProactiveRefresh();
        return;
      }
    } catch {
      /* ignore */
    }

    memoryStore.token = '';
    localStorage.removeItem('market_api_email');
    localStorage.removeItem('odin_login_remember');
    dispatchAuthUpdated();
  })().finally(() => {
    markAuthHydrated();
  });

  return authHydrationPromise;
}

/**
 * Single-flight refresh via backend POST /api/auth/refresh.
 * Cookies are written by the refresh route (preserves Remember me). Do not re-POST
 * /api/auth/session with remember:false — that was clearing sessions early.
 * @returns {Promise<boolean>}
 */
export async function refreshSessionOnce() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    if (!tryAcquireRefreshLock()) {
      // Another tab is refreshing; keep local session marked as cookie-authenticated.
      if (!getAuthToken()) {
        memoryStore.token = 'cookie';
        dispatchAuthUpdated();
      }
      return true;
    }

    let sawTransientFailure = false;

    try {
      for (let attempt = 0; attempt < REFRESH_RETRY_DELAYS_MS.length; attempt += 1) {
        const delayMs = REFRESH_RETRY_DELAYS_MS[attempt];
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'same-origin'
          });
          const payload = await response.json().catch(() => ({}));

          if (response.ok && payload.session?.access_token) {
            // Refresh route already set httpOnly cookies (and kept Remember me).
            memoryStore.token = 'cookie';
            dispatchAuthUpdated();
            return true;
          }

          // Invalid/expired/revoked refresh token — only then force logout.
          if (response.status === 400 || response.status === 401) {
            await clearAuthToken();
            clearApiCache();
            return false;
          }

          sawTransientFailure = true;
        } catch {
          sawTransientFailure = true;
        }
      }
    } finally {
      releaseRefreshLock();
    }

    // Transient failures: keep the user signed in; retry later via proactive timer.
    if (sawTransientFailure) return false;
    return false;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export function setAuthToken(token) {
  const next = String(token || '');
  memoryStore.token = next;
  if (typeof window === 'undefined') return;
  if (next) localStorage.setItem(TOKEN_KEY, next);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return memoryStore.token || '';
}

export function isAuthDisabled() {
  return envAuthDisabled();
}

/** Logged in, or temporary auth bypass — safe to call protected market/ticker APIs. */
export function canFetchProtectedApi() {
  return isAuthDisabled() || Boolean(getAuthToken());
}

/** Read-only market data endpoints are public on the API — SSR and client fetches work without login. */
export function canFetchMarketData() {
  return true;
}

/** Local part of email saved at login; only valid while a session exists. */
export function getProfileEmailLocalPart() {
  if (!getAuthToken()) return '';
  try {
    const em = String(localStorage.getItem('market_api_email') || '').trim();
    if (!em) return '';
    const at = em.indexOf('@');
    return (at > 0 ? em.slice(0, at) : em) || '';
  } catch {
    return '';
  }
}

export function profileInitialsFromName(name, guestInitial = 'G') {
  const label = String(name || '').trim();
  if (!label || label === 'Guest') return guestInitial;
  const letters = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  return letters || guestInitial;
}

export async function clearAuthToken() {
  clearProactiveTimer();
  memoryStore.token = '';
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* ignore */
  }
  localStorage.removeItem('market_api_email');
  localStorage.removeItem('odin_login_remember');
  dispatchAuthUpdated();
}

export function clearApiCache() {
  memoryStore.cache.clear();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(CACHE_KEY);
  }
}

/**
 * Fetch with Bearer auth; on 401, refresh once and retry.
 * By default composes the route navigation AbortSignal so rapid page changes
 * cancel in-flight requests. Pass `routeAbort: false` for auth/session work.
 */
export async function fetchWithAuth(url, init = {}) {
  ensureCacheLoaded();
  const { auth = true, signal: callerSignal, routeAbort = true, ...rest } = init;
  const epochAtStart = getRouteNavigationEpoch();
  const signal = routeAbort
    ? composeAbortSignals(getRouteNavigationAbortSignal(), callerSignal)
    : callerSignal || undefined;
  const exec = async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const headers = new Headers(rest.headers || {});
    if (
      rest.body &&
      typeof rest.body === 'string' &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...rest, headers, signal, credentials: 'same-origin' });
  };

  let response = await exec();
  if (isRouteNavigationStale(false, epochAtStart) || signal?.aborted) {
    throw new DOMException('Route navigation changed', 'AbortError');
  }
  if (response.status === 401 && auth) {
    const refreshed = await refreshSessionOnce();
    if (signal?.aborted || isRouteNavigationStale(false, epochAtStart)) {
      throw new DOMException('Route navigation changed', 'AbortError');
    }
    if (refreshed) response = await exec();
  }
  return response;
}

/**
 * Ticker search must not use the JSON cache: stale `[]` in sessionStorage was
 * causing permanent "No matches" until TTL expired.
 * @param {string} query trimmed search text (caller sanitizes)
 * @returns {Promise<unknown>} parsed JSON body (usually an array of tickers)
 */
export async function fetchTickerSearchLive(query) {
  const q = String(query || '').trim();
  if (!q) {
    return [];
  }
  const path = '/api/tickers/search?q=' + encodeURIComponent(q);
  const url = apiUrl(path);
  const response = await fetchWithAuth(url, {
    method: 'GET',
    cache: 'no-store'
  });
  const rawText = await response.text();
  let payload;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error('Invalid JSON from ticker search');
  }
  if (!response.ok) {
    throw new Error(
      (payload && (payload.error || payload.message)) ||
        'Ticker search failed (' + response.status + ')'
    );
  }
  return payload;
}

/**
 * Batch-resolve Supabase ticker `id` by exact symbol (watchlist search fallback when GET /search omits id).
 * @param {string[]} symbols uppercased symbols
 * @returns {Promise<Map<string, { id: string, symbol: string, company_name: string }>>}
 */
export async function resolveTickerSymbols(symbols) {
  const unique = [
    ...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))
  ].slice(0, 150);
  if (!unique.length) return new Map();

  const response = await fetchWithAuth(apiUrl('/api/tickers/resolve'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: unique }),
    cache: 'no-store'
  });
  const rawText = await response.text();
  let payload;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error('Invalid JSON from ticker resolve');
  }
  if (!response.ok) {
    throw new Error(
      (payload && (payload.error || payload.message)) || 'Ticker resolve failed'
    );
  }
  const tickers = Array.isArray(payload?.tickers) ? payload.tickers : [];
  const m = new Map();
  for (const t of tickers) {
    const sym = String(t.symbol || '')
      .trim()
      .toUpperCase();
    if (!sym || t.id == null || t.id === '') continue;
    m.set(sym, {
      id: String(t.id),
      symbol: sym,
      company_name: t.company_name != null ? String(t.company_name) : ''
    });
  }
  return m;
}

/** Normalize various API shapes to a flat list of { id, symbol, company_name }. */
export function normalizeTickerSearchRows(payload) {
  let rows = [];
  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) rows = payload.data;
    else if (Array.isArray(payload.tickers)) rows = payload.tickers;
    else if (Array.isArray(payload.results)) rows = payload.results;
  }
  return rows.map((row) => {
    const id = row.id ?? row.ticker_id ?? row.tickerId;
    return {
      id: id != null && id !== '' ? String(id) : '',
      symbol: String(row.symbol ?? row.Symbol ?? '')
        .trim()
        .toUpperCase(),
      company_name:
        row.company_name != null
          ? String(row.company_name)
          : row.companyName != null
            ? String(row.companyName)
            : ''
    };
  });
}

/**
 * Return cached JSON if still fresh (same key/TTL rules as fetchJsonCached). No network.
 * Use to paint UI immediately after prefetch or before a refresh completes.
 */
export function peekJsonCached({
  path,
  method = 'GET',
  body,
  ttlMs = 5 * 60 * 1000
}) {
  const reqKey = makeRequestKey(method, path, body);
  const now = Date.now();
  const skipAppCache =
    method === 'GET' && typeof path === 'string' && path.includes('/api/tickers/search');
  if (skipAppCache) return undefined;
  const cached = memoryStore.cache.get(reqKey);
  if (cached && now - cached.ts < ttlMs) return cached.data;
  return undefined;
}

function racePromiseWithSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

export async function fetchJsonCached({
  path,
  method = 'GET',
  body,
  ttlMs = 5 * 60 * 1000,
  auth = true,
  force = false,
  signal: callerSignal,
  routeAbort = true
}) {
  ensureCacheLoaded();
  const reqKey = makeRequestKey(method, path, body);
  const now = Date.now();
  const signal = routeAbort
    ? composeAbortSignals(getRouteNavigationAbortSignal(), callerSignal)
    : callerSignal || undefined;

  const skipAppCache =
    method === 'GET' && typeof path === 'string' && path.includes('/api/tickers/search');

  if (!force && !skipAppCache) {
    const cached = memoryStore.cache.get(reqKey);
    if (cached && now - cached.ts < ttlMs) {
      return { data: cached.data, fromCache: true, headers: null, status: 200 };
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (memoryStore.inFlight.has(reqKey)) {
    return racePromiseWithSignal(memoryStore.inFlight.get(reqKey), signal);
  }

  const promise = (async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const headers = { 'Content-Type': 'application/json' };

    const fetchInit = {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal,
      credentials: 'same-origin'
    };

    let response = await fetch(apiUrl(path), fetchInit);

    if (response.status === 401 && auth) {
      const refreshed = await refreshSessionOnce();
      if (refreshed) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        response = await fetch(apiUrl(path), fetchInit);
      }
    }

    const rawText = await response.text();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let payload;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error('Invalid JSON from server: ' + path);
    }

    if (!response.ok) {
      throw new Error(
        (payload && (payload.error || payload.message)) ||
          'Request failed (' + response.status + '): ' + path
      );
    }

    if (!skipAppCache) {
      memoryStore.cache.set(reqKey, { ts: Date.now(), data: payload });
      persistCacheToSessionStorage();
    }
    const headerObj = {};
    try {
      response.headers.forEach((value, key) => {
        headerObj[String(key || '').toLowerCase()] = value;
      });
    } catch {
      // ignore header extraction issues
    }
    return { data: payload, fromCache: false, headers: headerObj, status: response.status };
  })();

  memoryStore.inFlight.set(reqKey, promise);

  const dropInFlight = () => {
    if (memoryStore.inFlight.get(reqKey) === promise) {
      memoryStore.inFlight.delete(reqKey);
    }
  };
  if (signal?.aborted) {
    dropInFlight();
    throw new DOMException('Aborted', 'AbortError');
  }
  if (signal) {
    signal.addEventListener('abort', dropInFlight, { once: true });
  }

  try {
    return await racePromiseWithSignal(promise, signal);
  } finally {
    if (signal) signal.removeEventListener('abort', dropInFlight);
    dropInFlight();
  }
}
