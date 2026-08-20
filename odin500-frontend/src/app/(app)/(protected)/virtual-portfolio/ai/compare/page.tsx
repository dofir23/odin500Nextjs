import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { fetchAiPortfolioComparePageData } from '@/ssr/fetchPageData';
import AiPortfolioComparePage from '@/views/PaperTrading/AiPortfolioComparePage.jsx';

export const metadata = toNextMetadata('/virtual-portfolio/ai/compare');
export const revalidate = 300;

/**
 * Selection-driven page: the chart only has meaning once the reader picks series, so the client
 * view gives a crawler nothing to read. The SSR layer therefore carries each model's best
 * published books — the same per-model breakdown this page's copy and FAQ describe — so the URL
 * has indexable data of its own rather than depending on /virtual-portfolio/ai for all of it.
 */
export default async function Page() {
  let seoData: unknown = null;
  try {
    seoData = await fetchAiPortfolioComparePageData(5);
  } catch {
    /* SSR prefetch is best-effort — the client view still loads the comparison chart */
  }

  return (
    <PageServerShell pathname="/virtual-portfolio/ai/compare" seoData={seoData}>
      <AiPortfolioComparePage />
    </PageServerShell>
  );
}
