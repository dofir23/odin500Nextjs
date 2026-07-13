import { PageServerShell } from '@/seo/PageServerShell';
import { generateSectorPageMetadata } from '@/seo/routeMetadataHelpers';
import { DeferredRoutePage } from '@/ssr/DeferredRoutePage';
import { fetchIndexPageData } from '@/ssr/fetchPageData';
import IndexPage from '@/views/IndexPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ sectorKey: string }> }) {
  const p = await params;
  return generateSectorPageMetadata(p.sectorKey);
}

export const revalidate = 300;

async function RouteContent({
  sectorKey,
  pathname
}: {
  sectorKey: string;
  pathname: string;
}) {
  let seoData: unknown = null;
  try {
    seoData = await fetchIndexPageData(sectorKey, true);
  } catch {
    /* SSR prefetch is best-effort */
  }

  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <IndexPage initialData={seoData as never} />
    </PageServerShell>
  );
}

export default async function Page({ params }: { params: Promise<{ sectorKey: string }> }) {
  const { sectorKey } = await params;
  const pathname = `/sector-data/${sectorKey}`;
  return (
    <DeferredRoutePage pathname={pathname}>
      <RouteContent sectorKey={sectorKey} pathname={pathname} />
    </DeferredRoutePage>
  );
}
