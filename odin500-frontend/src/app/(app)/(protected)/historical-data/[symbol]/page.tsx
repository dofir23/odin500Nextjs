import HistoricalDataPage from '@/views/HistoricalDataPage.jsx';
import { fetchHistoricalDataPreview } from '@/ssr/fetchHistoricalDataPreview.js';
import { generateHistoricalPageMetadata } from '@/seo/routeMetadataHelpers';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return generateHistoricalPageMetadata(symbol);
}

async function RouteContent({ symbol, pathname }: { symbol: string; pathname: string }) {
  let initialPreview = null;
  try {
    initialPreview = await fetchHistoricalDataPreview(symbol.toUpperCase());
  } catch {
    /* ignore */
  }
  return (
    <PageServerShell pathname={pathname} seoData={initialPreview}>
      <HistoricalDataPage initialPreview={initialPreview} />
    </PageServerShell>
  );
}

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const pathname = `/historical-data/${symbol}`;
  return (
    <DeferredRoutePage pathname={pathname}>
      <RouteContent symbol={symbol} pathname={pathname} />
    </DeferredRoutePage>
  );
}
