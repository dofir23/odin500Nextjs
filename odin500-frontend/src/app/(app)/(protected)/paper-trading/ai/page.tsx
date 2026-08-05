import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import AiPortfoliosPage from '@/views/PaperTrading/AiPortfoliosPage.jsx';

export const metadata = toNextMetadata('/paper-trading/ai');
export const revalidate = 300;

export default function Page() {
  const pathname = '/paper-trading/ai';
  return (
    <PageServerShell pathname={pathname}>
      <AiPortfoliosPage />
    </PageServerShell>
  );
}
