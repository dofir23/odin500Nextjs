import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/signup/username');
import { PageServerShell } from '@/seo/PageServerShell';
import SignupUsernamePage from '@/views/SignupUsernamePage.jsx';

export default function Page() {
  return (
    <PageServerShell pathname="/signup/username">
      <SignupUsernamePage />
    </PageServerShell>
  );
}
