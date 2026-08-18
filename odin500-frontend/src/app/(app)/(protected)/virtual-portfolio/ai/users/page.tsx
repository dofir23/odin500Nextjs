import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { UserAiPortfoliosPage } from '@/views/PaperTrading/AiPortfoliosPage.jsx';

export const metadata = toNextMetadata('/virtual-portfolio/ai/users');
export const revalidate = 300;

export default function Page() {
  return (
    <PageServerShell pathname="/virtual-portfolio/ai/users" seoData={null}>
      <UserAiPortfoliosPage />
    </PageServerShell>
  );
}
