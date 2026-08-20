import { SEO_BRAND_NAME, SITE_ORIGIN } from '@/seo/siteConfig.js';
import { resolveRequestMetadata } from '@/seo/metadata';
import { resolveBreadcrumbs } from '@/seo/resolveBreadcrumbs';
import { pickDynamicReturn } from '@/seo/performanceSnippet';
import { PREMIUM_FAQS, premiumFaqPlainText } from '@/content/premiumFaqs';
import { ABOUT_FAQS } from '@/content/aboutPageContent';
import { METHODOLOGY_FAQS } from '@/content/methodologyPageContent';
import { PAPER_TRADING_FAQS } from '@/content/paperTradingPageContent';
import { STATIC_PAGE_SEO } from '@/seo/staticPageSeoCopy';
import { resolveVisiblePageH1 } from '@/seo/resolveVisiblePageH1';

export type BreadcrumbItem = { name: string; path: string };

function buildFaqPageJsonLd(faqs: Array<{ q: string; a: string }>) {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a
      }
    }))
  };
}

function faqJsonLdForPath(pathname: string, seoData: unknown) {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/premium') {
    return buildFaqPageJsonLd(
      PREMIUM_FAQS.map((faq) => ({ q: faq.q, a: premiumFaqPlainText(faq) }))
    );
  }
  if (path === '/methodology') {
    return buildFaqPageJsonLd([...METHODOLOGY_FAQS]);
  }
  if (path === '/about') {
    return buildFaqPageJsonLd([...ABOUT_FAQS]);
  }
  if (path === '/virtual-portfolio') {
    return buildFaqPageJsonLd([...PAPER_TRADING_FAQS]);
  }
  if (path === '/virtual-portfolio/ai') {
    return buildFaqPageJsonLd([...(STATIC_PAGE_SEO['/virtual-portfolio/ai'].faqs || [])]);
  }
  if (path === '/virtual-portfolio/ai/compare') {
    return buildFaqPageJsonLd([
      ...(STATIC_PAGE_SEO['/virtual-portfolio/ai/compare'].faqs || [])
    ]);
  }
  if (path.startsWith('/ticker-report/')) {
    const report = (seoData as { report?: { faqs?: Array<{ q?: string; a?: string }> } } | null)?.report;
    const faqs = Array.isArray(report?.faqs)
      ? report.faqs
          .filter((f) => f?.q && f?.a)
          .map((f) => ({ q: String(f.q), a: String(f.a) }))
      : [];
    return buildFaqPageJsonLd(faqs);
  }
  return null;
}

export function buildSitewideJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SEO_BRAND_NAME,
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/og-default.png`,
      description:
        'Odin500 publishes AI-managed virtual stock portfolios run by Claude, ChatGPT, and Gemini, alongside U.S. market dashboards, OHLC history, and Odin trading signals.',
      sameAs: [`${SITE_ORIGIN}/about`]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SEO_BRAND_NAME,
      url: SITE_ORIGIN
    }
  ];
}

/**
 * ItemList for /virtual-portfolio/ai/compare, flattened from its per-model groups.
 *
 * The compare page ships groups (one per AI model), not a flat `rows` array, so it cannot reuse
 * the leaderboard shape above.
 */
function aiPortfolioCompareListJsonLd(seoData: unknown) {
  const groups = (seoData as { groups?: Array<{ rows?: Array<Record<string, unknown>> }> } | null)
    ?.groups;
  if (!Array.isArray(groups) || !groups.length) return null;

  const pageUrl = `${SITE_ORIGIN}/virtual-portfolio/ai/compare`;
  const items = groups
    .flatMap((g) => (Array.isArray(g?.rows) ? g.rows : []))
    .filter((r) => r && typeof r === 'object');
  if (!items.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AI stock portfolios compared by model',
    description:
      'Best-performing published virtual portfolios for each AI model, comparable against each other and against the index they trade.',
    url: pageUrl,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 25).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: String(r.name || 'Untitled portfolio'),
      url: r.id ? `${SITE_ORIGIN}/virtual-portfolio/public/${String(r.id)}` : pageUrl
    }))
  };
}

/**
 * ItemList for the AI portfolio leaderboard, so the ranking is machine-readable rather than
 * only visible as a table. Emitted on `/` and `/virtual-portfolio/ai`, both of which SSR the board.
 */
function aiPortfolioListJsonLd(pathname: string, seoData: unknown) {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/virtual-portfolio/ai/compare') {
    return aiPortfolioCompareListJsonLd(seoData);
  }
  if (path !== '/' && path !== '/virtual-portfolio/ai') return null;

  const rows = (seoData as { rows?: Array<Record<string, unknown>> } | null)?.rows;
  if (!Array.isArray(rows) || !rows.length) return null;

  const pageUrl = path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/virtual-portfolio/ai`;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AI stock portfolios ranked by total return',
    description:
      'Virtual stock portfolios managed by large language models, ranked by total return since publication.',
    url: pageUrl,
    numberOfItems: rows.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: rows.slice(0, 25).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: String(r.name || 'Untitled portfolio'),
      url: r.id ? `${SITE_ORIGIN}/virtual-portfolio/public/${String(r.id)}` : pageUrl
    }))
  };
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
  const visibleH1 = resolveVisiblePageH1(pathname);

  const graph: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: visibleH1 || meta.title,
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

  const faqLd = faqJsonLdForPath(pathname, seoData);
  if (faqLd) graph.push(faqLd);

  const aiListLd = aiPortfolioListJsonLd(pathname, seoData);
  if (aiListLd) graph.push(aiListLd);

  return graph;
}
