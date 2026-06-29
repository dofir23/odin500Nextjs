import { SEO_BRAND_NAME, SITE_ORIGIN } from '@/seo/siteConfig.js';
import { resolveRequestMetadata } from '@/seo/metadata';
import { resolveBreadcrumbs } from '@/seo/resolveBreadcrumbs';
import { pickDynamicReturn } from '@/seo/performanceSnippet';

export type BreadcrumbItem = { name: string; path: string };

export function buildSitewideJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SEO_BRAND_NAME,
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/og-default.png`
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SEO_BRAND_NAME,
      url: SITE_ORIGIN
    }
  ];
}

function tickerSymbolFromPath(pathname: string) {
  const m = pathname.match(/^\/ticker\/([A-Za-z0-9.]+)$/i);
  return m ? decodeURIComponent(m[1]).toUpperCase() : null;
}

function financialProductJsonLd(symbol: string, pageUrl: string, seoData: unknown) {
  const d = seoData as {
    asOfDate?: string;
    returnsSym?: { performance?: Record<string, unknown> } | null;
  } | null;
  const perf = d?.returnsSym?.performance;
  const entity: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: symbol,
    tickerSymbol: symbol,
    url: pageUrl,
    provider: { '@type': 'Organization', name: SEO_BRAND_NAME, url: SITE_ORIGIN }
  };
  if (d?.asOfDate) entity.dateModified = d.asOfDate;
  if (perf && typeof perf === 'object') {
    const ytd = pickDynamicReturn(perf, 'Year to Date (YTD)');
    const y1 = pickDynamicReturn(perf, 'Last 1 year');
    const extras: string[] = [];
    if (ytd != null) extras.push(`YTD ${ytd}%`);
    if (y1 != null) extras.push(`1Y ${y1}%`);
    if (extras.length) entity.description = `${symbol} performance: ${extras.join(', ')}`;
  }
  return entity;
}

export function buildPageJsonLd(
  pathname: string,
  breadcrumbItems: BreadcrumbItem[] = [],
  seoData: unknown = null
) {
  const meta = resolveRequestMetadata(pathname);
  const pageUrl = meta.canonical || `${SITE_ORIGIN}${pathname}`;
  const crumbs = breadcrumbItems.length ? breadcrumbItems : resolveBreadcrumbs(pathname);

  const graph: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: meta.title,
      description: meta.description,
      url: pageUrl,
      isPartOf: { '@type': 'WebSite', name: SEO_BRAND_NAME, url: SITE_ORIGIN }
    }
  ];

  if (crumbs.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: `${SITE_ORIGIN}${item.path.startsWith('/') ? item.path : `/${item.path}`}`
      }))
    });
  }

  const sym = tickerSymbolFromPath(pathname);
  if (sym) {
    graph.push(financialProductJsonLd(sym, pageUrl, seoData));
  }

  return graph;
}
