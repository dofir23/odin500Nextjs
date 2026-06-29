import { SITE_ORIGIN } from '@/seo/siteConfig.js';

function symFromPath(pathname: string) {
  const m = pathname.match(
    /^\/(?:ticker|historical-data|ticker-report|relative-performance\/ticker|statistic\/ticker-(?:annual|quarterly|monthly|weekly|daily))\/([A-Za-z0-9.]+)$/i
  );
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

const MARKET_HUB_LINKS = [
  { href: '/market', label: 'Market dashboard' },
  { href: '/heatmap', label: 'Stock market heatmap' },
  { href: '/market-movers', label: 'Market movers' },
  { href: '/odin-signals', label: 'Trading signals screener' },
  { href: '/news', label: 'Market news' },
  { href: '/return-table', label: 'Index & sector returns' },
  { href: '/statistic-data', label: 'Stock statistics' },
  { href: '/stock-splits', label: 'Stock split calendar' },
  { href: '/indices/sp500', label: 'S&P 500 index' },
  { href: '/indices/dow-jones', label: 'Dow Jones index' },
  { href: '/indices/nasdaq-100', label: 'Nasdaq 100 index' },
  { href: '/sector-data/xlk', label: 'Technology sector (XLK)' },
  { href: '/sector-data/xlf', label: 'Financials sector (XLF)' },
  { href: '/premium', label: 'Premium plans' }
];

const STATIC_ROUTE_LINKS: Record<string, Array<{ href: string; label: string }>> = {
  '/': [
    { href: '/market', label: 'Market dashboard' },
    { href: '/heatmap', label: 'Stock market heatmap' },
    { href: '/odin-signals', label: 'Trading signals screener' },
    { href: '/newsletter', label: 'Weekly newsletter' },
    { href: '/paper-trading', label: 'Paper trading' },
    { href: '/premium', label: 'Premium plans' },
    { href: '/signup', label: 'Create account' }
  ],
  '/market': MARKET_HUB_LINKS,
  '/heatmap': MARKET_HUB_LINKS,
  '/market-movers': MARKET_HUB_LINKS,
  '/odin-signals': MARKET_HUB_LINKS,
  '/news': MARKET_HUB_LINKS,
  '/statistic-data': MARKET_HUB_LINKS,
  '/return-table': MARKET_HUB_LINKS,
  '/stock-splits': MARKET_HUB_LINKS,
  '/about': [
    { href: '/market', label: 'Market dashboard' },
    { href: '/accounts', label: 'Account management' },
    { href: '/paper-trading', label: 'Paper trading' }
  ],
  '/accounts': [
    { href: '/about', label: 'Profile settings' },
    { href: '/paper-trading', label: 'Paper trading' },
    { href: '/market', label: 'Market dashboard' }
  ],
  '/paper-trading': [
    { href: '/market', label: 'Market dashboard' },
    { href: '/odin-signals', label: 'Trading signals' },
    { href: '/market-movers', label: 'Market movers' }
  ]
};

type SeoInternalLinksProps = {
  pathname: string;
};

function InternalLinksNav({
  title,
  links
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <nav className="ssr-internal-links" aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs opacity-70">Canonical site: {SITE_ORIGIN}</p>
    </nav>
  );
}

/** Server-rendered internal links for SEO routes. */
export function SeoInternalLinks({ pathname }: SeoInternalLinksProps) {
  const path = String(pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  const sym = symFromPath(path);
  if (sym) {
    const upper = sym.toUpperCase();
    const links = [
      { href: `/ticker/${sym}`, label: `${upper} overview` },
      { href: `/historical-data/${sym}`, label: `${upper} historical OHLC` },
      { href: `/ticker-report/${sym}`, label: `${upper} monthly report` },
      { href: `/relative-performance/ticker/${sym}`, label: `${upper} relative performance` },
      { href: `/statistic/ticker-annual/${sym}`, label: `${upper} annual returns` },
      { href: `/statistic/ticker-quarterly/${sym}`, label: `${upper} quarterly returns` },
      { href: `/statistic/ticker-monthly/${sym}`, label: `${upper} monthly returns` },
      { href: `/statistic/ticker-weekly/${sym}`, label: `${upper} weekly returns` },
      { href: `/statistic/ticker-daily/${sym}`, label: `${upper} daily returns` }
    ];
    return <InternalLinksNav title={`Related ${upper} pages`} links={links} />;
  }

  const indexMatch = path.match(/^\/indices\/([a-z0-9-]+)$/i);
  if (indexMatch) {
    const slug = indexMatch[1].toLowerCase();
    return (
      <InternalLinksNav
        title="Related index pages"
        links={[
          { href: `/indices/${slug}`, label: 'Index overview' },
          { href: '/market', label: 'Market dashboard' },
          { href: '/heatmap', label: 'Heatmap' },
          { href: '/return-table', label: 'Returns table' },
          ...MARKET_HUB_LINKS.filter((l) => l.href.startsWith('/indices/') && l.href !== `/indices/${slug}`)
        ]}
      />
    );
  }

  const sectorMatch = path.match(/^\/sector-data\/([a-z0-9]+)$/i);
  if (sectorMatch) {
    const slug = sectorMatch[1].toLowerCase();
    return (
      <InternalLinksNav
        title="Related sector pages"
        links={[
          { href: `/sector-data/${slug}`, label: 'Sector overview' },
          { href: '/heatmap', label: 'Market heatmap' },
          { href: '/market', label: 'Market dashboard' },
          { href: '/return-table', label: 'Returns table' }
        ]}
      />
    );
  }

  const staticLinks = STATIC_ROUTE_LINKS[path];
  if (staticLinks?.length) {
    return <InternalLinksNav title="Explore market data" links={staticLinks} />;
  }

  if (path === '/newsletter' || path.startsWith('/newsletter/')) {
    return (
      <InternalLinksNav
        title="Related pages"
        links={[
          { href: '/newsletter', label: 'Newsletter archive' },
          { href: '/market', label: 'Market dashboard' },
          { href: '/odin-signals', label: 'Odin Signals' },
          { href: '/ticker-report/aapl', label: 'Ticker reports' },
          { href: '/news', label: 'Market news' }
        ]}
      />
    );
  }

  return null;
}
