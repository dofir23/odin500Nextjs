import {
  enrichIndexMetadata,
  enrichSectorMetadata,
  enrichStatisticMetadata,
  enrichTickerMetadata,
  metadataFromResolved,
  resolveRequestMetadata,
  toNextMetadata
} from '@/seo/metadata';
import { fetchHistoricalDataPreview } from '@/ssr/fetchHistoricalDataPreview.js';

async function loadStatisticSeoData(kind: string, symbol: string) {
  const {
    fetchStatisticAnnualPageData,
    fetchStatisticQuarterlyPageData,
    fetchStatisticPeriodicPageData
  } = await import('@/ssr/fetchPageData');
  switch (kind) {
    case 'ticker-annual':
      return fetchStatisticAnnualPageData(symbol);
    case 'ticker-quarterly':
      return fetchStatisticQuarterlyPageData(symbol);
    case 'ticker-monthly':
      return fetchStatisticPeriodicPageData(symbol, 'monthly');
    case 'ticker-weekly':
      return fetchStatisticPeriodicPageData(symbol, 'weekly');
    case 'ticker-daily':
      return fetchStatisticPeriodicPageData(symbol, 'daily');
    default:
      return null;
  }
}

export async function generateTickerPageMetadata(symbol: string) {
  const pathname = `/ticker/${symbol}`;
  const baseMeta = resolveRequestMetadata(pathname);
  try {
    const { fetchTickerPageData } = await import('@/ssr/fetchPageData');
    const [seoData, preview] = await Promise.all([
      fetchTickerPageData(symbol),
      fetchHistoricalDataPreview(symbol.toUpperCase())
    ]);
    if (seoData) {
      const enriched = enrichTickerMetadata(
        {
          title: baseMeta.title,
          description: baseMeta.description,
          canonical: baseMeta.canonical || ''
        },
        { ...seoData, company_name: preview?.company_name }
      );
      return metadataFromResolved(enriched, pathname);
    }
  } catch {
    /* fallback */
  }
  return toNextMetadata(pathname);
}

export async function generateIndexPageMetadata(indexSlug: string) {
  const pathname = `/indices/${indexSlug}`;
  const baseMeta = resolveRequestMetadata(pathname);
  try {
    const { fetchIndexPageData } = await import('@/ssr/fetchPageData');
    const seoData = await fetchIndexPageData(indexSlug, false);
    if (seoData) {
      const enriched = enrichIndexMetadata(
        {
          title: baseMeta.title,
          description: baseMeta.description,
          canonical: baseMeta.canonical || ''
        },
        seoData
      );
      return metadataFromResolved(enriched, pathname);
    }
  } catch {
    /* fallback */
  }
  return toNextMetadata(pathname);
}

export async function generateSectorPageMetadata(sectorKey: string) {
  const pathname = `/sector-data/${sectorKey}`;
  const baseMeta = resolveRequestMetadata(pathname);
  try {
    const { fetchIndexPageData } = await import('@/ssr/fetchPageData');
    const seoData = await fetchIndexPageData(sectorKey, true);
    if (seoData) {
      const enriched = enrichSectorMetadata(
        {
          title: baseMeta.title,
          description: baseMeta.description,
          canonical: baseMeta.canonical || ''
        },
        seoData
      );
      return metadataFromResolved(enriched, pathname);
    }
  } catch {
    /* fallback */
  }
  return toNextMetadata(pathname);
}

export async function generateStatisticPageMetadata(kind: string, symbol: string) {
  const pathname = `/statistic/${kind}/${symbol}`;
  const baseMeta = resolveRequestMetadata(pathname);
  try {
    const [seoData, preview] = await Promise.all([
      loadStatisticSeoData(kind, symbol),
      fetchHistoricalDataPreview(symbol.toUpperCase())
    ]);
    if (seoData) {
      const enriched = enrichStatisticMetadata(
        {
          title: baseMeta.title,
          description: baseMeta.description,
          canonical: baseMeta.canonical || ''
        },
        kind,
        { ...seoData, company_name: preview?.company_name }
      );
      return metadataFromResolved(enriched, pathname);
    }
  } catch {
    /* fallback */
  }
  return toNextMetadata(pathname);
}
