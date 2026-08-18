import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import PublicPortfoliosPage from '@/views/PaperTrading/PublicPortfoliosPage.jsx';

export const metadata = toNextMetadata('/virtual-portfolio/public');
export const revalidate = 300;

export default function Page() {
  const pathname = '/virtual-portfolio/public';
  return (
    <PageServerShell pathname={pathname}>
      <PublicPortfoliosPage />
    </PageServerShell>
  );
}
