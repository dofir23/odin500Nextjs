import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/signup/verify-email');
import { PageServerShell } from '@/seo/PageServerShell';
import SignupVerifyEmailPage from '@/views/SignupVerifyEmailPage.jsx';

export default function Page() {
  return (
    <PageServerShell pathname="/signup/verify-email">
      <SignupVerifyEmailPage />
    </PageServerShell>
  );
}
