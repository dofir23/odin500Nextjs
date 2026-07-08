import { PageServerShell } from '@/seo/PageServerShell';
import { generateStatisticPageMetadata } from '@/seo/routeMetadataHelpers';
import { fetchStatisticQuarterlyPageData } from '@/ssr/fetchPageData';
import TickerQuarterlyPage from '@/views/TickerQuarterlyPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const p = await params;
  return generateStatisticPageMetadata('ticker-quarterly', p.symbol);
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchStatisticQuarterlyPageData(symbol);
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = `/statistic/ticker-quarterly/${symbol}`;
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <TickerQuarterlyPage initialData={seoData as never} />
    </PageServerShell>
  );
}
