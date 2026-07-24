import type { BreadcrumbItem } from './buildPageJsonLd';

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

const STAT_KIND_LABELS: Record<string, string> = {
  'ticker-annual': 'Annual returns',
  'ticker-quarterly': 'Quarterly returns',
  'ticker-monthly': 'Monthly returns',
  'ticker-weekly': 'Weekly returns',
  'ticker-daily': 'Daily returns'
};

const STATIC_CRUMBS: Record<string, BreadcrumbItem[]> = {
  '/market': [{ name: 'Market', path: '/market' }],
  '/heatmap': [
    { name: 'Market', path: '/market' },
    { name: 'Heatmap', path: '/heatmap' }
  ],
  '/market-movers': [
    { name: 'Market', path: '/market' },
    { name: 'Market movers', path: '/market-movers' }
  ],
  '/odin-signals': [
    { name: 'Market', path: '/market' },
    { name: 'Odin signals', path: '/odin-signals' }
  ],
  '/news': [
    { name: 'Market', path: '/market' },
    { name: 'News', path: '/news' }
  ],
  '/statistic-data': [
    { name: 'Market', path: '/market' },
    { name: 'Statistics', path: '/statistic-data' }
  ],
  '/return-table': [
    { name: 'Market', path: '/market' },
    { name: 'Return table', path: '/return-table' }
  ],
  '/stock-splits': [
    { name: 'Market', path: '/market' },
    { name: 'Stock splits', path: '/stock-splits' }
  ],
  '/premium': [{ name: 'Premium', path: '/premium' }],
  '/about': [
    { name: 'Market', path: '/market' },
    { name: 'About', path: '/about' }
  ],
  '/profile': [
    { name: 'Market', path: '/market' },
    { name: 'Profile', path: '/profile' }
  ],
  '/accounts': [
    { name: 'Market', path: '/market' },
    { name: 'Accounts', path: '/accounts' }
  ],
  '/paper-trading': [
    { name: 'Market', path: '/market' },
    { name: 'Your portfolio', path: '/paper-trading' }
  ],
  '/paper-trading/public': [
    { name: 'Market', path: '/market' },
    { name: 'Public portfolios', path: '/paper-trading/public' }
  ],
  '/newsletter': [{ name: 'Newsletter', path: '/newsletter' }],
  '/methodology': [
    { name: 'Market', path: '/market' },
    { name: 'Methodology', path: '/methodology' }
  ]
};

/** Auto-generate breadcrumb trail from pathname for JSON-LD. */
export function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const path = String(pathname || '/')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '') || '/';

  if (STATIC_CRUMBS[path]) return STATIC_CRUMBS[path];

  const tickerMatch = path.match(/^\/ticker\/([A-Za-z0-9.]+)$/i);
  if (tickerMatch) {
    const sym = decodeURIComponent(tickerMatch[1]).toUpperCase();
    return [
      { name: 'Market', path: '/market' },
      { name: sym, path: `/ticker/${encodeURIComponent(sym.toLowerCase())}` }
    ];
  }

  const histMatch = path.match(/^\/historical-data\/([A-Za-z0-9.]+)$/i);
  if (histMatch) {
    const sym = decodeURIComponent(histMatch[1]).toUpperCase();
    return [
      { name: 'Market', path: '/market' },
      { name: 'Historical data', path: '/historical-data/aapl' },
      { name: sym, path: `/historical-data/${encodeURIComponent(sym.toLowerCase())}` }
    ];
  }

  const reportMatch = path.match(/^\/ticker-report\/([A-Za-z0-9.]+)$/i);
  if (reportMatch) {
    const sym = decodeURIComponent(reportMatch[1]).toUpperCase();
    return [
      { name: 'Market', path: '/market' },
      { name: 'Statistics', path: '/statistic-data' },
      { name: `${sym} monthly report`, path: `/ticker-report/${encodeURIComponent(sym.toLowerCase())}` }
    ];
  }

  const indexMatch = path.match(/^\/indices\/([a-z0-9-]+)$/i);
  if (indexMatch) {
    const slug = decodeURIComponent(indexMatch[1]).toLowerCase();
    const label = INDEX_SLUG_LABELS[slug] || slug.replace(/-/g, ' ');
    return [
      { name: 'Market', path: '/market' },
      { name: label, path: `/indices/${slug}` }
    ];
  }

  const sectorMatch = path.match(/^\/sector-data\/([a-z0-9]+)$/i);
  if (sectorMatch) {
    const slug = decodeURIComponent(sectorMatch[1]).toLowerCase();
    const label = SECTOR_SLUG_LABELS[slug] || slug.toUpperCase();
    return [
      { name: 'Market', path: '/market' },
      { name: `${label} sector`, path: `/sector-data/${slug}` }
    ];
  }

  const statMatch = path.match(/^\/statistic\/(ticker-(?:annual|quarterly|monthly|weekly|daily))\/([A-Za-z0-9.]+)$/i);
  if (statMatch) {
    const kind = statMatch[1].toLowerCase();
    const sym = decodeURIComponent(statMatch[2]).toUpperCase();
    const label = STAT_KIND_LABELS[kind] || 'Statistics';
    return [
      { name: 'Market', path: '/market' },
      { name: 'Statistics', path: '/statistic-data' },
      { name: `${sym} ${label.toLowerCase()}`, path: `/statistic/${kind}/${encodeURIComponent(sym.toLowerCase())}` }
    ];
  }

  const relMatch = path.match(/^\/relative-performance\/ticker\/([A-Za-z0-9.]+)$/i);
  if (relMatch) {
    const sym = decodeURIComponent(relMatch[1]).toUpperCase();
    return [
      { name: 'Market', path: '/market' },
      { name: 'Statistics', path: '/statistic-data' },
      {
        name: `${sym} relative performance`,
        path: `/relative-performance/ticker/${encodeURIComponent(sym.toLowerCase())}`
      }
    ];
  }

  const publicPaperMatch = path.match(/^\/paper-trading\/public\/([0-9a-f-]{36})$/i);
  if (publicPaperMatch) {
    return [
      { name: 'Market', path: '/market' },
      { name: 'Public portfolios', path: '/paper-trading/public' },
      { name: 'Portfolio', path }
    ];
  }

  if (path === '/paper-trading/public') {
    return STATIC_CRUMBS['/paper-trading/public'];
  }

  const newsletterIssueMatch = path.match(/^\/newsletter\/([a-z0-9-]+)$/i);
  if (newsletterIssueMatch) {
    return [
      { name: 'Newsletter', path: '/newsletter' },
      { name: 'Weekly issue', path }
    ];
  }

  if (path === '/newsletter') {
    return STATIC_CRUMBS['/newsletter'];
  }

  return path !== '/' ? [{ name: 'Market', path: '/market' }] : [];
}
