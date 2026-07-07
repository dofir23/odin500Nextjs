import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { AboutPageServer } from '@/ssr/pages/AboutPageServer';
import AboutPage from '@/views/AboutPage.jsx';

export const metadata = toNextMetadata('/about');
export const revalidate = 86400;

export default function Page() {
  return (
    <PageServerShell pathname="/about" seoData={{ about: true }} serverContent={<AboutPageServer />}>
      <AboutPage />
    </PageServerShell>
  );
}
