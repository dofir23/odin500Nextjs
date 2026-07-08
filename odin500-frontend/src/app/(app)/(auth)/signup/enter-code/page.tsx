import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/signup/enter-code');
import { PageServerShell } from '@/seo/PageServerShell';
import SignupEnterCodePage from '@/views/SignupEnterCodePage.jsx';

export default function Page() {
  return (
    <PageServerShell pathname="/signup/enter-code">
      <SignupEnterCodePage />
    </PageServerShell>
  );
}
