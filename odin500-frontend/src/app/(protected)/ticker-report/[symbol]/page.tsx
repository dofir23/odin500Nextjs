import { toNextMetadata } from '@/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const p = await params;
  return toNextMetadata('/ticker-report/' + p.symbol);
}
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchTickerReportPageData } from '@/ssr/fetchPageData';
import TickerReportPage from '@/views/TickerReportPage.jsx';

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchTickerReportPageData(symbol);
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = (`/ticker-report/${symbol}`);
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <TickerReportPage initialData={seoData as never} />
    </PageServerShell>
  );
}
