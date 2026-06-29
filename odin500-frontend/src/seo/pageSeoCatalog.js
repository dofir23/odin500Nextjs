import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_TITLE } from './siteConfig.js';

/**
 * Static SEO copy for prerender shells and documentation.
 * Dynamic pages (ticker, index) set titles in their components via usePageSeo.
 * @type {Record<string, { title: string, description: string }>}
 */
export const PAGE_SEO_CATALOG = {
  '/': {
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION
  },
  '/market': {
    title: 'Stock Market Dashboard, Heatmap & Trading Signals | Odin500',
    description:
      'Live U.S. stock market dashboard with sector heatmap, index snapshots, OHLC analytics, and trading signals for active traders.'
  },
  '/odin-signals': {
    title: 'Stock Signal Screener Treemap | Trading Signals | Odin500',
    description:
      'Explore stock trading signals with an interactive treemap and filters to find bullish and bearish setups across U.S. equities.'
  },
  '/news': {
    title: 'Stock Market News by Ticker | Odin500',
    description:
      'Read market news and ticker-specific headlines for U.S. stocks and ETFs with quick symbol-level context for traders.'
  },
  '/heatmap': {
    title: 'Stock Heatmap | Sector & Industry Performance | Odin500',
    description:
      'Interactive stock heatmap of U.S. equities by sector and industry with price change, market cap weighting, and drill-down ticker lists.'
  },
  '/market-movers': {
    title: 'Top Gainers and Losers Today | Market Movers | Odin500',
    description:
      'Track top gaining and losing stocks today with sortable market-movers tables and performance charts for U.S. equities.'
  },
  '/stock-splits': {
    title: 'Stock Split Tracker | Corporate Actions | Odin500',
    description:
      'Track recent U.S. stock splits and reverse splits with execution dates, ratios, and links to affected tickers.'
  },
  '/statistic-data': {
    title: 'Stock Statistics Tables | Returns & OHLC Analytics | Odin500',
    description:
      'Download stock statistics and returns across daily, weekly, monthly, quarterly, and annual horizons with OHLC-based analytics.'
  },
  '/return-table': {
    title: 'Stock, Index & ETF Return Table | Period Performance | Odin500',
    description:
      'Compare multi-period returns for U.S. stocks, indices, sectors, and ETFs across 1D to long-term horizons in one return table.'
  },
  '/historical-data': {
    title: 'OHLC Historical Data Download for Stocks | Odin500',
    description:
      'Search ticker historical data and export OHLC price history for U.S. stocks and ETFs, including open, high, low, close, and date.'
  },
  '/historical-data/aapl': {
    title: 'AAPL Historical OHLC Data & CSV Export | Odin500',
    description:
      'Query and export historical OHLC data for AAPL: daily, weekly, monthly, quarterly, and annual price history with CSV download.'
  },
  '/about': {
    title: 'Your Odin500 Profile & Account Settings',
    description: 'Manage your Odin500 account profile, plan, email, and security settings.'
  },
  '/premium': {
    title: 'Odin500 Premium Plans | Pro Quant Signals & Market Data',
    description:
      'Compare Odin500 Basic, Premium, and Pro plans for index signals, ETF coverage, and full Odin trading signal access.'
  },
  '/relative-performance/ticker/aapl': {
    title: 'Ticker Relative Performance vs Index | Odin500',
    description:
      'Compare ticker performance versus indices and sectors with excess return charts and period-by-period relative strength tables.'
  },
  '/indices/sp500': {
    title: 'S&P 500 Index Data, Returns & Signals | Odin500',
    description:
      'Analyze S&P 500 index returns, signals, historical data, and constituent-level context for U.S. market research.'
  },
  '/indices/dow-jones': {
    title: 'Dow Jones Index Data, Returns & Signals | Odin500',
    description:
      'Track Dow Jones index returns, OHLC trends, and signal context with chart-ready analytics for traders and investors.'
  },
  '/indices/nasdaq-100': {
    title: 'Nasdaq 100 Index Data, Returns & Signals | Odin500',
    description:
      'View Nasdaq 100 returns, trend signals, and historical index analytics with constituent-aware market context.'
  },
  '/ticker/aapl': {
    title: 'AAPL Historical Data, OHLC Chart & Trading Signals | Odin500',
    description:
      'Apple (AAPL) ticker historical data, OHLC chart analytics, returns, and trading signals for short-term and long-term analysis.'
  }
};

/**
 * @param {string} path
 * @returns {{ title: string, description: string }}
 */
export function seoForPath(path) {
  const key = path.replace(/\/+$/, '') || '/';
  return (
    PAGE_SEO_CATALOG[key] || {
      title: DEFAULT_SITE_TITLE,
      description: DEFAULT_SITE_DESCRIPTION
    }
  );
}
