import { SITE_ORIGIN } from './siteConfig.js';

/** Core marketing / app routes included in sitemap.xml */
export const SITEMAP_STATIC_PATHS = [
  '/',
  '/market',
  '/odin-signals',
  '/news',
  '/heatmap',
  '/market-movers',
  '/stock-splits',
  '/statistic-data',
  '/return-table',
  '/premium',
  '/about',
  '/accounts',
  '/paper-trading',
  '/forgot-password',
  '/newsletter'
];

export const SITEMAP_INDEX_SLUGS = ['sp500', 'dow-jones', 'nasdaq-100'];

/** SPDR sector ETF route slugs (lowercase). */
export const SITEMAP_SECTOR_SLUGS = [
  'xlb',
  'xlk',
  'xlf',
  'xlv',
  'xli',
  'xle',
  'xly',
  'xlp',
  'xlu',
  'xlre',
  'xlc'
];

export const SITEMAP_STAT_KINDS = ['ticker-annual', 'ticker-quarterly', 'ticker-monthly', 'ticker-weekly', 'ticker-daily'];

/**
 * High-priority symbols for sitemap when the API is unavailable at build time.
 * Override or extend via SITEMAP_TICKERS env (comma-separated) in generate-sitemap.mjs.
 */
export const SITEMAP_FALLBACK_TICKERS = [
  'AAPL',
  'MSFT',
  'NVDA',
  'AMZN',
  'GOOGL',
  'GOOG',
  'META',
  'TSLA',
  'BRK.B',
  'JPM',
  'V',
  'UNH',
  'XOM',
  'LLY',
  'AVGO',
  'JNJ',
  'PG',
  'MA',
  'HD',
  'COST',
  'SPY',
  'QQQ',
  'IWM',
  'AMD',
  'NFLX',
  'CRM',
  'ORCL',
  'BAC',
  'WMT',
  'DIS'
];

/** Routes that receive static HTML shells with baked-in title/description at build time. */
export const PRERENDER_STATIC_PATHS = [
  '/',
  '/market',
  '/odin-signals',
  '/news',
  '/heatmap',
  '/market-movers',
  '/statistic-data',
  '/return-table',
  '/historical-data/aapl',
  '/about',
  '/premium',
  '/newsletter',
  '/indices/sp500',
  '/indices/dow-jones',
  '/indices/nasdaq-100',
  '/ticker/aapl'
];

/**
 * @param {string} path
 * @returns {string}
 */
export function absoluteSiteUrl(path) {
  const p = path && path.startsWith('/') ? path : `/${String(path || '')}`;
  if (p === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${p}`;
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
export function uniquePaths(paths) {
  const seen = new Set();
  const out = [];
  for (const raw of paths) {
    const p = raw.startsWith('/') ? raw : `/${raw}`;
    const key = p.replace(/\/+$/, '') || '/';
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key === '' ? '/' : key);
  }
  return out;
}

/**
 * @param {string[]} tickers Uppercase symbols.
 * @returns {string[]}
 */
export function buildDynamicSitemapPaths(tickers) {
  const syms = [...new Set(tickers.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  const paths = [...SITEMAP_STATIC_PATHS];

  for (const slug of SITEMAP_INDEX_SLUGS) {
    paths.push(`/indices/${slug}`);
  }
  for (const slug of SITEMAP_SECTOR_SLUGS) {
    paths.push(`/sector-data/${slug}`);
  }
  for (const sym of syms) {
    const enc = encodeURIComponent(sym.toLowerCase());
    paths.push(`/ticker/${enc}`);
    paths.push(`/historical-data/${enc}`);
    paths.push(`/ticker-report/${enc}`);
    paths.push(`/relative-performance/ticker/${enc}`);
    for (const kind of SITEMAP_STAT_KINDS) {
      paths.push(`/statistic/${kind}/${enc}`);
    }
  }

  return uniquePaths(paths);
}
