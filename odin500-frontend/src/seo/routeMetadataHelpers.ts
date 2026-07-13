import { toNextMetadata } from '@/seo/metadata';

/**
 * Page metadata for dynamic routes.
 *
 * Intentionally does **not** await market/API enrichment. In Next.js 15.2+,
 * slow `generateMetadata` is streamed into `<body>` after the first HTML chunk,
 * so SEO tools that only inspect the initial `<head>` report “no title”.
 * Catalog titles/descriptions from `resolveRequestMetadata` are unique per URL
 * and resolve in the same task, so they ship in the initial `<head>`.
 */
export async function generateTickerPageMetadata(symbol: string) {
  return toNextMetadata(`/ticker/${symbol}`);
}

export async function generateIndexPageMetadata(indexSlug: string) {
  return toNextMetadata(`/indices/${indexSlug}`);
}

export async function generateSectorPageMetadata(sectorKey: string) {
  return toNextMetadata(`/sector-data/${sectorKey}`);
}

export async function generateStatisticPageMetadata(kind: string, symbol: string) {
  return toNextMetadata(`/statistic/${kind}/${symbol}`);
}

export async function generateHistoricalPageMetadata(symbol: string) {
  return toNextMetadata(`/historical-data/${symbol}`);
}
