import { API_ORIGIN } from '@/lib/env';

function backendUrl(path: string) {
  const base = API_ORIGIN.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch public market JSON for SSR — used by nearly every ticker/market/statistic page's
 * server-rendered data. Always anonymous, and always cache-eligible:
 *  - Never reads cookies()/headers() here. Doing so anywhere in a route's render tree
 *    permanently opts that whole route out of static/ISR rendering in Next.js — even if no
 *    cookie is actually present — which is what silently turned every page using this into
 *    fully dynamic, uncached SSR (ignoring their own `revalidate` export) despite this data
 *    being identical for every visitor, logged in or not.
 *  - Never passes `cache: 'no-store'` to fetch, for the same reason — that also forces
 *    dynamic rendering independent of cookies(). `next.revalidate` lets the page's own ISR
 *    interval govern caching instead.
 */
async function fetchMarketJsonInternal(
  path: string,
  init: RequestInit = {}
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(backendUrl(path), {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers || {}) },
      next: { revalidate: 300 }
    });
    if (!res.ok) return null;
    return (await parseJsonSafe(res)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

export async function fetchMarketJson(
  path: string,
  init?: RequestInit
): Promise<Record<string, unknown> | null> {
  return fetchMarketJsonInternal(path, init);
}

export async function postMarketJson(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  return fetchMarketJsonInternal(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function getMarketJson(path: string): Promise<Record<string, unknown> | null> {
  return fetchMarketJsonInternal(path, { method: 'GET' });
}
