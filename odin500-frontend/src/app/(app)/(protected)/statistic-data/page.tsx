import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchStatisticDataPageData } from '@/ssr/fetchPageData';
import StatisticDataPage from '@/views/StatisticDataPage.jsx';

export const metadata = toNextMetadata('/statistic-data');
export const revalidate = 300;

async function RouteContent() {
  let seoData: unknown = null;
  try {
    seoData = await fetchStatisticDataPageData('AAPL');
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = '/statistic-data';
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <StatisticDataPage initialData={seoData as never} />
    </PageServerShell>
  );
}

export default function Page() {
  return (
    <DeferredRoutePage pathname="/statistic-data">
      <RouteContent />
    </DeferredRoutePage>
  );
}
