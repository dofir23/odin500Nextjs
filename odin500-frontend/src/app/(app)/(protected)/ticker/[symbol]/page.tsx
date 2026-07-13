import { PageServerShell } from '@/seo/PageServerShell';
import { generateTickerPageMetadata } from '@/seo/routeMetadataHelpers';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchTickerPageData } from '@/ssr/fetchPageData';
import TickerPage from '@/views/TickerPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return generateTickerPageMetadata(symbol);
}

export const revalidate = 300;

async function RouteContent({ symbol, pathname }: { symbol: string; pathname: string }) {
  let seoData: unknown = null;
  try {
    seoData = await fetchTickerPageData(symbol);
  } catch {
    /* SSR prefetch is best-effort */
  }

  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <TickerPage initialData={seoData as never} />
    </PageServerShell>
  );
}

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const pathname = `/ticker/${symbol}`;
  return (
    <DeferredRoutePage pathname={pathname}>
      <RouteContent symbol={symbol} pathname={pathname} />
    </DeferredRoutePage>
  );
}
