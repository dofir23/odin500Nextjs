import { PageServerShell } from '@/seo/PageServerShell';
import { generateIndexPageMetadata } from '@/seo/routeMetadataHelpers';
import { fetchIndexPageData } from '@/ssr/fetchPageData';
import IndexPage from '@/views/IndexPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ indexSlug: string }> }) {
  const p = await params;
  return generateIndexPageMetadata(p.indexSlug);
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<{ indexSlug: string }> }) {
  const { indexSlug } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchIndexPageData(indexSlug, false);
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = `/indices/${indexSlug}`;
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <IndexPage initialData={seoData as never} />
    </PageServerShell>
  );
}
