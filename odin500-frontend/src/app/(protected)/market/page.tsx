import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/market');
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchMarketDashboardData } from '@/ssr/fetchPageData';
import App from '@/App.jsx';

export default async function Page() {
  let seoData: unknown = null;
  try {
    seoData = await fetchMarketDashboardData('1Y');
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = '/market';
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <App initialMarketData={seoData as never} />
    </PageServerShell>
  );
}
