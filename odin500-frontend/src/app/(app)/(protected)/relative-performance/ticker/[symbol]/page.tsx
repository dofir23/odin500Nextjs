import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchRelativeStrengthPageData } from '@/ssr/fetchPageData';
import RelativeStrengthTickerPage from '@/views/RelativeStrengthTickerPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const p = await params;
  return toNextMetadata('/relative-performance/ticker/' + p.symbol);
}
export const revalidate = 300;

async function RouteContent({ symbol, pathname }: { symbol: string; pathname: string }) {
  let seoData: unknown = null;
  try {
    seoData = await fetchRelativeStrengthPageData(symbol);
  } catch {
    /* SSR prefetch is best-effort */
  }

  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <RelativeStrengthTickerPage initialData={seoData as never} />
    </PageServerShell>
  );
}

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const pathname = `/relative-performance/ticker/${symbol}`;
  return (
    <DeferredRoutePage pathname={pathname}>
      <RouteContent symbol={symbol} pathname={pathname} />
    </DeferredRoutePage>
  );
}
