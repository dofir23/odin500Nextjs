import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import SignupPage from '@/views/SignupPage.jsx';

export const metadata = toNextMetadata('/signup');

export default function Page() {
  return (
    <PageServerShell pathname="/signup">
      <SignupPage />
    </PageServerShell>
  );
}
