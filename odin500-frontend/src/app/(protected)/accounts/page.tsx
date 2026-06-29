import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import AccountsPage from '@/views/AccountsPage.jsx';

export const metadata = toNextMetadata('/accounts');
export const revalidate = 300;

export default function Page() {
  const pathname = '/accounts';
  return (
    <PageServerShell pathname={pathname}>
      <AccountsPage />
    </PageServerShell>
  );
}
