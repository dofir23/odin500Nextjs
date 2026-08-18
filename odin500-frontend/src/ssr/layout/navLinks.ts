/** Server-rendered navigation links (no client JS required). */

export type ServerNavLink = {
  href: string;
  label: string;
};

export const SERVER_NAV_LINKS: ServerNavLink[] = [
  { href: '/virtual-portfolio/ai', label: 'AI Portfolio' },
  { href: '/virtual-portfolio/public', label: 'Published Portfolio' },
  { href: '/virtual-portfolio', label: 'Your Portfolio' },
  { href: '/market', label: 'Markets' },
  { href: '/indices/dow-jones', label: 'Indices' },
  { href: '/ticker/AAPL', label: 'Tickers' },
  { href: '/market-movers', label: 'Market Movers' },
  { href: '/heatmap', label: 'Heatmaps' },
  { href: '/sector-data/xlk', label: 'Sector Data' },
  { href: '/news', label: 'News' },
  { href: '/newsletter', label: 'Newsletter' },
  { href: '/statistic/ticker-annual/AAPL', label: 'Statistics' },
  { href: '/return-table', label: 'Returns Table' },
  { href: '/odin-signals', label: 'Odin Signals' },
  { href: '/stock-splits', label: 'Stock Splits' },
  { href: '/premium', label: 'Premium' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/about', label: 'About' },
  { href: '/profile', label: 'Profile' },
  { href: '/accounts', label: 'Accounts' }
];
