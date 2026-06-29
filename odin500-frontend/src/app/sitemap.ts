import type { MetadataRoute } from 'next';
import { buildDynamicSitemapPaths } from '@/seo/sitemapRoutes.js';
import { SITE_ORIGIN } from '@/seo/siteConfig.js';
import { resolveSitemapTickers } from '@/seo/fetchSitemapTickers';
import { getAllNewsletters } from '@/lib/newsletter.server';

/** Regenerate when tickers/API data change (ISR). */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tickers = await resolveSitemapTickers();
  const paths = buildDynamicSitemapPaths(tickers);
  const issues = getAllNewsletters();

  for (const issue of issues) {
    paths.push(`/newsletter/${issue.slug}`);
  }

  const pathSet = [...new Set(paths)];

  return pathSet.map((path) => {
    const issue = issues.find((i) => `/newsletter/${i.slug}` === path);
    const lastModified = issue ? new Date(issue.meta.publishedAt) : new Date();

    return {
      url: `${SITE_ORIGIN}${path === '/' ? '' : path}`,
      lastModified,
      changeFrequency: path.startsWith('/newsletter/') ? 'weekly' : path.includes('/ticker/') || path.includes('/historical-data/') ? 'daily' : 'weekly',
      priority: path === '/market' ? 1 : path.startsWith('/newsletter/') ? 0.75 : path.includes('/ticker/') ? 0.8 : 0.6
    };
  });
}
