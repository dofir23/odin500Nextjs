'use client';
import { useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { TickerSymbolCombobox } from './TickerSymbolCombobox.jsx';
import { Odin500BrandLink } from './Odin500BrandLink.jsx';
import { useRightRailDock } from '../context/WatchlistDockContext.jsx';
import { DEFAULT_TICKER_ROUTE_SYMBOL, isMainTickerRoutePath } from '../utils/tickerUrlSync.js';

function IconSun() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l-1.5-1.5M20.5 20.5 19 19M19 5l1.5-1.5M5 19l-1.5 1.5"
      />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNavMenu() {
  return (
    <svg
      className="app-main-topbar__mobile-ico-svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M21 10H3M21 18H3M21 6H3M21 14H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWatchlist() {
  return (
    <svg className="app-main-topbar__mobile-ico-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="9" r="2.5" fill="currentColor" />
      <path
        d="M4.5 19c.6-1.8 2-3 3.5-3s2.9 1.2 3.5 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="13" y="5" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M15 14l2-3 2 2 2-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTickers() {
  return (
    <svg className="app-main-topbar__mobile-ico-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4v16M12 6v12M17 5v14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="5.25" y="9" width="3.5" height="6" rx="0.75" fill="currentColor" />
      <rect x="10.25" y="11" width="3.5" height="4" rx="0.75" fill="currentColor" />
      <rect x="15.25" y="8" width="3.5" height="7" rx="0.75" fill="currentColor" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconMovers() {
  return (
    <svg className="app-main-topbar__mobile-ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3c-1 4-5 5-5 10a5 5 0 1 0 10 0c0-3-2-5-5-10z" />
    </svg>
  );
}

function IconMarkets() {
  return (
    <svg className="app-main-topbar__mobile-ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 9L14.5515 13.6061C14.3555 13.746 14.2576 13.816 14.1527 13.8371C14.0602 13.8557 13.9643 13.8478 13.8762 13.8142C13.7762 13.7762 13.691 13.691 13.5208 13.5208L10.4792 10.4792C10.309 10.309 10.2238 10.2238 10.1238 10.1858C10.0357 10.1522 9.9398 10.1443 9.84732 10.1629C9.74241 10.184 9.64445 10.254 9.44853 10.3939L3 15M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z"
      />
    </svg>
  );
}

const TICKERS_TO = `/ticker/${encodeURIComponent(DEFAULT_TICKER_ROUTE_SYMBOL)}`;

/**
 * Top strip inside the main column: ticker search + theme toggle.
 * On mobile: logo + search + theme on top; quick nav (incl. sidebar menu) docked to the bottom.
 */
export function AppMainTopBar({
  theme = 'dark',
  onToggleTheme,
  isMobile = false,
  mobileNavOpen = false,
  onToggleMobileNav = null
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const dock = useRightRailDock();
  const isLight = theme === 'light';

  const watchlistActive = dock.activePanel === 'watchlist';
  const marketsActive = location.pathname === '/market';
  const tickersActive = isMainTickerRoutePath(location.pathname);
  const moversActive = location.pathname.startsWith('/market-movers');

  const openWatchlist = () => {
    dock.openWatchlist();
  };

  return (
    <>
      <header className={'app-main-topbar' + (isMobile ? ' app-main-topbar--mobile' : '')} role="banner">
        <div className="app-main-topbar__primary">
        {isMobile ? (
          <Odin500BrandLink
            theme={isLight ? 'light' : 'dark'}
            className="app-main-topbar__brand"
            imgClassName="app-main-topbar__logo"
            alt=""
          />
        ) : null}
        <div className="app-main-topbar__search">
          <TickerSymbolCombobox
            variant="header"
            symbol=""
            onSymbolChange={(sym) => navigate(`/ticker/${encodeURIComponent(sym)}`)}
            inputId="app-main-topbar-ticker-search"
          />
        </div>
        <div className="app-main-topbar__actions">
          <button
            type="button"
            className="app-main-topbar__theme"
            onClick={onToggleTheme}
            aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            title={isLight ? 'Dark mode' : 'Light mode'}
          >
            <span className="app-main-topbar__theme-track">
              <span className="app-main-topbar__theme-knob">{isLight ? <IconSun /> : <IconMoon />}</span>
            </span>
          </button>
        </div>
      </div>
      </header>
      {isMobile ? (
        <nav
          className="app-main-topbar__mobile-nav app-main-topbar__mobile-nav--dock"
          aria-label="Quick navigation"
        >
          <button
            type="button"
            className={'app-main-topbar__mobile-item' + (watchlistActive ? ' app-main-topbar__mobile-item--active' : '')}
            onClick={openWatchlist}
            aria-pressed={watchlistActive}
          >
            <span className="app-main-topbar__mobile-ico">
              <IconWatchlist />
            </span>
            <span className="app-main-topbar__mobile-label">Watchlist</span>
          </button>
          <button
            type="button"
            className={'app-main-topbar__mobile-item' + (marketsActive ? ' app-main-topbar__mobile-item--active' : '')}
            onClick={() => navigate('/market')}
            aria-current={marketsActive ? 'page' : undefined}
          >
            <span className="app-main-topbar__mobile-ico">
              <IconMarkets />
            </span>
            <span className="app-main-topbar__mobile-label">Markets</span>
          </button>
          <button
            type="button"
            className={'app-main-topbar__mobile-item' + (tickersActive ? ' app-main-topbar__mobile-item--active' : '')}
            onClick={() => navigate(TICKERS_TO)}
            aria-current={tickersActive ? 'page' : undefined}
          >
            <span className="app-main-topbar__mobile-ico">
              <IconTickers />
            </span>
            <span className="app-main-topbar__mobile-label">Tickers</span>
          </button>
          <button
            type="button"
            className={'app-main-topbar__mobile-item' + (moversActive ? ' app-main-topbar__mobile-item--active' : '')}
            onClick={() => navigate('/market-movers')}
            aria-current={moversActive ? 'page' : undefined}
          >
            <span className="app-main-topbar__mobile-ico">
              <IconMovers />
            </span>
            <span className="app-main-topbar__mobile-label">Movers</span>
          </button>
          {typeof onToggleMobileNav === 'function' ? (
            <button
              type="button"
              className={'app-main-topbar__mobile-item' + (mobileNavOpen ? ' app-main-topbar__mobile-item--active' : '')}
              onClick={onToggleMobileNav}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              aria-controls="app-sidebar-main"
            >
              <span className="app-main-topbar__mobile-ico">
                <IconNavMenu />
              </span>
              <span className="app-main-topbar__mobile-label">Menu</span>
            </button>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
