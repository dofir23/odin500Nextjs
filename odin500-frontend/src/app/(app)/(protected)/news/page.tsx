import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/news');
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { fetchNewsPageData } from '@/ssr/fetchPageData';
import NewsPage from '@/views/NewsPage.jsx';

export default async function Page() {
  let seoData: unknown = null;
  try {
    seoData = await fetchNewsPageData();
  } catch {
    /* ignore */
  }

  return (
    <PageServerShell pathname="/news" seoData={seoData}>
      <NewsPage initialData={seoData as never} />
    </PageServerShell>
  );
}
