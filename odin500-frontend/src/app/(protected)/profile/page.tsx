import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import ProfilePage from '@/views/ProfilePage.jsx';

export const metadata = toNextMetadata('/profile');
export const revalidate = 300;

export default function Page() {
  const pathname = '/profile';
  return (
    <PageServerShell pathname={pathname}>
      <ProfilePage />
    </PageServerShell>
  );
}
