import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { MethodologyPageServer } from '@/ssr/pages/MethodologyPageServer';
import MethodologyPage from '@/views/MethodologyPage.jsx';

export const metadata = toNextMetadata('/methodology');
export const revalidate = 86400;

export default function Page() {
  return (
    <PageServerShell
      pathname="/methodology"
      seoData={{ methodology: true }}
      serverContent={<MethodologyPageServer />}
    >
      <MethodologyPage />
    </PageServerShell>
  );
}
