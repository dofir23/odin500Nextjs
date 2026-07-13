import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchNewsPageData } from '@/ssr/fetchPageData';
import NewsPage from '@/views/NewsPage.jsx';

export const metadata = toNextMetadata('/news');
export const revalidate = 300;

async function RouteContent() {
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

export default function Page() {
  return (
    <DeferredRoutePage pathname="/news">
      <RouteContent />
    </DeferredRoutePage>
  );
}
