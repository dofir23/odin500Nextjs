import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/odin-signals');
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchOdinSignalsPageData } from '@/ssr/fetchPageData';
import OdinSignalsPage from '@/views/OdinSignalsPage.jsx';

export default async function Page() {
  let seoData: unknown = null;
  try {
    seoData = await fetchOdinSignalsPageData();
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = '/odin-signals';
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <OdinSignalsPage initialData={seoData as never} />
    </PageServerShell>
  );
}
