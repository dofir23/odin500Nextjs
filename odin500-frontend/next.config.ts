import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveApiOrigin } from './src/lib/resolveApiOrigin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_ORIGIN = resolveApiOrigin();

/**
 * Bots that must get a *blocking* render so metadata lands inside <head>.
 *
 * Next.js 15.2+ streams metadata by default: for any UA not matched here, <title>/description/
 * canonical/og:* are emitted late in the body and rely on the client hoisting them into <head>.
 * Next's built-in list covers social unfurlers and Bing/DDG but NOT the SEO audit crawlers, so
 * SEMrush/Ahrefs/Screaming Frog were reading pages as having no metadata at all — and on
 * /ticker/* they picked up an SVG chart tooltip as the page title.
 *
 * Googlebot is deliberately excluded by Next (it executes JS and hoists metadata itself); it is
 * listed here anyway so the raw HTML is correct on the first pass rather than after render.
 *
 * NOTE: this REPLACES Next's default regex rather than extending it, so the default pattern is
 * inlined below. Keep in sync when upgrading Next
 * (source: next/dist/shared/lib/router/utils/html-bots.js).
 */
const NEXT_DEFAULT_HTML_LIMITED_BOTS =
  '[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight';

const SEO_CRAWLER_BOTS = [
  'Googlebot',
  'SemrushBot',
  'AhrefsBot',
  'AhrefsSiteAudit',
  'Screaming Frog',
  'rogerbot',
  'dotbot',
  'MJ12bot',
  'PetalBot',
  'DataForSeoBot',
  'SiteAuditBot',
  'Barkrowler',
  'SerpstatBot',
  'ZoominfoBot',
  'Sitebulb',
  'seokicks',
  'BLEXBot',
  'Neevabot',
  'CCBot',
  'GPTBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'Applebot-Extended'
].join('|');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  outputFileTracingRoot: path.join(__dirname),
  htmlLimitedBots: new RegExp(`${NEXT_DEFAULT_HTML_LIMITED_BOTS}|${SEO_CRAWLER_BOTS}`, 'i'),
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180
    }
  },
  async headers() {
    return [
      {
        // robots.txt deliberately blocks nothing (see src/app/robots.ts) so Googlebot's renderer
        // can fetch the data each page needs. These JSON endpoints are still never index
        // candidates — noindex says so in the one way a crawler can actually read.
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }]
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path((?!auth|proxy|social).*)',
        destination: `${API_ORIGIN.replace(/\/$/, '')}/api/:path`
      }
    ];
  },
  async redirects() {
    return [
      /**
       * `/paper-trading/*` was renamed to `/virtual-portfolio/*` (552add2, 2026-08-18).
       *
       * `/paper-trading/public` and `/paper-trading/ai` shipped in SITEMAP_STATIC_PATHS right up
       * to that commit, so Google holds them indexed; without these they answer 404 and the
       * ranking they earned is discarded rather than passed to the pages that replaced them.
       * The wildcard also covers `/paper-trading/public/<accountId>` detail pages, which were
       * only ever discovered through links.
       */
      { source: '/paper-trading', destination: '/virtual-portfolio', permanent: true },
      {
        source: '/paper-trading/:path*',
        destination: '/virtual-portfolio/:path*',
        permanent: true
      },
      { source: '/tickers', destination: '/odin-signals', permanent: true },
      { source: '/ticker', destination: '/ticker/aapl', permanent: true },
      { source: '/indices', destination: '/indices/sp500', permanent: false },
      { source: '/sector-data', destination: '/sector-data/xlk', permanent: false },
      { source: '/ticker-annual', destination: '/statistic/ticker-annual/aapl', permanent: true },
      {
        source: '/ticker-annual/:symbol',
        destination: '/statistic/ticker-annual/:symbol',
        permanent: true
      },
      {
        source: '/ticker-quarterly',
        destination: '/statistic/ticker-quarterly/aapl',
        permanent: true
      },
      {
        source: '/ticker-quarterly/:symbol',
        destination: '/statistic/ticker-quarterly/:symbol',
        permanent: true
      },
      {
        source: '/ticker-monthly',
        destination: '/statistic/ticker-monthly/aapl',
        permanent: true
      },
      {
        source: '/ticker-monthly/:symbol',
        destination: '/statistic/ticker-monthly/:symbol',
        permanent: true
      },
      {
        source: '/ticker-weekly',
        destination: '/statistic/ticker-weekly/aapl',
        permanent: true
      },
      {
        source: '/ticker-weekly/:symbol',
        destination: '/statistic/ticker-weekly/:symbol',
        permanent: true
      },
      {
        source: '/ticker-daily',
        destination: '/statistic/ticker-daily/aapl',
        permanent: true
      },
      {
        source: '/ticker-daily/:symbol',
        destination: '/statistic/ticker-daily/:symbol',
        permanent: true
      },
      {
        source: '/statistic/ticker-annual',
        destination: '/statistic/ticker-annual/aapl',
        permanent: true
      },
      {
        source: '/statistic/ticker-quarterly',
        destination: '/statistic/ticker-quarterly/aapl',
        permanent: true
      },
      {
        source: '/statistic/ticker-monthly',
        destination: '/statistic/ticker-monthly/aapl',
        permanent: true
      },
      {
        source: '/statistic/ticker-weekly',
        destination: '/statistic/ticker-weekly/aapl',
        permanent: true
      },
      {
        source: '/statistic/ticker-daily',
        destination: '/statistic/ticker-daily/aapl',
        permanent: true
      },
      {
        source: '/relative-strength/ticker',
        destination: '/relative-performance/ticker/aapl',
        permanent: true
      },
      {
        source: '/relative-strength/ticker/:symbol',
        destination: '/relative-performance/ticker/:symbol',
        permanent: true
      },
      {
        source: '/historical-data',
        destination: '/historical-data/aapl',
        permanent: true
      },
      {
        source: '/ticker-report',
        destination: '/ticker-report/aapl',
        permanent: true
      },
      { source: '/pricing', destination: '/premium', permanent: true }
    ];
  }
};

export default nextConfig;
