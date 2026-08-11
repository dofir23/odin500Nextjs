import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/seo/siteConfig.js';

/**
 * Auth and account pages are kept out of the index by `noindex`, NOT by Disallow.
 *
 * Disallowing them was actively counterproductive: /paper-trading 307s to
 * /login?next=…, and with /login blocked Google could never fetch the redirect target,
 * so it never saw the `noindex` that shouldNoindexPath() already emits there. It kept the
 * URL it had discovered from the homepage nav and rendered it as a bare result reading
 * "No information is available for this page."
 *
 * A URL must be crawlable for its noindex to be honoured. Every path listed in
 * shouldNoindexPath() (metadata.ts) already returns `noindex, follow`, and each private
 * route is separately gated by middleware, so allowing the crawl exposes nothing.
 *
 * /api/ stays blocked: those return JSON with no meta tag to read, and nothing links to them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/']
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`
  };
}
