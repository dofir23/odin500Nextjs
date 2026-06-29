import { PageServerShell } from '@/seo/PageServerShell';
import { generateStatisticPageMetadata } from '@/seo/routeMetadataHelpers';
import { fetchStatisticPeriodicPageData } from '@/ssr/fetchPageData';
import TickerWeeklyPage from '@/views/TickerWeeklyPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const p = await params;
  return generateStatisticPageMetadata('ticker-weekly', p.symbol);
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchStatisticPeriodicPageData(symbol, 'weekly');
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = `/statistic/ticker-weekly/${symbol}`;
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <TickerWeeklyPage initialData={seoData as never} />
    </PageServerShell>
  );
}
