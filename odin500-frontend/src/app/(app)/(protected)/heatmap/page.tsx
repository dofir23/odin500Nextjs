import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchHeatmapPageData } from '@/ssr/fetchPageData';
import MarketHeatmapPage from '@/views/MarketHeatmapPage.jsx';

export const metadata = toNextMetadata('/heatmap');
export const revalidate = 300;

async function RouteContent() {
  let seoData: unknown = null;
  try {
    seoData = await fetchHeatmapPageData();
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = '/heatmap';
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <MarketHeatmapPage initialData={seoData as never} />
    </PageServerShell>
  );
}

export default function Page() {
  return (
    <DeferredRoutePage pathname="/heatmap">
      <RouteContent />
    </DeferredRoutePage>
  );
}
