/**
 * Warm lazy route chunks on hover/focus.
 * Idempotent; failed loads clear the key so a later hover can retry.
 */

import { lazyWithRetry } from './lazyWithRetry.js';

const prefetched = new Set();

function markAndRun(key, loader) {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  void lazyWithRetry(loader).catch(() => {
    prefetched.delete(key);
  });
}

/** @param {string | { pathname?: string } | undefined} to */
export function prefetchRouteChunks(to) {
  const raw = typeof to === 'string' ? to : to && typeof to.pathname === 'string' ? to.pathname : '';
  if (!raw || raw === '#') return;
  const p = raw.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) return;

  if (p.startsWith('/statistic/ticker-annual') || p.startsWith('/ticker-annual')) {
    return markAndRun('ticker-annual', () => import('../views/TickerAnnualPage.jsx'));
  }
  if (p.startsWith('/statistic/ticker-quarterly') || p.startsWith('/ticker-quarterly')) {
    return markAndRun('ticker-quarterly', () => import('../views/TickerQuarterlyPage.jsx'));
  }
  if (p.startsWith('/statistic/ticker-monthly') || p.startsWith('/ticker-monthly')) {
    return markAndRun('ticker-monthly', () => import('../views/TickerMonthlyPage.jsx'));
  }
  if (p.startsWith('/statistic/ticker-weekly') || p.startsWith('/ticker-weekly')) {
    return markAndRun('ticker-weekly', () => import('../views/TickerWeeklyPage.jsx'));
  }
  if (p.startsWith('/statistic/ticker-daily') || p.startsWith('/ticker-daily')) {
    return markAndRun('ticker-daily', () => import('../views/TickerDailyPage.jsx'));
  }
  if (p === '/ticker' || p.startsWith('/ticker/')) return markAndRun('ticker', () => import('../views/TickerPage.jsx'));

  if (p === '/indices' || p.startsWith('/indices/')) return markAndRun('indices', () => import('../views/IndexPage.jsx'));

  // market-movers before /market — `startsWith('/market')` would wrongly match movers.
  if (p.startsWith('/market-movers')) {
    return markAndRun('market-movers', () => import('../views/MarketMoversPage.jsx'));
  }
  // /market — bundled by Next.js page route; do not dynamic-import (causes webpack module conflicts).
  if (p === '/market') return;
  if (p.startsWith('/heatmap')) return markAndRun('heatmap', () => import('../views/MarketHeatmapPage.jsx'));
  if (p.startsWith('/news') && !p.startsWith('/newsletter')) {
    return markAndRun('news', () => import('../views/NewsPage.jsx'));
  }
  if (p === '/newsletter' || p.startsWith('/newsletter/')) {
    return markAndRun('newsletter', () => import('../views/NewsletterIndex.jsx'));
  }
  if (p.startsWith('/odin-signals') || p.startsWith('/tickers')) {
    return markAndRun('odin-signals', () => import('../views/OdinSignalsPage.jsx'));
  }
  if (p.startsWith('/return-table')) return markAndRun('return-table', () => import('../views/ReturnTablePage.jsx'));
  if (p.startsWith('/statistic-data')) return markAndRun('statistic-data', () => import('../views/StatisticDataPage.jsx'));
  if (p.startsWith('/relative-performance/ticker') || p.startsWith('/relative-strength/ticker')) {
    return markAndRun('relative-performance-ticker', () => import('../views/RelativeStrengthTickerPage.jsx'));
  }
  if (p.startsWith('/historical-data')) return markAndRun('historical-data', () => import('../views/HistoricalDataPage.jsx'));
  if (p.startsWith('/stock-splits')) return markAndRun('stock-splits', () => import('../views/StockSplitsPage.jsx'));
  if (p.startsWith('/ticker-report')) return markAndRun('ticker-report', () => import('../views/TickerReportPage.jsx'));
  if (p.startsWith('/sector-data')) return markAndRun('sector-data', () => import('../views/IndexPage.jsx'));
  if (p.startsWith('/paper-trading/public/')) {
    return markAndRun('paper-public-detail', () => import('../views/PaperTrading/PublicPortfolioDetailPage.jsx'));
  }
  if (p.startsWith('/paper-trading/public')) {
    return markAndRun('paper-public-list', () => import('../views/PaperTrading/PublicPortfoliosPage.jsx'));
  }
  if (p.startsWith('/paper-trading')) return markAndRun('paper-trading', () => import('../views/PaperTrading/PaperTradingPage.jsx'));
  if (p.startsWith('/accounts')) return markAndRun('accounts', () => import('../views/AccountsPage.jsx'));
  if (p.startsWith('/premium') || p.startsWith('/pricing')) return markAndRun('premium', () => import('../views/Pricing.jsx'));
  if (p.startsWith('/profile')) return markAndRun('profile', () => import('../views/ProfilePage.jsx'));
  if (p.startsWith('/about')) return markAndRun('about', () => import('../views/AboutPage.jsx'));

  if (p.startsWith('/login')) return markAndRun('login', () => import('../views/LoginPage.jsx'));
  if (p.startsWith('/forgot-password')) return markAndRun('forgot-password', () => import('../views/ForgotPasswordPage.jsx'));
  if (p.startsWith('/signup/verify-email')) return markAndRun('signup-verify', () => import('../views/SignupVerifyEmailPage.jsx'));
  if (p.startsWith('/signup/enter-code')) return markAndRun('signup-code', () => import('../views/SignupEnterCodePage.jsx'));
  if (p.startsWith('/signup/username')) return markAndRun('signup-user', () => import('../views/SignupUsernamePage.jsx'));
  if (p.startsWith('/signup')) return markAndRun('signup', () => import('../views/SignupPage.jsx'));
}
