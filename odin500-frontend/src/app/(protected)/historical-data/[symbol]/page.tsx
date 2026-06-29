import HistoricalDataPage from '@/views/HistoricalDataPage.jsx';
import { fetchHistoricalDataPreview } from '@/ssr/fetchHistoricalDataPreview.js';
import {
  enrichHistoricalDataMetadata,
  metadataFromResolved,
  resolveRequestMetadata,
  toNextMetadata
} from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const pathname = `/historical-data/${symbol}`;
  const baseMeta = resolveRequestMetadata(pathname);
  try {
    const preview = await fetchHistoricalDataPreview(symbol.toUpperCase());
    if (preview) {
      const enriched = enrichHistoricalDataMetadata(
        {
          title: baseMeta.title,
          description: baseMeta.description,
          canonical: baseMeta.canonical || ''
        },
        preview
      );
      return metadataFromResolved(enriched, pathname);
    }
  } catch {
    /* ignore */
  }
  return toNextMetadata(pathname);
}

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let initialPreview = null;
  try {
    initialPreview = await fetchHistoricalDataPreview(symbol.toUpperCase());
  } catch {
    /* ignore */
  }
  const pathname = `/historical-data/${symbol}`;
  return (
    <PageServerShell pathname={pathname} seoData={initialPreview}>
      <HistoricalDataPage initialPreview={initialPreview} />
    </PageServerShell>
  );
}
