import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchOdinSignalsPageData } from '@/ssr/fetchPageData';
import OdinSignalsPage from '@/views/OdinSignalsPage.jsx';

export const metadata = toNextMetadata('/odin-signals');
export const revalidate = 300;

async function RouteContent() {
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

export default function Page() {
  return (
    <DeferredRoutePage pathname="/odin-signals">
      <RouteContent />
    </DeferredRoutePage>
  );
}
