import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchStockSplitsPageData } from '@/ssr/fetchPageData';
import type { StockSplitsInitialData } from '@/ssr/fetchPageData';
import { StockSplitsPageServer } from '@/ssr/pages/StockSplitsPageServer';
import StockSplitsPage from '@/views/StockSplitsPage.jsx';

export const metadata = toNextMetadata('/stock-splits');
export const revalidate = 300;

async function RouteContent() {
  let seoData: StockSplitsInitialData | null = null;
  try {
    seoData = await fetchStockSplitsPageData();
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = '/stock-splits';
  return (
    <PageServerShell
      pathname={pathname}
      seoData={seoData}
      serverContent={<StockSplitsPageServer data={seoData} />}
    >
      <StockSplitsPage initialData={seoData} />
    </PageServerShell>
  );
}

export default function Page() {
  return (
    <DeferredRoutePage pathname="/stock-splits">
      <RouteContent />
    </DeferredRoutePage>
  );
}
