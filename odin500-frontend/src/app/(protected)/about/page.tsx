import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import AboutPage from '@/views/AboutPage.jsx';

export const metadata = toNextMetadata('/about');
export const revalidate = 300;

export default function Page() {
  const pathname = '/about';
  return (
    <PageServerShell pathname={pathname}>
      <AboutPage />
    </PageServerShell>
  );
}
