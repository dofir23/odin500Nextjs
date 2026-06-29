import { API_ORIGIN } from '@/lib/env';
import { SITEMAP_FALLBACK_TICKERS } from '@/seo/sitemapRoutes.js';

type TickerGroup = { code?: string };
type GroupTickersPayload = { tickers?: Array<{ symbol?: string }> };

function apiBase() {
  return API_ORIGIN.replace(/\/$/, '');
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Load every ticker symbol from the trading API (all market groups).
 * Requires the API to allow unauthenticated reads (AUTH_DISABLED on backend) or a reachable API_ORIGIN.
 */
export async function fetchAllTickersForSitemap(): Promise<string[]> {
  const base = apiBase();
  const groupsRes = await fetch(`${base}/api/tickers/groups`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const groupsPayload = await parseJsonSafe(groupsRes);
  if (!groupsRes.ok) {
    throw new Error(
      typeof groupsPayload?.error === 'string'
        ? groupsPayload.error
        : `GET /api/tickers/groups failed (${groupsRes.status})`
    );
  }

  const groups = Array.isArray(groupsPayload) ? (groupsPayload as TickerGroup[]) : [];
  const symbols = new Set<string>();

  for (const group of groups) {
    const code = String(group?.code || '').trim();
    if (!code) continue;
    try {
      const res = await fetch(`${base}/api/tickers/group/${encodeURIComponent(code)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const payload = (await parseJsonSafe(res)) as GroupTickersPayload | null;
      if (!res.ok || !payload) continue;
      const list = Array.isArray(payload.tickers) ? payload.tickers : [];
      for (const row of list) {
        const sym = String(row?.symbol || '')
          .trim()
          .toUpperCase();
        if (sym) symbols.add(sym);
      }
    } catch {
      /* skip group */
    }
  }

  return Array.from(symbols).sort();
}

/**
 * Resolve ticker list for sitemap generation.
 *
 * Priority:
 * 1. SITEMAP_TICKERS — explicit comma-separated override
 * 2. API fetch (default when SITEMAP_USE_API is not "false")
 * 3. SITEMAP_FALLBACK_TICKERS hardcoded list
 */
export async function resolveSitemapTickers(): Promise<string[]> {
  const raw = process.env.SITEMAP_TICKERS || '';
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;

  const useApi = process.env.SITEMAP_USE_API !== 'false';
  if (useApi) {
    try {
      const fromApi = await fetchAllTickersForSitemap();
      if (fromApi.length) return fromApi;
      console.warn(
        '[sitemap] API returned zero tickers — using SITEMAP_FALLBACK_TICKERS. Set API_ORIGIN in production.'
      );
    } catch (err) {
      console.warn(
        '[sitemap] API ticker fetch failed — using SITEMAP_FALLBACK_TICKERS. Set API_ORIGIN in production.',
        err instanceof Error ? err.message : err
      );
    }
  } else {
    console.warn('[sitemap] SITEMAP_USE_API=false — using fallback ticker list only.');
  }

  return SITEMAP_FALLBACK_TICKERS;
}
