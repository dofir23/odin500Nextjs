import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { fetchAiPortfoliosPageData } from '@/ssr/fetchPageData';
import AiPortfoliosPage from '@/views/PaperTrading/AiPortfoliosPage.jsx';

export const metadata = toNextMetadata('/paper-trading/ai');
export const revalidate = 300;

export default async function Page() {
  const pathname = '/paper-trading/ai';

  let seoData: unknown = null;
  try {
    seoData = await fetchAiPortfoliosPageData(25);
  } catch {
    /* SSR prefetch is best-effort — the client view still loads the board */
  }

  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <AiPortfoliosPage />
    </PageServerShell>
  );
}
