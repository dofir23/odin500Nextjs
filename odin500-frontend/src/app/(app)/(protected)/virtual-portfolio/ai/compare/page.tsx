import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import AiPortfolioComparePage from '@/views/PaperTrading/AiPortfolioComparePage.jsx';

export const metadata = toNextMetadata('/virtual-portfolio/ai/compare');
export const revalidate = 300;

/**
 * Selection-driven page — the chart only has meaning once the reader picks series, so there is
 * no SSR payload worth prefetching here. The leaderboard at /virtual-portfolio/ai carries the
 * crawlable ranking.
 */
export default function Page() {
  return (
    <PageServerShell pathname="/virtual-portfolio/ai/compare" seoData={null}>
      <AiPortfolioComparePage />
    </PageServerShell>
  );
}
