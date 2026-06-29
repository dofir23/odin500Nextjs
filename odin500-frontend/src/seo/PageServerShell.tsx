import type { ReactNode } from 'react';
import { FullSsrPage } from '@/ssr/enhance/FullSsrPage';
import { ServerPageBody } from '@/ssr/pages/ServerPageBody';
import { PageJsonLd } from './JsonLd';
import { SeoCrawlerSummary } from './SeoCrawlerSummary';
import { SeoInternalLinks } from './SeoInternalLinks';
import { ServerPageContent } from './ServerPageContent';
import type { BreadcrumbItem } from './buildPageJsonLd';

type PageServerShellProps = {
  pathname: string;
  seoData?: unknown;
  breadcrumbItems?: BreadcrumbItem[];
  children: ReactNode;
  /** @deprecated All routes use full SSR by default. */
  ssrMode?: 'seo-fallback' | 'ssr-primary';
  /** Override default ServerPageBody (e.g. PremiumPageServer, StockSplitsPageServer). */
  serverContent?: ReactNode;
};

/**
 * Full SSR page shell: JSON-LD, server HTML body, internal links, client enhance after hydrate.
 */
export function PageServerShell({
  pathname,
  seoData = null,
  breadcrumbItems = [],
  children,
  ssrMode = 'ssr-primary',
  serverContent
}: PageServerShellProps) {
  const server =
    serverContent ?? <ServerPageBody pathname={pathname} data={seoData} />;

  return (
    <>
      <PageJsonLd pathname={pathname} breadcrumbItems={breadcrumbItems} seoData={seoData} />
      <SeoCrawlerSummary pathname={pathname} data={seoData} />
      <SeoInternalLinks pathname={pathname} />
      {ssrMode === 'ssr-primary' ? (
        <FullSsrPage server={server} client={children} />
      ) : (
        <>
          <ServerPageContent pathname={pathname} data={seoData} />
          {children}
        </>
      )}
    </>
  );
}
