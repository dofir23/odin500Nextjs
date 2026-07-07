/** Short, topic-defining H1 for SSR — distinct from long SEO title tags. */
const VISIBLE_H1: Record<string, string> = {
  '/': 'A modern market data platform for investors and researchers.',
  '/market': 'Stock market dashboard',
  '/heatmap': 'Stock market heatmap',
  '/odin-signals': 'Stock trading signals screener',
  '/market-movers': 'Top stock gainers and losers today',
  '/news': 'Stock market news today',
  '/newsletter': 'Odin500 weekly newsletter',
  '/premium': 'Simple pricing',
  '/paper-trading': 'Virtual portfolio simulator',
  '/paper-trading/public': 'Public virtual portfolios',
  '/methodology': 'Data methodology & editorial standards',
  '/about': 'About Odin500',
  '/profile': 'Your profile',
  '/statistic-data': 'Stock statistics & returns',
  '/return-table': 'Stock & index returns table',
  '/stock-splits': 'Stock split calendar'
};

export function resolveVisiblePageH1(pathname: string): string | null {
  const path = String(pathname || '/')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '') || '/';
  return VISIBLE_H1[path] ?? null;
}
