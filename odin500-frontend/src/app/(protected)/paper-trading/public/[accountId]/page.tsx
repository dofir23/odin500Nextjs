import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import PublicPortfolioDetailPage from '@/views/PaperTrading/PublicPortfolioDetailPage.jsx';

type PageProps = {
  params: Promise<{ accountId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { accountId } = await params;
  return toNextMetadata(`/paper-trading/public/${accountId}`);
}

export const revalidate = 300;

export default async function Page({ params }: PageProps) {
  const { accountId } = await params;
  const pathname = `/paper-trading/public/${accountId}`;
  return (
    <PageServerShell pathname={pathname}>
      <PublicPortfolioDetailPage />
    </PageServerShell>
  );
}
