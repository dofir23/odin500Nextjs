import { PageServerShell } from '@/seo/PageServerShell';
import { generateSectorPageMetadata } from '@/seo/routeMetadataHelpers';
import { fetchIndexPageData } from '@/ssr/fetchPageData';
import IndexPage from '@/views/IndexPage.jsx';

export async function generateMetadata({ params }: { params: Promise<{ sectorKey: string }> }) {
  const p = await params;
  return generateSectorPageMetadata(p.sectorKey);
}

export const revalidate = 300;

export default async function Page({ params }: { params: Promise<{ sectorKey: string }> }) {
  const { sectorKey } = await params;
  let seoData: unknown = null;
  try {
    seoData = await fetchIndexPageData(sectorKey, true);
  } catch {
    /* SSR prefetch is best-effort */
  }

  const pathname = `/sector-data/${sectorKey}`;
  return (
    <PageServerShell pathname={pathname} seoData={seoData}>
      <IndexPage initialData={seoData as never} />
    </PageServerShell>
  );
}
