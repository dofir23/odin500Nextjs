import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/seo/siteConfig.js';

/** Only auth entry pages and OAuth callback are blocked from crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/login', '/signup', '/auth/callback', '/profile']
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`
  };
}
