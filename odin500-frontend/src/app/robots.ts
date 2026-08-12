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
 * The same reasoning is why NOTHING is disallowed here, /api/ included. apiUrl()
 * (utils/apiOrigin.js) routes every browser-side call through same-origin /api/proxy/*, and
 * /api/auth/session is fetched on every page load, so a Disallow on /api/ stopped Googlebot's
 * renderer from fetching each page's own data: Search Console rendered pages carrying a visible
 * "Request failed (499)" banner and listed every XHR as "blocked by robots.txt", while the same
 * pages loaded fine in a browser.
 *
 * Keeping JSON out of the index is the job of the `X-Robots-Tag: noindex` header that
 * next.config.ts applies to /api/:path* — a header Google can only read if it may fetch the URL.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/'
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`
  };
}
