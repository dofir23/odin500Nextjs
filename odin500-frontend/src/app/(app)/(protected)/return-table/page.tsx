import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchReturnTablePageData } from '@/ssr/fetchPageData';
import ReturnTablePage from '@/views/ReturnTablePage.jsx';

export const metadata = toNextMetadata('/return-table');
export const revalidate = 300;

async function RouteContent() {
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

export default function Page() {
  return (
    <DeferredRoutePage pathname="/return-table">
      <RouteContent />
    </DeferredRoutePage>
  );
}
