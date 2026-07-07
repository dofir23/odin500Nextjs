import type { MetadataRoute } from 'next';
import { buildDynamicSitemapPaths } from '@/seo/sitemapRoutes.js';
import { SITE_ORIGIN } from '@/seo/siteConfig.js';
import { resolveSitemapTickers } from '@/seo/fetchSitemapTickers';
import { getAllNewsletters } from '@/lib/newsletter.server';

/** Regenerate when tickers/API data change (ISR). */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let tickers: string[] = [];
  try {
    tickers = await resolveSitemapTickers();
  } catch (err) {
    console.warn('[sitemap] ticker resolution failed:', err instanceof Error ? err.message : err);
  }

  const paths = buildDynamicSitemapPaths(tickers);

  let issues: Awaited<ReturnType<typeof getAllNewsletters>> = [];
  try {
    issues = await getAllNewsletters();
    for (const issue of issues) {
      paths.push(`/newsletter/${issue.slug}`);
    }
  } catch (err) {
    console.warn('[sitemap] newsletter list failed:', err instanceof Error ? err.message : err);
  }

  const pathSet = [...new Set(paths)];

  if (!pathSet.length) {
    return [
      {
        url: SITE_ORIGIN,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1
      }
    ];
  }

  return pathSet.map((path) => {
    const issue = issues.find((i) => `/newsletter/${i.slug}` === path);
    const lastModified = issue ? new Date(issue.meta.publishedAt) : new Date();

    return {
      url: `${SITE_ORIGIN}${path === '/' ? '' : path}`,
      lastModified,
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
    };
  });
}
