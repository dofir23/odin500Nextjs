import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import LoginPage from '@/views/LoginPage.jsx';

export const metadata = toNextMetadata('/login');

export default function Page() {
  return (
    <PageServerShell pathname="/login">
      <LoginPage />
    </PageServerShell>
  );
}
