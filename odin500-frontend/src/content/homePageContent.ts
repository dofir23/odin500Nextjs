/** Marketing homepage copy — server-rendered for SEO and AI crawlers. */

export const HOME_HERO = {
  eyebrow: 'U.S. equity market intelligence',
  title: 'A modern market data platform for investors and researchers.',
  subtitle:
    'Research stocks and ETFs, analyze index and sector performance, screen Odin trading signals, and practice strategies — all in one place.',
  primaryCta: { href: '/signup', label: 'Sign up for free' },
  secondaryCta: { href: '/market', label: 'Explore market dashboard' },
  tertiaryCta: { href: '/paper-trading/public', label: 'Public Portfolios' }
};

export const HOME_PILLARS = [
  {
    title: 'See more in less time',
    body:
      'A customizable market dashboard puts U.S. indices, sectors, heatmaps, and normalized performance charts in one view. Track Dow Jones, S&P 500, Nasdaq-100, and major ETFs with daily OHLC-based analytics.'
  },
  {
    title: 'Simplify your workflow',
    body:
      'From ticker pages and historical OHLC downloads to return tables, statistics, and news — Odin500 combines the datasets active investors need without jumping between disconnected tools.'
  },
  {
    title: 'Built for systematic research',
    body:
      'Odin Signals, relative-strength views, and multi-timeframe return analytics help you move from raw prices to actionable context — whether you trade actively or research allocation ideas.'
  }
];

export const HOME_USE_CASES = [
  {
    title: 'Active traders & swing traders',
    body:
      'Monitor market movers, sector heatmaps, and daily Odin trading signals. Drill into any ticker for OHLC charts, signal history, drawdown analytics, and relative performance vs. benchmarks.',
    href: '/odin-signals',
    linkLabel: 'Open signals screener'
  },
  {
    title: 'Research & portfolio analysis',
    body:
      'Compare index and sector ETF returns across 1-day to multi-year horizons. Use return tables, statistic data exports, and ticker reports to stress-test ideas before committing capital.',
    href: '/return-table',
    linkLabel: 'View return tables'
  },
  {
    title: 'Practice without risk',
    body:
      'Virtual portfolio simulates fills at Odin daily closes with realistic slippage. Run manual orders or automated strategy rules, track P&L, sector exposure, and closed-trade analytics.',
    href: '/paper-trading',
    linkLabel: 'Try virtual portfolio'
  }
];

export type HomeDataCoverageItem = {
  id: string;
  title: string;
  summary: string;
  href: string;
};

export const HOME_DATA_COVERAGE: HomeDataCoverageItem[] = [
  {
    id: 'stocks',
    title: 'U.S. stocks',
    summary:
      'Ticker pages with OHLC price history, annual through daily returns, trading signals, news, and downloadable historical data for individual equities.',
    href: '/ticker/aapl'
  },
  {
    id: 'etfs',
    title: 'ETFs & index proxies',
    summary:
      'SPY, QQQ, sector SPDRs, and index constituents with performance charts, return analytics, and signal coverage on major benchmarks.',
    href: '/indices/sp500'
  },
  {
    id: 'indices',
    title: 'Major indices',
    summary:
      'S&P 500, Dow Jones Industrial Average, and Nasdaq-100 index hubs with constituent tables, movers, heatmaps, and normalized performance views.',
    href: '/indices/dow-jones'
  },
  {
    id: 'sectors',
    title: 'Sectors & industries',
    summary:
      'Eleven GICS sector ETFs (XLK, XLF, XLV, and more) with sector return charts, constituent lists, and cross-sector comparison tools.',
    href: '/sector-data/xlk'
  },
  {
    id: 'ohlc',
    title: 'OHLC historical data',
    summary:
      'Daily open-high-low-close history with export-friendly tables for backtesting, charting, and quantitative research workflows.',
    href: '/historical-data/aapl'
  },
  {
    id: 'signals',
    title: 'Odin trading signals',
    summary:
      'Daily bullish and bearish signal screeners with treemap visualization, filters by index and sector, and historical signal performance context.',
    href: '/odin-signals'
  },
  {
    id: 'heatmap',
    title: 'Market heatmaps',
    summary:
      'Interactive treemap of sector and industry performance with price change, market-cap weighting, and quick navigation to constituent tickers.',
    href: '/heatmap'
  },
  {
    id: 'movers',
    title: 'Market movers',
    summary:
      "Today's top gainers and losers with sortable tables, performance snapshots, and volume context across major U.S. indices.",
    href: '/market-movers'
  },
  {
    id: 'statistics',
    title: 'Return statistics',
    summary:
      'Daily, weekly, monthly, quarterly, and annual return tables with OHLC-derived analytics and bulk statistics views.',
    href: '/statistic-data'
  },
  {
    id: 'news',
    title: 'Market news',
    summary:
      'Headlines searchable by ticker, index, and sector to connect price action with the stories moving U.S. equities.',
    href: '/news'
  },
  {
    id: 'splits',
    title: 'Stock splits',
    summary:
      'Upcoming and historical stock split calendar with ratios and affected tickers for corporate-action research.',
    href: '/stock-splits'
  },
  {
    id: 'paper',
    title: 'Virtual portfolio',
    summary:
      'Virtual portfolios with $100,000 starting capital, order blotter, strategy automation, and performance charts.',
    href: '/paper-trading'
  }
];

export const HOME_MISSION = {
  title: 'Our mission',
  body:
    'To equip every investor — from first-time market participants to experienced researchers — with transparent U.S. equity data, systematic signals, and practical tools to make more informed decisions.'
};

export const HOME_FEATURES = [
  {
    title: 'Market dashboard',
    body:
      'Watchlist-style index rails, normalized multi-series performance charts, and quick links into indices, sectors, and tickers from a single hub.',
    href: '/market'
  },
  {
    title: 'Advanced charting',
    body:
      'Lightweight interactive charts on ticker and index pages with timeframe controls, benchmark overlays, and export-friendly snapshots.',
    href: '/ticker/spy'
  },
  {
    title: 'Odin Signals screener',
    body:
      'Filter the investable universe by signal direction, index membership, and sector — with visual treemap and tabular views.',
    href: '/odin-signals'
  },
  {
    title: 'Return & statistic tables',
    body:
      'Sortable performance grids across horizons plus per-ticker annual, quarterly, monthly, weekly, and daily statistic routes.',
    href: '/return-table'
  },
  {
    title: 'Ticker research reports',
    body:
      'Dedicated report pages with price history, drawdown charts, relative strength vs. SPY, and narrative SEO summaries per symbol.',
    href: '/ticker-report/aapl'
  },
  {
    title: 'Virtual portfolio simulator',
    body:
      'Place market orders, manage positions, automate strategy rules, and compare portfolio performance to benchmarks.',
    href: '/paper-trading'
  }
];

export const HOME_PRICING_TEASER = {
  title: 'Plans for every stage',
  body:
    'Start free with market insights and basic signals. Upgrade to Premium, Pro, or Ultimate for broader index signal coverage, ETF signals, and full Odin Trading Signals access.',
  href: '/premium',
  cta: 'Compare plans'
};

export const HOME_FOOTER_CTA = {
  title: 'Great research starts with great data.',
  body: 'Join investors using Odin500 for U.S. stock charts, heatmaps, signals, and historical OHLC analytics.',
  href: '/signup',
  cta: 'Sign up for free'
};

export const HOME_NAV_PRODUCT = [
  { href: '/market', label: 'Market dashboard' },
  { href: '/heatmap', label: 'Heatmaps' },
  { href: '/odin-signals', label: 'Odin Signals' },
  { href: '/paper-trading', label: 'Virtual portfolio' },
  { href: '/premium', label: 'Pricing' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/about', label: 'About' }
];

export const HOME_NAV_EXPLORE = [
  { href: '/indices/sp500', label: 'S&P 500' },
  { href: '/indices/nasdaq-100', label: 'Nasdaq-100' },
  { href: '/sector-data/xlf', label: 'Sectors' },
  { href: '/market-movers', label: 'Market movers' },
  { href: '/news', label: 'News' }
];

/**
 * Homepage marketing screenshots (theme-specific).
 *
 * Dark mode — `public/home/<filename>.png` (your current screenshots)
 * Light mode — `public/home/light/<filename>.png` (same filenames)
 *
 * Example: dark `public/home/ticker-preview.png` → light `public/home/light/ticker-preview.png`
 */
export type HomeImageSet = {
  dark: string;
  light: string;
};

const HOME_LIGHT_DIR = '/home/light';

function homeScreenshot(filename: string): HomeImageSet {
  return {
    dark: `/home/${filename}`,
    light: `${HOME_LIGHT_DIR}/${filename}`
  };
}

export const HOME_IMAGES = {
  hero: {
    dark: '/og-default.png',
    light: `${HOME_LIGHT_DIR}/hero-preview.png`
  },
  dashboard: homeScreenshot('dashboard-preview.png'),
  signals: homeScreenshot('signals-preview.png'),
  ticker: homeScreenshot('ticker-preview.png'),
  heatmap: homeScreenshot('heatmap-preview.png'),
  relativePerformance: homeScreenshot('relative-performance-preview.png'),
  monthlyReport: homeScreenshot('monthly-report-preview.png'),
  marketMovers: homeScreenshot('market-movers-preview.png'),
  returnTable: homeScreenshot('return-table-preview.png'),
  tickerReport: homeScreenshot('ticker-report-preview.png'),
  historicalData: homeScreenshot('historical-data-preview.png'),
  paperTrading: homeScreenshot('paper-trading-preview.png'),
  publicPortfolio: {
    dark: '/home/publicportfolio.png',
    light: `${HOME_LIGHT_DIR}/public_portfolio.png`
  },
  indexHub: homeScreenshot('index-preview.png'),
  news: homeScreenshot('news-preview.png'),
  statisticData: homeScreenshot('statistic-data-preview.png')
} as const satisfies Record<string, HomeImageSet>;

export type HomeImageKey = keyof typeof HOME_IMAGES;

export function getHomeImageSrc(key: HomeImageKey, theme: 'dark' | 'light') {
  return HOME_IMAGES[key][theme];
}

export type HomeShowcaseItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  imageKey: HomeImageKey;
  imageAlt: string;
};

/** Alternating image + copy rows — image flips left/right by index. */
export const HOME_SHOWCASE: HomeShowcaseItem[] = [
  {
    id: 'dashboard',
    title: 'Market dashboard at a glance',
    description:
      'Index rails, normalized performance charts, and heatmap thumbnails — the same workspace active users open from the Markets tab every day.',
    href: '/market',
    linkLabel: 'Open market dashboard',
    imageKey: 'dashboard',
    imageAlt: 'Odin500 market dashboard with index performance chart and watchlist rails'
  },
  {
    id: 'public-portfolio',
    title: 'Public Portfolios',
    description:
      'Browse virtual portfolios published by Odin500 users. View-only snapshots of holdings, portfolio value, and total return — then open any strategy for a closer look.',
    href: '/paper-trading/public',
    linkLabel: 'Browse public portfolios',
    imageKey: 'publicPortfolio',
    imageAlt: 'Odin500 public portfolios list with values, returns, and published dates'
  },
  {
    id: 'signals',
    title: 'Odin Signals screener',
    description:
      'Screen bullish and bearish setups across U.S. indices and sectors with treemap and tabular views tied to daily OHLC analytics.',
    href: '/odin-signals',
    linkLabel: 'Browse trading signals',
    imageKey: 'signals',
    imageAlt: 'Odin500 trading signals screener with treemap and filters'
  },
  {
    id: 'ticker',
    title: 'Ticker research hub',
    description:
      'Every symbol gets a dedicated page with interactive OHLC charts, Odin signal history, company overview, return summaries, and links into deeper analytics.',
    href: '/ticker/aapl',
    linkLabel: 'View sample ticker (AAPL)',
    imageKey: 'ticker',
    imageAlt: 'Odin500 ticker page with price chart and trading signals for a U.S. stock'
  },
  {
    id: 'heatmap',
    title: 'Sector & industry heatmap',
    description:
      'Visualize market breadth with a treemap of sectors and industries — sized by market cap, colored by performance, and clickable through to constituents.',
    href: '/heatmap',
    linkLabel: 'Open market heatmap',
    imageKey: 'heatmap',
    imageAlt: 'Odin500 sector heatmap treemap showing industry performance'
  },
  {
    id: 'relative-performance',
    title: 'Relative performance vs. benchmarks',
    description:
      'Compare any ticker against SPY or custom peers on rebased charts — ideal for evaluating alpha, rotation ideas, and factor tilts over multiple timeframes.',
    href: '/relative-performance/ticker/aapl',
    linkLabel: 'Compare relative performance',
    imageKey: 'relativePerformance',
    imageAlt: 'Odin500 relative performance chart comparing a stock to benchmark ETFs'
  },
  {
    id: 'monthly-report',
    title: 'Monthly statistics & reports',
    description:
      'Monthly return tables, rolling performance metrics, and downloadable OHLC-derived statistics for single names — plus annual, quarterly, weekly, and daily views.',
    href: '/statistic/ticker-monthly/aapl',
    linkLabel: 'Open monthly statistics',
    imageKey: 'monthlyReport',
    imageAlt: 'Odin500 monthly return statistics and report tables for a ticker'
  },
  {
    id: 'market-movers',
    title: 'Top gainers & losers today',
    description:
      "Sort today's biggest market movers across major indices with performance snapshots, volume context, and quick navigation into ticker pages.",
    href: '/market-movers',
    linkLabel: 'See market movers',
    imageKey: 'marketMovers',
    imageAlt: 'Odin500 market movers table with top gainers and losers'
  },
  
  
  {
    id: 'index-hub',
    title: 'Major index hubs',
    description:
      'S&P 500, Dow Jones, and Nasdaq-100 pages bundle constituent tables, normalized charts, movers, and heatmap context for each benchmark.',
    href: '/indices/sp500',
    linkLabel: 'Explore S&P 500 hub',
    imageKey: 'indexHub',
    imageAlt: 'Odin500 S&P 500 index hub with constituents and performance chart'
  },
  {
    id: 'paper-trading',
    title: 'Virtual portfolio simulator',
    description:
      'Practice with virtual capital, realistic daily-close fills, order blotters, strategy automation, and portfolio performance charts — no real money at risk.',
    href: '/paper-trading',
    linkLabel: 'Try virtual portfolio',
    imageKey: 'paperTrading',
    imageAlt: 'Odin500 virtual portfolio chart and order ticket'
  },
  {
    id: 'news',
    title: 'Market news by ticker',
    description:
      'Headlines searchable by symbol, index, and sector so you can connect price action on your charts with the stories moving U.S. equities.',
    href: '/news',
    linkLabel: 'Read market news',
    imageKey: 'news',
    imageAlt: 'Odin500 market news feed filtered by ticker and index'
  }
];

export const HOME_SHOWCASE_INTRO = {
  title: 'Explore the platform',
  lead: 'Walk through Odin500’s core pages — market dashboards, ticker analytics, heatmaps, signals, reports, and more — each built on daily U.S. equity OHLC data.'
};

/** Unique in-app routes linked from the homepage — used to warm chunks before navigation. */
export function getHomePagePrefetchRoutes(): string[] {
  const hrefs = new Set<string>();

  const add = (href: string | undefined) => {
    if (!href || !href.startsWith('/')) return;
    hrefs.add(href.split('?')[0].split('#')[0]);
  };

  add(HOME_HERO.primaryCta.href);
  add(HOME_HERO.secondaryCta.href);
  add(HOME_HERO.tertiaryCta.href);
  add(HOME_PRICING_TEASER.href);
  add(HOME_FOOTER_CTA.href);

  for (const item of HOME_NAV_PRODUCT) add(item.href);
  for (const item of HOME_NAV_EXPLORE) add(item.href);
  for (const item of HOME_USE_CASES) add(item.href);
  for (const item of HOME_DATA_COVERAGE) add(item.href);
  for (const item of HOME_FEATURES) add(item.href);
  for (const item of HOME_SHOWCASE) add(item.href);

  add('/login');
  add('/about');
  add('/profile');

  const priority = ['/market', '/signup', '/login'];
  const rest = [...hrefs].filter((h) => !priority.includes(h)).sort();
  return [...priority.filter((h) => hrefs.has(h)), ...rest];
}
