import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { PaperTradingPageServer } from '@/ssr/pages/PaperTradingPageServer';
import PaperTradingPage from '@/views/PaperTrading/PaperTradingPage.jsx';

export const metadata = toNextMetadata('/virtual-portfolio');
export const revalidate = 300;

export default function Page() {
  const pathname = '/virtual-portfolio';
  return (
    <PageServerShell pathname={pathname} serverContent={<PaperTradingPageServer />}>
      <PaperTradingPage />
    </PageServerShell>
  );
}
