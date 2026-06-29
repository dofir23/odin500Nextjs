import { API_ORIGIN, isDev } from '../lib/env.js';

export const PRODUCTION_API_ORIGIN = API_ORIGIN;
export const LOCAL_DEV_API_ORIGIN = 'http://localhost:5000';

export function normalizeApiOrigin(url) {
  return String(url || '').replace(/\/$/, '');
}

export function computeDefaultApiOrigin() {
  if (typeof window === 'undefined') return '';

  if (window.TRADING_API_ORIGIN) {
    return normalizeApiOrigin(window.TRADING_API_ORIGIN);
  }
  try {
    const saved = localStorage.getItem('trading_api_origin');
    if (saved) return normalizeApiOrigin(saved);
  } catch {
    /* ignore */
  }

  if (isDev) {
    return '';
  }

  return PRODUCTION_API_ORIGIN;
}

/** Next.js route handlers that set/read cookies — not proxied. */
const LOCAL_AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/session'
]);

/** Build client API URL. Authenticated calls use Next.js BFF proxy. */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : '/' + path;

  if (typeof window !== 'undefined' && p.startsWith('/api/')) {
    const basePath = p.split('?')[0];
    if (LOCAL_AUTH_PATHS.has(basePath)) return p;
    return '/api/proxy' + p.slice(4);
  }

  const base = computeDefaultApiOrigin();
  return base ? base + p : p;
}
