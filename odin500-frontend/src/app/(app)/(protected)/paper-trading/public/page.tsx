import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import PublicPortfoliosPage from '@/views/PaperTrading/PublicPortfoliosPage.jsx';

export const metadata = toNextMetadata('/paper-trading/public');
export const revalidate = 300;

export default function Page() {
  const pathname = '/paper-trading/public';
  return (
    <PageServerShell pathname={pathname}>
      <PublicPortfoliosPage />
    </PageServerShell>
  );
}
