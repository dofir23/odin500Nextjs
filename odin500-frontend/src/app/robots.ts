import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/seo/siteConfig.js';

/** Block private/auth surfaces; keep market + public portfolio URLs crawlable. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/login',
        '/signup',
        '/auth/callback',
        '/profile',
        '/accounts',
        '/forgot-password',
        '/admin'
      ]
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`
  };
}
