import {
  metadataFromResolved,
  resolveRequestMetadata,
  toNextMetadata,
  withCompanyName
} from '@/seo/metadata';
import { getTickerIdentity } from '@/ssr/fetchPageData';

/**
 * Page metadata for dynamic routes.
 *
 * Catalog titles/descriptions from `resolveRequestMetadata` are unique per URL and resolve
 * synchronously, so they ship in the initial `<head>`.
 *
 * Symbol routes additionally await one company-name lookup — a deliberate change from the
 * previous "never await enrichment here" rule, which existed because Next 15.2+ streams slow
 * `generateMetadata` into `<body>` after the first chunk, and head-only SEO auditors then report
 * "no title". Two things make the await safe now:
 *
 *  - `htmlLimitedBots` in next.config.ts covers Googlebot and the audit crawlers, and for those
 *    agents Next buffers the whole document, so metadata is in `<head>` regardless of timing.
 *  - `getTickerIdentity` is React-`cache()`d and shared with the page's own data fetch, so it
 *    costs one upstream call per request, not two.
 *
 * The payoff: titles led with a bare ticker ("AEP Stock Price…"), matching only searches that
 * already knew the symbol. The company name now leads, where most search volume actually is.
 */
async function symbolRouteMetadata(pathname: string, symbol: string) {
  const base = resolveRequestMetadata(pathname);
  const { companyName } = await getTickerIdentity(symbol);
  return metadataFromResolved(withCompanyName(base, symbol, companyName), pathname);
}

export async function generateTickerPageMetadata(symbol: string) {
  return symbolRouteMetadata(`/ticker/${symbol}`, symbol);
}

export async function generateIndexPageMetadata(indexSlug: string) {
  return toNextMetadata(`/indices/${indexSlug}`);
}

export async function generateSectorPageMetadata(sectorKey: string) {
  return toNextMetadata(`/sector-data/${sectorKey}`);
}

export async function generateStatisticPageMetadata(kind: string, symbol: string) {
  return symbolRouteMetadata(`/statistic/${kind}/${symbol}`, symbol);
}

export async function generateHistoricalPageMetadata(symbol: string) {
  return symbolRouteMetadata(`/historical-data/${symbol}`, symbol);
}

export async function generateTickerReportPageMetadata(symbol: string) {
  return symbolRouteMetadata(`/ticker-report/${symbol}`, symbol);
}

export async function generateRelativePerformanceMetadata(symbol: string) {
  return symbolRouteMetadata(`/relative-performance/ticker/${symbol}`, symbol);
}
