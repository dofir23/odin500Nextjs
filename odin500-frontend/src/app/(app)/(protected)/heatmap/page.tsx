import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/heatmap');
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchHeatmapPageData } from '@/ssr/fetchPageData';
import MarketHeatmapPage from '@/views/MarketHeatmapPage.jsx';

export default async function Page() {
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
