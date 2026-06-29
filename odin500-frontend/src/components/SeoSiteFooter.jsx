'use client';
import { Link } from '@/navigation/appRouterCompat.jsx';

const FOOTER_SECTIONS = [
  {
    title: 'Markets',
    links: [
      { to: '/market', label: 'Market Dashboard' },
      { to: '/odin-signals', label: 'Odin Signals' },
      { to: '/heatmap', label: 'Heatmap' },
      { to: '/market-movers', label: 'Market Movers' },
      { to: '/news', label: 'News' }
    ]
  },
  {
    title: 'Indices & sectors',
    links: [
      { to: '/indices/sp500', label: 'S&P 500' },
      { to: '/indices/nasdaq-100', label: 'Nasdaq 100' },
      { to: '/indices/dow-jones', label: 'Dow Jones' },
      { to: '/sector-data/xlk', label: 'Sector Data (XLK)' }
    ]
  },
  {
    title: 'Statistics',
    links: [
      { to: '/ticker/aapl', label: 'Ticker Analytics' },
      { to: '/statistic/ticker-annual/aapl', label: 'Annual Returns' },
      { to: '/statistic-data', label: 'Statistic Tables' },
      { to: '/historical-data', label: 'Historical Data' },
      { to: '/relative-performance/ticker/aapl', label: 'Relative Performance' }
    ]
  },
  {
    title: 'Account',
    links: [
      { to: '/premium', label: 'Premium Plans' },
      { to: '/about', label: 'Your Profile' }
    ]
  }
];

/** Crawlable footer sitemap — semantic <footer> with real <a href> links for bots. */
export function SeoSiteFooter() {
  return (
    <footer className="seo-site-footer" aria-label="Site map">
      <div className="seo-site-footer__inner">
        {FOOTER_SECTIONS.map((section) => (
          <nav key={section.title} className="seo-site-footer__col" aria-label={section.title}>
            <h2 className="seo-site-footer__heading">{section.title}</h2>
            <ul className="seo-site-footer__list">
              {section.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="seo-site-footer__link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="seo-site-footer__copy">
        © {new Date().getFullYear()} Odin500 ·{' '}
        <a href="https://www.odin500.com/" className="seo-site-footer__link">
          www.odin500.com
        </a>
      </p>
    </footer>
  );
}
