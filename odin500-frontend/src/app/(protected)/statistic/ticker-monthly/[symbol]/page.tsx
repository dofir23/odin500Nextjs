import { PageServerShell } from '@/seo/PageServerShell';
import { generateStatisticPageMetadata } from '@/seo/routeMetadataHelpers';
import { fetchStatisticPeriodicPageData } from '@/ssr/fetchPageData';
import TickerMonthlyPage from '@/views/TickerMonthlyPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const p = await params;
  return generateStatisticPageMetadata('ticker-monthly', p.symbol);
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchStatisticPeriodicPageData(symbol, 'monthly');
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = `/statistic/ticker-monthly/${symbol}`;
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <TickerMonthlyPage initialData={seoData as never} />
    </PageServerShell>
  );
}
