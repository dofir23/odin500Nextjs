/** Short, topic-defining H1 for SSR — distinct from long SEO title tags. */
const VISIBLE_H1: Record<string, string> = {
  '/': 'A modern market data platform for investors and researchers.',
  '/market': 'Stock market dashboard',
  '/heatmap': 'Stock market heatmap',
  '/odin-signals': 'Stock trading signals screener',
  '/market-movers': 'Top stock gainers and losers today',
  '/news': 'Stock market news today',
  '/newsletter': 'Weekly U.S. market newsletter',
  '/premium': 'Simple pricing',
  '/paper-trading': 'Virtual portfolio simulator',
  '/paper-trading/public': 'Public virtual portfolios',
  '/methodology': 'Data methodology & editorial standards',
  '/about': 'About Odin500',
  '/profile': 'Your profile',
  '/statistic-data': 'Stock statistics & returns',
  '/return-table': 'Stock and index returns table',
  '/stock-splits': 'Stock split calendar'
};

function decodeSym(raw: string) {
  return decodeURIComponent(raw).trim().toUpperCase();
}

/** Priority-A (and matching) dynamic H1s for SSR headings. */
function resolveDynamicVisibleH1(path: string): string | null {
  const historical = path.match(/^\/historical-data\/([A-Za-z0-9.]+)$/i);
  if (historical) return `${decodeSym(historical[1])} historical OHLC prices`;

  const report = path.match(/^\/ticker-report\/([A-Za-z0-9.]+)$/i);
  if (report) return `${decodeSym(report[1])} monthly performance report`;

  const relative = path.match(/^\/relative-performance\/ticker\/([A-Za-z0-9.]+)$/i);
  if (relative) return `${decodeSym(relative[1])} vs S&P 500 relative strength`;

  const annual = path.match(/^\/statistic\/ticker-annual\/([A-Za-z0-9.]+)$/i);
  if (annual) return `${decodeSym(annual[1])} annual returns`;

  const quarterly = path.match(/^\/statistic\/ticker-quarterly\/([A-Za-z0-9.]+)$/i);
  if (quarterly) return `${decodeSym(quarterly[1])} quarterly returns`;

  const monthly = path.match(/^\/statistic\/ticker-monthly\/([A-Za-z0-9.]+)$/i);
  if (monthly) return `${decodeSym(monthly[1])} monthly returns`;

  const weekly = path.match(/^\/statistic\/ticker-weekly\/([A-Za-z0-9.]+)$/i);
  if (weekly) return `${decodeSym(weekly[1])} weekly returns`;

  const daily = path.match(/^\/statistic\/ticker-daily\/([A-Za-z0-9.]+)$/i);
  if (daily) return `${decodeSym(daily[1])} daily returns`;

  return null;
}

export function resolveVisiblePageH1(pathname: string): string | null {
  const path =
    String(pathname || '/')
      .split('?')[0]
      .split('#')[0]
      .replace(/\/+$/, '') || '/';
  return VISIBLE_H1[path] ?? resolveDynamicVisibleH1(path);
}
