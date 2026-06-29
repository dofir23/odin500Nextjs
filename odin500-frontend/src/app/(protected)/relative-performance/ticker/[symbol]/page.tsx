import { toNextMetadata } from '@/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const p = await params;
  return toNextMetadata('/relative-performance/ticker/' + p.symbol);
}
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchRelativeStrengthPageData } from '@/ssr/fetchPageData';
import RelativeStrengthTickerPage from '@/views/RelativeStrengthTickerPage.jsx';

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchRelativeStrengthPageData(symbol);
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = (`/relative-performance/ticker/${symbol}`);
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <RelativeStrengthTickerPage initialData={seoData as never} />
    </PageServerShell>
  );
}
