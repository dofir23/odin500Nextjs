import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/statistic-data');
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchStatisticDataPageData } from '@/ssr/fetchPageData';
import StatisticDataPage from '@/views/StatisticDataPage.jsx';

export default async function Page() {
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
