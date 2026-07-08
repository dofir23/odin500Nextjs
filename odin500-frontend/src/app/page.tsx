import { toNextMetadata } from '@/seo/metadata';
import { PageJsonLd } from '@/seo/JsonLd';
import { SeoCrawlerSummary } from '@/seo/SeoCrawlerSummary';
import { SeoInternalLinks } from '@/seo/SeoInternalLinks';
import { HomePageServer } from '@/ssr/pages/HomePageServer';
import { FullSsrPage } from '@/ssr/enhance/FullSsrPage';
import HomePage from '@/views/HomePage.jsx';

export const metadata = toNextMetadata('/');
export const revalidate = 300;

/**
 * Marketing homepage: server HTML is the primary document (works with JS off).
 * Client HomePage enhances after hydrate; Providers live under (app)/ so this
 * route does not bail out to client-only rendering.
 */
export default function HomePageRoute() {
  return (
    <>
      <PageJsonLd pathname="/" breadcrumbItems={[]} seoData={null} />
      <SeoCrawlerSummary pathname="/" data={null} />
      <SeoInternalLinks pathname="/" />
      <FullSsrPage server={<HomePageServer />} client={<HomePage />} />
    </>
  );
}
