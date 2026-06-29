import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import PaperTradingPage from '@/views/PaperTrading/PaperTradingPage.jsx';

export const metadata = toNextMetadata('/paper-trading');
export const revalidate = 300;

export default function Page() {
  const pathname = '/paper-trading';
  return (
    <PageServerShell pathname={pathname}>
      <PaperTradingPage />
    </PageServerShell>
  );
}
