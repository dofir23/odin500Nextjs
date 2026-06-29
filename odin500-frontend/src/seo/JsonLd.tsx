import { buildSitewideJsonLd } from './buildPageJsonLd';
import type { BreadcrumbItem } from './buildPageJsonLd';
import { buildPageJsonLd } from './buildPageJsonLd';

type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

/** Server-rendered JSON-LD — visible to crawlers without JavaScript. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function JsonLdSitewide() {
  return <JsonLd data={buildSitewideJsonLd()} />;
}

export function PageJsonLd({
  pathname,
  breadcrumbItems = [],
  seoData = null
}: {
  pathname: string;
  breadcrumbItems?: BreadcrumbItem[];
  seoData?: unknown;
}) {
  return <JsonLd data={buildPageJsonLd(pathname, breadcrumbItems, seoData)} />;
}
