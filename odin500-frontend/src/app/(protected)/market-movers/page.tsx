import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/market-movers');
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchMarketMoversPageData } from '@/ssr/fetchPageData';
import MarketMoversPage from '@/views/MarketMoversPage.jsx';

export default async function Page() {
  let seoData: unknown = null;
  try {
    seoData = await fetchMarketMoversPageData();
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = '/market-movers';
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <MarketMoversPage initialData={seoData as never} />
    </PageServerShell>
  );
}
