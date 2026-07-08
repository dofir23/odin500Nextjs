import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/return-table');
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchReturnTablePageData } from '@/ssr/fetchPageData';
import ReturnTablePage from '@/views/ReturnTablePage.jsx';

export default async function Page() {
  let seoData: unknown = null;
  try {
    seoData = await fetchReturnTablePageData();
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = '/return-table';
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <ReturnTablePage initialData={seoData as never} />
    </PageServerShell>
  );
}
