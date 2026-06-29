import { PageServerShell } from '@/seo/PageServerShell';
import { generateTickerPageMetadata } from '@/seo/routeMetadataHelpers';
import { fetchTickerPageData } from '@/ssr/fetchPageData';
import TickerPage from '@/views/TickerPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return generateTickerPageMetadata(symbol);
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchTickerPageData(symbol);
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = `/ticker/${symbol}`;
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <TickerPage initialData={seoData as never} />
    </PageServerShell>
  );
}
