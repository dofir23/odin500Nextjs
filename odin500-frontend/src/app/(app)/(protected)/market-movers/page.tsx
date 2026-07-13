import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchMarketMoversPageData } from '@/ssr/fetchPageData';
import MarketMoversPage from '@/views/MarketMoversPage.jsx';

export const metadata = toNextMetadata('/market-movers');
export const revalidate = 300;

async function RouteContent() {
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

export default function Page() {
  return (
    <DeferredRoutePage pathname="/market-movers">
      <RouteContent />
    </DeferredRoutePage>
  );
}
