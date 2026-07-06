import type { Metadata } from 'next';
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
  GOOGLE_SITE_VERIFICATION,
  SITE_ORIGIN
} from '@/seo/siteConfig.js';
import { defaultOgImages } from '@/seo/ogImages';
import { absoluteSiteUrl } from '@/seo/sitemapRoutes.js';
import { formatReturnPct, pickDynamicReturn } from '@/seo/performanceSnippet';

export const ROUTE_METADATA: Record<
  string,
  { title: string; description: string; canonical?: string }
> = {
  '/': {
    title: 'Odin500 – U.S. Stock Market Data, Charts, Signals & Virtual Portfolio',
    description:
      'Free U.S. stock market platform with live dashboards, sector heatmaps, OHLC historical data, index and ETF analytics, Odin trading signals, news, return tables, and virtual portfolio trading.',
    canonical: `${SITE_ORIGIN}/`
  },
  '/market': {
    title: 'Stock Market Dashboard – Live Charts, Heatmap & Trading Signals',
    description:
      'Live U.S. stock market dashboard with sector heatmap, S&P 500 and index snapshots, OHLC price charts, and daily trading signals for stocks and ETFs.',
    canonical: `${SITE_ORIGIN}/market`
  },
  '/odin-signals': {
    title: 'Stock Trading Signals Screener – Bullish & Bearish Stock Picks',
    description:
      'Screen U.S. stocks with live trading signals, bullish and bearish setups, treemap view, and filters by index, sector, and performance.',
    canonical: `${SITE_ORIGIN}/odin-signals`
  },
  '/news': {
    title: 'Stock Market News Today – Headlines by Ticker & Index',
    description:
      'Latest stock market news and company headlines for U.S. stocks and ETFs, searchable by ticker symbol, index, and sector.',
    canonical: `${SITE_ORIGIN}/news`
  },
  '/heatmap': {
    title: 'Stock Market Heatmap – Sector & Industry Performance Today',
    description:
      'Interactive stock heatmap showing sector and industry performance, price change, market cap, and top movers in the U.S. equity market.',
    canonical: `${SITE_ORIGIN}/heatmap`
  },
  '/market-movers': {
    title: 'Top Stock Gainers and Losers Today – Market Movers',
    description:
      'Today’s biggest stock gainers and losers with sortable tables, performance charts, and volume data for U.S. equities by index.',
    canonical: `${SITE_ORIGIN}/market-movers`
  },
  '/statistic-data': {
    title: 'Stock Statistics & Returns Table – Daily, Weekly, Monthly OHLC',
    description:
      'Stock statistics and historical returns across daily, weekly, monthly, quarterly, and annual periods with OHLC-based analytics and download.',
    canonical: `${SITE_ORIGIN}/statistic-data`
  },
  '/return-table': {
    title: 'Stock & Index Returns Table – S&P 500, Sector & ETF Performance',
    description:
      'Compare stock, index, and sector ETF returns across 1 day to multi-year horizons with sortable performance tables for U.S. markets.',
    canonical: `${SITE_ORIGIN}/return-table`
  },
  '/stock-splits': {
    title: 'Stock Split Calendar – Upcoming & Historical Split History',
    description:
      'Stock split calendar with upcoming and historical split dates, ratios, and affected tickers for U.S. equities.',
    canonical: `${SITE_ORIGIN}/stock-splits`
  },
  '/about': {
    title: 'Account Profile & Settings – Stock Market Platform',
    description:
      'Manage your account profile, subscription plan, email preferences, and security settings for the stock data platform.',
    canonical: `${SITE_ORIGIN}/about`
  },
  '/premium': {
    title: 'Odin500 Pricing – Free Plan & Pro ($10/month) Full Access',
    description:
      'Simple pricing: start free with market dashboards and basic signals, or get full Odin500 Pro for $10/month — all index, ETF, and trading signals plus analytics.',
    canonical: `${SITE_ORIGIN}/premium`
  },
  '/newsletter': {
    title: 'Odin500 Weekly Newsletter – U.S. Market Recap & Signal Highlights',
    description:
      'Weekly U.S. stock market newsletter with index performance, sector rotation, Odin signal spotlights, and ticker report highlights from Odin500 data.',
    canonical: `${SITE_ORIGIN}/newsletter`
  },
  '/accounts': {
    title: 'Account Management – Billing & Security Settings',
    description:
      'View and manage account details, billing preferences, and linked authentication settings in one place.',
    canonical: `${SITE_ORIGIN}/accounts`
  },
  '/paper-trading': {
    title: 'Your Virtual Portfolio – Simulate Stock Trading Free',
    description:
      'Practice stock trading with virtual portfolios, simulated strategies, and performance analytics without risking real money.',
    canonical: `${SITE_ORIGIN}/paper-trading`
  },
  '/paper-trading/public': {
    title: 'Public Virtual Portfolios – Community Trading Strategies',
    description:
      'Browse published virtual portfolios from Odin500 users. View holdings, performance, and trade history in read-only mode.',
    canonical: `${SITE_ORIGIN}/paper-trading/public`
  },
  '/login': {
    title: 'Sign In – Stock Market Data & Charts',
    description: 'Sign in to access stock charts, market signals, watchlists, and historical OHLC data.',
    canonical: `${SITE_ORIGIN}/login`
  },
  '/signup': {
    title: 'Create Free Account – Stock Charts & Market Data',
    description:
      'Create a free account to access U.S. stock signals, market heatmaps, historical OHLC data, and ticker analytics.',
    canonical: `${SITE_ORIGIN}/signup`
  },
  '/signup/verify-email': {
    title: 'Verify Email – Complete Account Registration',
    description: 'Verify your email address to finish creating your stock market data account.',
    canonical: `${SITE_ORIGIN}/signup/verify-email`
  },
  '/signup/enter-code': {
    title: 'Enter Verification Code – Account Registration',
    description: 'Enter the email verification code to continue account registration.',
    canonical: `${SITE_ORIGIN}/signup/enter-code`
  },
  '/signup/username': {
    title: 'Choose Display Name – Finish Account Setup',
    description: 'Choose a display name to complete your account setup.',
    canonical: `${SITE_ORIGIN}/signup/username`
  },
  '/forgot-password': {
    title: 'Reset Password – Account Recovery',
    description: 'Reset your account password to regain access to stock charts and market data.',
    canonical: `${SITE_ORIGIN}/forgot-password`
  },
  '/auth/callback': {
    title: 'Signing In – Account Authentication',
    description: 'Completing secure sign-in to your stock market data account.',
    canonical: `${SITE_ORIGIN}/auth/callback`
  }
};

const INDEX_SLUG_LABELS: Record<string, string> = {
  sp500: 'S&P 500',
  'dow-jones': 'Dow Jones',
  'nasdaq-100': 'Nasdaq 100'
};

const SECTOR_SLUG_LABELS: Record<string, string> = {
  xlb: 'Materials',
  xlk: 'Technology',
  xlf: 'Financials',
  xlv: 'Healthcare',
  xli: 'Industrials',
  xle: 'Energy',
  xly: 'Consumer Discretionary',
  xlp: 'Consumer Staples',
  xlu: 'Utilities',
  xlre: 'Real Estate',
  xlc: 'Communication Services'
};

const SECTOR_ETF_TICKER: Record<string, string> = {
  xlb: 'XLB',
  xlk: 'XLK',
  xlf: 'XLF',
  xlv: 'XLV',
  xli: 'XLI',
  xle: 'XLE',
  xly: 'XLY',
  xlp: 'XLP',
  xlu: 'XLU',
  xlre: 'XLRE',
  xlc: 'XLC'
};

const STAT_KIND_SEARCH: Record<
  string,
  { title: string; description: (sym: string) => string }
> = {
  'ticker-annual': {
    title: 'Annual Stock Returns',
    description: (sym) =>
      `${sym} annual stock returns with year-by-year performance, historical return tables, and OHLC-based statistics for long-term analysis.`
  },
  'ticker-quarterly': {
    title: 'Quarterly Stock Returns',
    description: (sym) =>
      `${sym} quarterly stock returns with Q1–Q4 history, seasonality patterns, and performance tables for U.S. equity research.`
  },
  'ticker-monthly': {
    title: 'Monthly Stock Returns',
    description: (sym) =>
      `${sym} monthly stock returns with historical performance by month, return charts, and downloadable statistics.`
  },
  'ticker-weekly': {
    title: 'Weekly Stock Returns',
    description: (sym) =>
      `${sym} weekly stock returns with week-by-week price performance and historical return data.`
  },
  'ticker-daily': {
    title: 'Daily Stock Returns',
    description: (sym) =>
      `${sym} daily stock returns with day-by-day price moves, OHLC data, and short-term performance statistics.`
  }
};

/** Only auth entry pages and OAuth callback are excluded from search indexing. */
export function shouldNoindexPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === '/login' || path === '/signup' || path === '/auth/callback';
}

export function normalizePathname(pathname: string) {
  let path = String(pathname || '/').split('?')[0].split('#')[0] || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

export function resolveDynamicRouteMetadata(pathname: string) {
  const path = normalizePathname(pathname);

  const historicalDataMatch = path.match(/^\/historical-data\/([A-Za-z0-9.]+)$/i);
  if (historicalDataMatch) {
    const symbol = decodeURIComponent(historicalDataMatch[1]).toUpperCase();
    return {
      title: `${symbol} Historical Stock Prices – OHLC Data Download & CSV`,
      description: `Download ${symbol} historical stock prices with daily OHLC open, high, low, close, and volume. Export CSV, view charts, and analyze long-term price history.`,
      canonical: `${SITE_ORIGIN}/historical-data/${encodeURIComponent(symbol.toLowerCase())}`
    };
  }

  const tickerReportMatch = path.match(/^\/ticker-report\/([A-Za-z0-9.]+)$/i);
  if (tickerReportMatch) {
    const symbol = decodeURIComponent(tickerReportMatch[1]).toUpperCase();
    return {
      title: `${symbol} Stock Analysis Report – Monthly Returns, Drawdown & Strength`,
      description: `${symbol} stock analysis report with monthly returns, drawdown, relative strength vs the market, seasonality, and key performance statistics.`,
      canonical: `${SITE_ORIGIN}/ticker-report/${encodeURIComponent(symbol.toLowerCase())}`
    };
  }

  const tickerMatch = path.match(/^\/ticker\/([A-Za-z0-9.]+)$/i);
  if (tickerMatch) {
    const symbol = decodeURIComponent(tickerMatch[1]).toUpperCase();
    return {
      title: `${symbol} Stock Price Chart, Historical Data, Returns & Signals`,
      description: `${symbol} stock price chart with live OHLC historical data, annual and quarterly returns, trading signals, and benchmark comparison vs SPY and major indices.`,
      canonical: `${SITE_ORIGIN}/ticker/${encodeURIComponent(symbol.toLowerCase())}`
    };
  }

  const indexMatch = path.match(/^\/indices\/([a-z0-9-]+)$/i);
  if (indexMatch) {
    const slug = decodeURIComponent(indexMatch[1]).toLowerCase();
    const label = INDEX_SLUG_LABELS[slug] || slug.replace(/-/g, ' ');
    return {
      title: `${label} Index Chart, Returns & Historical Stock Market Data`,
      description: `${label} index chart with historical returns, OHLC price data, trading signals, and performance vs U.S. equity benchmarks.`,
      canonical: `${SITE_ORIGIN}/indices/${encodeURIComponent(slug)}`
    };
  }

  const sectorMatch = path.match(/^\/sector-data\/([a-z0-9]+)$/i);
  if (sectorMatch) {
    const slug = decodeURIComponent(sectorMatch[1]).toLowerCase();
    const label = SECTOR_SLUG_LABELS[slug] || slug.toUpperCase();
    const etf = SECTOR_ETF_TICKER[slug] || slug.toUpperCase();
    return {
      title: `${label} Sector Stocks (${etf}) – Returns, Chart & Performance`,
      description: `${label} sector ETF ${etf} returns, price chart, sector heatmap context, and stock performance data for sector rotation research.`,
      canonical: `${SITE_ORIGIN}/sector-data/${encodeURIComponent(slug)}`
    };
  }

  const statMatch = path.match(/^\/statistic\/(ticker-(?:annual|quarterly|monthly|weekly|daily))\/([A-Za-z0-9.]+)$/i);
  if (statMatch) {
    const kind = statMatch[1].toLowerCase();
    const symbol = decodeURIComponent(statMatch[2]).toUpperCase();
    const spec = STAT_KIND_SEARCH[kind];
    const horizon = spec?.title || 'Stock Returns';
    return {
      title: `${symbol} ${horizon} – Historical Performance Data`,
      description: spec
        ? spec.description(symbol)
        : `${symbol} historical return statistics and OHLC-based performance data for U.S. equity analysis.`,
      canonical: `${SITE_ORIGIN}/statistic/${kind}/${encodeURIComponent(symbol.toLowerCase())}`
    };
  }

  const relMatch = path.match(/^\/relative-performance\/ticker\/([A-Za-z0-9.]+)$/i);
  if (relMatch) {
    const symbol = decodeURIComponent(relMatch[1]).toUpperCase();
    return {
      title: `${symbol} vs S&P 500 – Relative Strength & Performance Comparison`,
      description: `Compare ${symbol} stock performance vs S&P 500, Nasdaq, and sector indices with relative strength charts, excess returns, and historical comparison tables.`,
      canonical: `${SITE_ORIGIN}/relative-performance/ticker/${encodeURIComponent(symbol.toLowerCase())}`
    };
  }

  const publicPaperMatch = path.match(/^\/paper-trading\/public\/([0-9a-f-]{36})$/i);
  if (publicPaperMatch) {
    return {
      title: 'Published Virtual Portfolio – Holdings & Performance',
      description:
        'View a published Odin500 virtual portfolio with simulated holdings, equity curve, closed trades, and sector allocation.',
      canonical: `${SITE_ORIGIN}/paper-trading/public/${publicPaperMatch[1]}`
    };
  }

  return null;
}

export function resolveRequestMetadata(pathname: string) {
  const path = normalizePathname(pathname);
  return (
    resolveDynamicRouteMetadata(path) ||
    ROUTE_METADATA[path] || {
      title: DEFAULT_SITE_TITLE,
      description: DEFAULT_SITE_DESCRIPTION,
      canonical: absoluteSiteUrl(path)
    }
  );
}

export function toNextMetadata(pathname: string): Metadata {
  const meta = resolveRequestMetadata(pathname);
  const images = defaultOgImages();
  const noindex = shouldNoindexPath(pathname);
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    ...(GOOGLE_SITE_VERIFICATION
      ? { verification: { google: GOOGLE_SITE_VERIFICATION } }
      : {}),
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.canonical,
      type: 'website',
      siteName: 'Odin500',
      images
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: images.map((img) => img.url)
    }
  };
}

function pickReturnPct(performance: Record<string, unknown> | undefined, periodName: string) {
  return pickDynamicReturn(performance, periodName);
}

/** Enrich ticker page title/description with live return snippets from SSR data. */
export function enrichTickerMetadata(
  meta: { title: string; description: string; canonical: string },
  seoData: {
    symbol?: string;
    company_name?: string | null;
    asOfDate?: string;
    returnsSym?: { performance?: Record<string, unknown> } | null;
  } | null
) {
  if (!seoData?.symbol) return meta;
  const sym = String(seoData.symbol).toUpperCase();
  const name = String(seoData.company_name || '').trim();
  const label = name ? `${name} (${sym})` : sym;
  const perf = seoData.returnsSym?.performance;
  const ytd = pickReturnPct(perf, 'Year to Date (YTD)');
  const y1 = pickReturnPct(perf, 'Last 1 year');
  const bits: string[] = [];
  if (ytd != null) bits.push(`YTD return ${formatReturnPct(ytd)}`);
  if (y1 != null) bits.push(`1-year return ${formatReturnPct(y1)}`);
  const asOf = seoData.asOfDate ? ` Updated ${seoData.asOfDate}.` : '';
  const perfBit = bits.length ? ` ${bits.join(', ')}.` : '';
  return {
    ...meta,
    title: `${label} Stock Price Chart, Historical OHLC Data, Returns & Trading Signals`,
    description: `${label} stock chart with historical OHLC prices, period returns, trading signals, and SPY benchmark comparison.${perfBit}${asOf}`
  };
}

function performanceSnippet(
  performance: Record<string, unknown> | undefined,
  asOfDate?: string
) {
  const ytd = pickReturnPct(performance, 'Year to Date (YTD)');
  const y1 = pickReturnPct(performance, 'Last 1 year');
  const m6 = pickReturnPct(performance, 'Last 6 months');
  const bits: string[] = [];
  if (ytd != null) bits.push(`YTD ${formatReturnPct(ytd)}`);
  if (m6 != null) bits.push(`6M ${formatReturnPct(m6)}`);
  if (y1 != null) bits.push(`1Y ${formatReturnPct(y1)}`);
  const asOf = asOfDate ? ` Updated ${asOfDate}.` : '';
  return bits.length ? ` ${bits.join(', ')}.${asOf}` : asOf;
}

/** Enrich index page metadata with live performance from SSR prefetch. */
export function enrichIndexMetadata(
  meta: { title: string; description: string; canonical: string },
  seoData: {
    indexPayload?: { performance?: Record<string, unknown> } | null;
    asOfDate?: string;
    slug?: string;
  } | null
) {
  if (!seoData?.indexPayload) return meta;
  const slug = String(seoData.slug || '').toLowerCase();
  const label = INDEX_SLUG_LABELS[slug] || slug.replace(/-/g, ' ') || 'Index';
  const perf = seoData.indexPayload.performance;
  const perfBit = performanceSnippet(perf, seoData.asOfDate);
  return {
    ...meta,
    title: `${label} Index Chart, Returns & Historical Stock Market Data`,
    description: `${label} index chart with historical returns, OHLC price data, trading signals, and U.S. equity benchmark comparison.${perfBit}`
  };
}

/** Enrich sector ETF page metadata with live performance from SSR prefetch. */
export function enrichSectorMetadata(
  meta: { title: string; description: string; canonical: string },
  seoData: {
    slug?: string;
    indexPayload?: { performance?: Record<string, unknown>; ticker?: string } | null;
    asOfDate?: string;
  } | null
) {
  if (!seoData?.indexPayload) return meta;
  const slug = String(seoData.slug || '').toLowerCase();
  const label = SECTOR_SLUG_LABELS[slug] || slug.toUpperCase();
  const etf =
    String(seoData.indexPayload.ticker || SECTOR_ETF_TICKER[slug] || slug).toUpperCase();
  const perfBit = performanceSnippet(seoData.indexPayload.performance, seoData.asOfDate);
  return {
    ...meta,
    title: `${label} Sector Stocks (${etf}) – Returns, Chart & Performance`,
    description: `${label} sector ETF ${etf} returns, price chart, sector heatmap context, and constituent performance data.${perfBit}`
  };
}

/** Enrich statistic route metadata with period returns and optional company name. */
export function enrichStatisticMetadata(
  meta: { title: string; description: string; canonical: string },
  kind: string,
  seoData: {
    symbol?: string;
    company_name?: string | null;
    dynamicSym?: Array<{ period?: string; totalReturn?: number }> | unknown[];
    asOfDate?: string;
  } | null
) {
  if (!seoData?.symbol) return meta;
  const sym = String(seoData.symbol).toUpperCase();
  const name = String(seoData.company_name || '').trim();
  const label = name ? `${name} (${sym})` : sym;
  const spec = STAT_KIND_SEARCH[kind];
  const horizon = spec?.title || 'Stock Returns';
  let perfBit = '';
  const dynamic = Array.isArray(seoData.dynamicSym) ? seoData.dynamicSym : [];
  const y1 = dynamic.find(
    (r) => typeof r === 'object' && r && String((r as { period?: string }).period || '').includes('1 year')
  ) as { totalReturn?: number } | undefined;
  const ytd = dynamic.find(
    (r) => typeof r === 'object' && r && String((r as { period?: string }).period || '').includes('YTD')
  ) as { totalReturn?: number } | undefined;
  const bits: string[] = [];
  if (ytd?.totalReturn != null) bits.push(`YTD ${formatReturnPct(Number(ytd.totalReturn))}`);
  if (y1?.totalReturn != null) bits.push(`1Y ${formatReturnPct(Number(y1.totalReturn))}`);
  if (bits.length) perfBit = ` ${bits.join(', ')}.`;
  if (seoData.asOfDate) perfBit += ` Updated ${seoData.asOfDate}.`;
  return {
    ...meta,
    title: `${label} ${horizon} – Historical Performance Data`,
    description: `${label} ${horizon.toLowerCase()} with OHLC-based statistics and downloadable performance tables.${perfBit}`
  };
}

export function metadataFromResolved(
  meta: {
    title: string;
    description: string;
    canonical?: string;
  },
  pathname?: string
): Metadata {
  const images = defaultOgImages();
  const noindex = pathname ? shouldNoindexPath(pathname) : false;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    ...(GOOGLE_SITE_VERIFICATION
      ? { verification: { google: GOOGLE_SITE_VERIFICATION } }
      : {}),
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.canonical,
      type: 'website',
      siteName: 'Odin500',
      images
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: images.map((img) => img.url)
    }
  };
}

export function enrichHistoricalDataMetadata(
  meta: { title: string; description: string; canonical: string },
  preview: {
    symbol?: string;
    company_name?: string | null;
    min_date?: string;
    max_date?: string;
    latest_date?: string;
    latest_close?: number | null;
  }
) {
  if (!preview?.symbol) return meta;
  const sym = String(preview.symbol).toUpperCase();
  const name = String(preview.company_name || '').trim();
  const label = name ? `${name} (${sym})` : sym;
  const rangeBit =
    preview.min_date && preview.max_date
      ? ` Daily OHLC from ${preview.min_date} through ${preview.max_date}.`
      : '';
  let closeBit = '';
  if (preview.latest_close != null && preview.latest_date) {
    const close = Number(preview.latest_close);
    const closeStr = Number.isFinite(close) ? close.toFixed(2) : String(preview.latest_close);
    closeBit = ` Latest stock price $${closeStr} on ${preview.latest_date}.`;
  }
  const titleLead = name ? `${name} (${sym})` : sym;
  return {
    ...meta,
    title: `${titleLead} Historical Stock Prices – OHLC Download & CSV Export`,
    description: `${label} historical stock prices with open, high, low, close, and volume.${rangeBit}${closeBit} Free CSV export and price charts.`
  };
}
