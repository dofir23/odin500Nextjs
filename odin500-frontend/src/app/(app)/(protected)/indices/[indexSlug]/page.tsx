import { PageServerShell } from '@/seo/PageServerShell';
import { generateIndexPageMetadata } from '@/seo/routeMetadataHelpers';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchIndexPageData } from '@/ssr/fetchPageData';
import IndexPage from '@/views/IndexPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ indexSlug: string }> }) {
  const p = await params;
  return generateIndexPageMetadata(p.indexSlug);
}

export const revalidate = 300;

async function IndexRouteContent({
  indexSlug,
  pathname
}: {
  indexSlug: string;
  pathname: string;
}) {
  let seoData: unknown = null;
  try {
    seoData = await fetchIndexPageData(indexSlug, false);
  } catch {
    /* SSR prefetch is best-effort */
  }

  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <IndexPage initialData={seoData as never} />
    </PageServerShell>
  );
}

export default async function Page({ params }: { params: Promise<{ indexSlug: string }> }) {
  const { indexSlug } = await params;
  const pathname = `/indices/${indexSlug}`;
  return (
    <DeferredRoutePage pathname={pathname}>
      <IndexRouteContent indexSlug={indexSlug} pathname={pathname} />
    </DeferredRoutePage>
  );
}
