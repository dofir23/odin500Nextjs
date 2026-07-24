import type { MetadataRoute } from 'next';
import {
  buildDynamicSitemapPaths,
  SITEMAP_FALLBACK_TICKERS,
  SITEMAP_STATIC_PATHS
} from '@/seo/sitemapRoutes.js';
import { SITE_ORIGIN } from '@/seo/siteConfig.js';
import { resolveSitemapTickers } from '@/seo/fetchSitemapTickers';
import { getAllNewsletters } from '@/lib/newsletter.server';

/** Regenerate when tickers/API data change (ISR). */
export const revalidate = 3600;

/** Keep sitemap generation bounded so hosting timeouts / OOM never 500 the route. */
const MAX_SITEMAP_TICKERS = 2500;

function safeDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function homepageEntry(): MetadataRoute.Sitemap[number] {
  return {
    url: SITE_ORIGIN,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1
  };
}

function toSitemapEntries(
  paths: string[],
  publishedAtByPath: Map<string, string>
): MetadataRoute.Sitemap {
  const pathSet = [...new Set(paths)];
  if (!pathSet.length) return [homepageEntry()];

  return pathSet.map((path) => {
    const publishedAt = publishedAtByPath.get(path);
    return {
      url: `${SITE_ORIGIN}${path === '/' ? '' : path}`,
      lastModified: safeDate(publishedAt),
      changeFrequency: path.startsWith('/newsletter/')
        ? 'weekly'
        : path.includes('/ticker/') || path.includes('/historical-data/')
          ? 'daily'
          : 'weekly',
      priority:
        path === '/' || path === '/market'
          ? 1
          : path.startsWith('/newsletter/')
            ? 0.75
            : path.includes('/ticker/')
              ? 0.8
              : 0.6
    } as MetadataRoute.Sitemap[number];
  });
}

/**
 * Always return a valid sitemap. Never throw — a 500 here blocks Google discovery sitewide.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    let tickers: string[] = [];
    try {
      tickers = await resolveSitemapTickers();
    } catch (err) {
      console.warn('[sitemap] ticker resolution failed:', err instanceof Error ? err.message : err);
    }

    if (!Array.isArray(tickers) || !tickers.length) {
      tickers = [...SITEMAP_FALLBACK_TICKERS];
    } else if (tickers.length > MAX_SITEMAP_TICKERS) {
      console.warn(
        `[sitemap] capping tickers ${tickers.length} → ${MAX_SITEMAP_TICKERS} to keep sitemap healthy`
      );
      tickers = tickers.slice(0, MAX_SITEMAP_TICKERS);
    }

    const paths = buildDynamicSitemapPaths(tickers);
    const publishedAtByPath = new Map<string, string>();

    try {
      const issues = await getAllNewsletters();
      for (const issue of issues || []) {
        const slug = String(issue?.slug || '').trim();
        if (!slug) continue;
        const path = `/newsletter/${slug}`;
        paths.push(path);
        if (issue?.meta?.publishedAt) publishedAtByPath.set(path, String(issue.meta.publishedAt));
      }
    } catch (err) {
      console.warn('[sitemap] newsletter list failed:', err instanceof Error ? err.message : err);
    }

    return toSitemapEntries(paths, publishedAtByPath);
  } catch (err) {
    console.error('[sitemap] fatal — serving static fallback:', err instanceof Error ? err.message : err);
    return toSitemapEntries([...SITEMAP_STATIC_PATHS], new Map());
  }
}
