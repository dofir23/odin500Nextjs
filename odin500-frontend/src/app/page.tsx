import { toNextMetadata } from '@/seo/metadata';
import { PageJsonLd } from '@/seo/JsonLd';
import { SeoCrawlerSummary } from '@/seo/SeoCrawlerSummary';
import { SeoInternalLinks } from '@/seo/SeoInternalLinks';
import { HomePageServer } from '@/ssr/pages/HomePageServer';
import { fetchAiPortfoliosPageData } from '@/ssr/fetchPageData';
import { FullSsrPage } from '@/ssr/enhance/FullSsrPage';
import HomePage from '@/views/HomePage.jsx';

export const metadata = toNextMetadata('/');
export const revalidate = 300;

/**
 * Marketing homepage: server HTML is the primary document (works with JS off).
 * Client HomePage enhances after hydrate; Providers live under (app)/ so this
 * route does not bail out to client-only rendering.
 */
export default async function HomePageRoute() {
  // Cache-eligible fetch (no cookies/headers), so `/` keeps ISR prerendering rather than
  // bailing to dynamic rendering.
  let aiPortfolios: unknown = null;
  try {
    aiPortfolios = await fetchAiPortfoliosPageData(5);
  } catch {
    /* best-effort — the rest of the homepage renders regardless */
  }

  return (
    <>
      <PageJsonLd pathname="/" breadcrumbItems={[]} seoData={aiPortfolios} />
      <SeoCrawlerSummary pathname="/" data={null} />
      <SeoInternalLinks pathname="/" />
      <FullSsrPage server={<HomePageServer aiPortfolios={aiPortfolios} />} client={<HomePage />} />
    </>
  );
}
