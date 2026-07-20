/** Canonical public site origin — always use www for sitemap, canonical, and OG URLs. */
export const SITE_ORIGIN = 'https://www.odin500.com';

export const SITE_NAME = 'Odin500';

export const SEO_BRAND_NAME = 'Odin500 Trading Data';

/** Keyword-first default title (no brand prefix — matches generic Google queries). */
export const DEFAULT_SITE_TITLE =
  'Stock Market Data, OHLC Historical Prices, Charts & Trading Signals';

export const DEFAULT_SITE_DESCRIPTION =
  'Free stock market dashboard with OHLC historical data, charts, heatmaps, trading signals, and AI portfolio tracking for U.S. stocks and ETFs.';

/** Default Open Graph / Twitter share image (absolute URL). */
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-default.png`;

/** Google Analytics 4 measurement ID (override via NEXT_PUBLIC_GA_MEASUREMENT_ID). */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-08S7EJ6FTT';

/** Google Search Console HTML tag verification (NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION). */
export const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '';
