import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import ForgotPasswordPage from '@/views/ForgotPasswordPage.jsx';

export const metadata = toNextMetadata('/forgot-password');

export default function Page() {
  return (
    <PageServerShell pathname="/forgot-password">
      <ForgotPasswordPage />
    </PageServerShell>
  );
}
