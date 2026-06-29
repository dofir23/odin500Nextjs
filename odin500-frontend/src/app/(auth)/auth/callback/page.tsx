import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import AuthCallbackPage from '@/views/AuthCallbackPage.jsx';

export const metadata = toNextMetadata('/auth/callback');

export default function Page() {
  const pathname = '/auth/callback';
  return (
    <PageServerShell pathname={pathname}>
      <AuthCallbackPage />
    </PageServerShell>
  );
}
