import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchMarketDashboardData } from '@/ssr/fetchPageData';
import MarketDashboardPage from '@/views/MarketDashboardPage.jsx';

export const metadata = toNextMetadata('/market');
export const revalidate = 300;

async function RouteContent() {
  let seoData: unknown = null;
  try {
    seoData = await fetchMarketDashboardData('1Y');
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = '/market';
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <MarketDashboardPage initialMarketData={seoData as never} />
    </PageServerShell>
  );
}

export default function Page() {
  return (
    <DeferredRoutePage pathname="/market">
      <RouteContent />
    </DeferredRoutePage>
  );
}
