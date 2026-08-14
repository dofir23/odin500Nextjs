import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import SignupUsernamePage from '@/views/SignupUsernamePage.jsx';

export const metadata = toNextMetadata('/signup/username');

export default function Page() {
  return (
    <PageServerShell pathname="/signup/username">
      <SignupUsernamePage />
    </PageServerShell>
  );
}
