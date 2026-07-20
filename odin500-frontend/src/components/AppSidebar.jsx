'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { SidebarToggleGlyph } from './SidebarToggleGlyph.jsx';
import { Odin500BrandLink } from './Odin500BrandLink.jsx';
import { useHeaderProfile } from '../hooks/useHeaderProfile.js';
import { useRouteWarm } from '../hooks/useRouteWarm.js';
import { buildRelativePerformanceDefaultHref } from '../utils/relativeStrengthNavigation.js';
import { DEFAULT_TICKER_ROUTE_SYMBOL, isMainTickerRoutePath } from '../utils/tickerUrlSync.js';
import { useLoginGateOptional } from '../context/LoginGateContext.jsx';
import { useAdmin } from '../hooks/useAdmin.js';

function IconShield() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg
      className="app-sidebar__ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 9L14.5515 13.6061C14.3555 13.746 14.2576 13.816 14.1527 13.8371C14.0602 13.8557 13.9643 13.8478 13.8762 13.8142C13.7762 13.7762 13.691 13.691 13.5208 13.5208L10.4792 10.4792C10.309 10.309 10.2238 10.2238 10.1238 10.1858C10.0357 10.1522 9.9398 10.1443 9.84732 10.1629C9.74241 10.184 9.64445 10.254 9.44853 10.3939L3 15M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" />
    </svg>
  );
}
function IconNews() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 5h12v12H4z" />
      <path d="M8 5V3h12v14h-2M8 9h8M8 13h5" />
    </svg>
  );
}
function IconFlame() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3c-1 4-5 5-5 10a5 5 0 1 0 10 0c0-3-2-5-5-10z" />
    </svg>
  );
}
function IconScissors() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="6" cy="6" r="2.25" />
      <circle cx="6" cy="18" r="2.25" />
      <path d="M8 7.5l14 9M8 16.5l14-9" strokeLinecap="round" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconFocus() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
function IconLineChart() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 18h18M4 14l4-4 4 4 6-8 3 3" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
      <path d="M17 11h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" />
    </svg>
  );
}
function IconPie() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 12V3a9 9 0 1 1-8.2 11" />
      <path d="M12 12h9a9 9 0 0 1-9 9v-9z" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );
}
function IconBarChart() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M5 20V10M12 20V4M19 20v-6" />
    </svg>
  );
}
function IconDocSearch() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 4h9a2 2 0 0 1 2 2v9M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <circle cx="17.5" cy="17.5" r="3.5" />
      <path d="M20 20l2 2" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function IconAnalyst() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v1M16 11l4 2v3" />
      <path d="M18 10v4" />
    </svg>
  );
}
function IconFinancial() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 4h12v16H6z" />
      <path d="M9 14l2-3 2 2 3-4" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg className="app-sidebar__account-chevron-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg className="app-sidebar__search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

function Sparkle() {
  return (
    <svg className="app-sidebar__sparkle" width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#facc15"
        d="M12 2l1.2 4.2L17 7l-3.8 2.8L15 14l-3-2.5L9 14l1.8-4.2L7 7l3.8-.8L12 2z"
      />
    </svg>
  );
}

function NavRow({ to, onClick, icon: Icon, label, badge, badgeTone, active = false, end = false }) {
  const warmRoute = useRouteWarm();
  const content = (
    <>
      <span className="app-sidebar__row-icon">
        <Icon />
      </span>
      <span className="app-sidebar__row-label">{label}</span>
      {badge != null ? (
        <span className={'app-sidebar__badge app-sidebar__badge--' + (badgeTone || 'muted')}>{badge}</span>
      ) : null}
    </>
  );

  if (to) {
    const warm = () => warmRoute(to);
    return (
      <NavLink
        to={to}
        end={end || to === '/market'}
        className={({ isActive }) => 'app-sidebar__row' + (isActive || active ? ' app-sidebar__row--active' : '')}
        onClick={onClick}
        onMouseEnter={warm}
        onFocus={warm}
      >
        {content}
      </NavLink>
    );
  }

  return (
    <button type="button" className="app-sidebar__row app-sidebar__row--btn app-sidebar__row--placeholder" onClick={onClick}>
      {content}
    </button>
  );
}

export function AppSidebar({ expanded, setExpanded, mobileOpen = false, onRequestClose = null }) {
  const navigate = useNavigate();
  const warmRoute = useRouteWarm();
  const isExpandedView = expanded || mobileOpen;
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const { loggedIn, profileName, initials, avatarUrl, handleSignOut, goToSignIn } = useHeaderProfile({
    guestLabel: 'Guest',
    signedInFallback: 'Account'
  });
  const loginGate = useLoginGateOptional();
  const { isAdmin } = useAdmin({ enabled: loggedIn });
  const accountWrapRef = useRef(null);

  const onPaperTradingNavClick = useCallback(
    (e) => {
      if (loggedIn) return;
      e.preventDefault();
      loginGate?.showLoginRequired({ returnTo: '/paper-trading' });
    },
    [loggedIn, loginGate]
  );

  const onPublicPortfoliosNavClick = useCallback(
    (e) => {
      if (loggedIn) return;
      e.preventDefault();
      loginGate?.showLoginRequired({ returnTo: '/paper-trading/public' });
    },
    [loggedIn, loginGate]
  );

  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      if (accountWrapRef.current && !accountWrapRef.current.contains(t)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const closeProfileMenu = () => setProfileOpen(false);

  const closeMobileSidebar = useCallback(() => {
    if (mobileOpen && typeof onRequestClose === 'function') onRequestClose();
  }, [mobileOpen, onRequestClose]);

  const handleScrollNavClick = (e) => {
    if (!mobileOpen) return;
    const link = e.target.closest('a[href]');
    if (link && e.currentTarget.contains(link)) closeMobileSidebar();
  };

  const runProfileAction = (action) => {
    closeProfileMenu();
    closeMobileSidebar();
    action();
  };

  const toggleProfileMenu = () => setProfileOpen((v) => !v);

  const profileMenuPop =
    profileOpen ? (
      <div className="header-pop header-pop--profile app-sidebar__profile-pop" role="menu" aria-label="Profile menu">
        <div className="header-pop__profile-top">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="header-pop__profile-image" aria-hidden />
          ) : (
            <span className="header-pop__profile-icon" aria-hidden>
              {initials}
            </span>
          )}
          <span className="header-pop__profile-name" title={profileName || undefined}>
            {profileName}
          </span>
        </div>
        {loggedIn ? (
          <>
            <Link to="/profile" className="header-pop__item" onClick={closeProfileMenu}>
              Your Profile
            </Link>
            <button type="button" className="header-pop__item" onClick={closeProfileMenu}>
              Setting
            </button>
            <button
              type="button"
              className="header-pop__item header-pop__item--danger"
              onClick={() => runProfileAction(() => handleSignOut())}
            >
              Sign out
            </button>
          </>
        ) : (
          <button type="button" className="header-pop__item" onClick={() => runProfileAction(() => goToSignIn())}>
            Sign in
          </button>
        )}
      </div>
    ) : null;
  const tickerPathMatch =
    location.pathname.match(/^\/ticker\/([^/?#]+)$/i) ||
    location.pathname.match(
      /^\/statistic\/ticker-(?:annual|quarterly|monthly|weekly|daily)\/([^/?#]+)$/i
    );
  const activeTickerSymbol = tickerPathMatch?.[1] ? decodeURIComponent(tickerPathMatch[1]).trim().toUpperCase() : '';
  const tickerSuffix = activeTickerSymbol
    ? `/${encodeURIComponent(activeTickerSymbol)}`
    : `/${encodeURIComponent(DEFAULT_TICKER_ROUTE_SYMBOL)}`;
  const annualTo = `/statistic/ticker-annual${tickerSuffix}`;
  const quarterlyTo = `/statistic/ticker-quarterly${tickerSuffix}`;
  const monthlyTo = `/statistic/ticker-monthly${tickerSuffix}`;
  const weeklyTo = `/statistic/ticker-weekly${tickerSuffix}`;
  const dailyTo = `/statistic/ticker-daily${tickerSuffix}`;
  const statSection =
    location.pathname === '/statistic-data' ? new URLSearchParams(location.search).get('section') || '' : '';
  const annualPageActive = location.pathname.startsWith('/statistic/ticker-annual');
  const quarterlyPageActive = location.pathname.startsWith('/statistic/ticker-quarterly');
  const monthlyPageActive = location.pathname.startsWith('/statistic/ticker-monthly');
  const weeklyPageActive = location.pathname.startsWith('/statistic/ticker-weekly');
  const dailyPageActive = location.pathname.startsWith('/statistic/ticker-daily');
  const isStatsRoute =
    annualPageActive || quarterlyPageActive || monthlyPageActive || weeklyPageActive || dailyPageActive;
  const isIndicesRoute = location.pathname.startsWith('/indices');
  const isSectorDataRoute = location.pathname.startsWith('/sector-data');
  const relativePerformanceTo = buildRelativePerformanceDefaultHref();
  const returnTableTo = '/return-table';
  const isRelativePerformanceRoute =
    location.pathname.startsWith('/relative-performance') ||
    location.pathname.startsWith('/relative-strength');
  const isReturnTableRoute =
    location.pathname === '/return-table' || location.pathname.startsWith('/return-table/');
  const isRelativePerformanceGroupRoute = isRelativePerformanceRoute || isReturnTableRoute;
  const isPaperYourRoute = location.pathname === '/paper-trading';
  const isPaperPublicRoute = location.pathname.startsWith('/paper-trading/public');
  const isPaperRoute = isPaperYourRoute || isPaperPublicRoute;
  const isAdminRoute = location.pathname.startsWith('/admin');
  const [indicesOpen, setIndicesOpen] = useState(isIndicesRoute);
  const [statsOpen, setStatsOpen] = useState(isStatsRoute);
  const [relativePerformanceOpen, setRelativePerformanceOpen] = useState(isRelativePerformanceGroupRoute);
  const [paperOpen, setPaperOpen] = useState(isPaperRoute);


  useEffect(() => {
    if (isIndicesRoute) setIndicesOpen(true);
  }, [isIndicesRoute]);

  useEffect(() => {
    if (isStatsRoute) setStatsOpen(true);
  }, [isStatsRoute]);

  useEffect(() => {
    if (isRelativePerformanceGroupRoute) setRelativePerformanceOpen(true);
  }, [isRelativePerformanceGroupRoute]);

  useEffect(() => {
    if (isPaperRoute) setPaperOpen(true);
  }, [isPaperRoute]);

  return (
    <aside
      id="app-sidebar-main"
      className={
        'app-sidebar ' +
        (isExpandedView ? 'app-sidebar--expanded' : 'app-sidebar--collapsed') +
        (mobileOpen ? ' app-sidebar--mobile-open app-sidebar--expanded' : '') +
        (profileOpen ? ' app-sidebar--profile-open' : '')
      }
      aria-label="Main navigation"
    >
      {!isExpandedView ? (
        <div className="app-sidebar__collapsed-only">
          <button
            type="button"
            className="app-sidebar__toggle app-sidebar__toggle--fab"
            aria-expanded="false"
            aria-label="Open navigation menu"
            onClick={() => setExpanded(true)}
          >
            <SidebarToggleGlyph expanded={false} />
          </button>
          <div className="header-util-wrap" ref={accountWrapRef}>
            <button
              type="button"
              className={
                'app-sidebar__account-btn app-sidebar__account-btn--collapsed' +
                (profileOpen ? ' app-sidebar__account-btn--active' : '')
              }
              aria-label="Profile"
              title="Profile"
              aria-expanded={profileOpen}
              onClick={toggleProfileMenu}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="header-avatar-image" aria-hidden />
              ) : (
                <span className="header-avatar-placeholder">{initials}</span>
              )}
            </button>
            {profileMenuPop}
          </div>
        </div>
      ) : (
        <>
          <div className="app-sidebar__topbar">
            <Odin500BrandLink
              className="app-sidebar__brand"
              imgClassName="app-sidebar__logo"
              onClick={closeMobileSidebar}
              onMouseEnter={() => warmRoute('/market')}
              onFocus={() => warmRoute('/market')}
            />
            <button
              type="button"
              className="app-sidebar__toggle app-sidebar__toggle--inline"
              aria-expanded="true"
              aria-label="Close navigation menu"
              onClick={() => {
                if (mobileOpen && typeof onRequestClose === 'function') onRequestClose();
                else setExpanded(false);
              }}
            >
              <SidebarToggleGlyph expanded />
            </button>
          </div>

          <div className="app-sidebar__scroll" onClick={handleScrollNavClick}>
            <nav className="app-sidebar__nav" aria-label="Markets">
              <NavRow to="/market" icon={IconGlobe} label="Markets" />
              <div
                className={
                  'app-sidebar__row app-sidebar__row--indices app-sidebar__row--indices-split' +
                  (isIndicesRoute ? ' app-sidebar__row--active' : '')
                }
                role="group"
                aria-label="Indices"
                onMouseEnter={() => warmRoute('/indices/dow-jones')}
              >
                <NavLink
                  to="/indices/dow-jones"
                  className="app-sidebar__indices-main"
                  onClick={() => {
                    setIndicesOpen(true);
                    closeMobileSidebar();
                  }}
                  onFocus={() => warmRoute('/indices/dow-jones')}
                  title="Open Dow Jones index (opens menu)"
                >
                  <span className="app-sidebar__row-icon">
                    <IconGrid />
                  </span>
                  <span className="app-sidebar__row-label">Indices</span>
                </NavLink>
                <button
                  type="button"
                  className="app-sidebar__indices-chevron-btn"
                  aria-expanded={indicesOpen}
                  aria-controls="app-sidebar-indices-options"
                  aria-label={indicesOpen ? 'Collapse indices submenu' : 'Expand indices submenu'}
                  onClick={() => setIndicesOpen((v) => !v)}
                >
                  <span
                    className={'app-sidebar__indices-chevron' + (indicesOpen ? ' app-sidebar__indices-chevron--open' : '')}
                    aria-hidden
                  >
                    <IconChevronRight />
                  </span>
                </button>
              </div>
              {indicesOpen ? (
                <div id="app-sidebar-indices-options" className="app-sidebar__subnav" role="group" aria-label="Indices options">
                  <NavRow to="/indices/dow-jones" icon={IconLineChart} label="Dow Jones" />
                  <NavRow to="/indices/nasdaq-100" icon={IconLineChart} label="Nasdaq-100" />
                  <NavRow to="/indices/sp500" icon={IconLineChart} label="SP 500" />
                </div>
              ) : null}
              <nav className="app-sidebar__nav" aria-label="Page">
              <NavRow
                to={`/ticker/${DEFAULT_TICKER_ROUTE_SYMBOL}`}
                icon={IconPeople}
                label="Tickers"
                active={isMainTickerRoutePath(location.pathname)}
              />
            </nav>
              <div
                className={
                  'app-sidebar__row app-sidebar__row--indices app-sidebar__row--indices-split' +
                  (isPaperRoute ? ' app-sidebar__row--active' : '')
                }
                role="group"
                aria-label="Virtual portfolio"
                onMouseEnter={() => {
                  warmRoute('/paper-trading');
                  warmRoute('/paper-trading/public');
                }}
              >
                <NavLink
                  to="/paper-trading"
                  className="app-sidebar__indices-main"
                  onClick={(e) => {
                    onPaperTradingNavClick(e);
                    setPaperOpen(true);
                    closeMobileSidebar();
                  }}
                  onFocus={() => {
                    warmRoute('/paper-trading');
                    warmRoute('/paper-trading/public');
                  }}
                  title="Your virtual portfolio (opens menu)"
                >
                  <span className="app-sidebar__row-icon">
                    <IconWallet />
                  </span>
                  <span className="app-sidebar__row-label">Virtual portfolio</span>
                </NavLink>
                <button
                  type="button"
                  className="app-sidebar__indices-chevron-btn"
                  aria-expanded={paperOpen}
                  aria-controls="app-sidebar-paper-options"
                  aria-label={paperOpen ? 'Collapse virtual portfolio submenu' : 'Expand virtual portfolio submenu'}
                  onClick={() => {
                    setPaperOpen((wasOpen) => {
                      const nextOpen = !wasOpen;
                      if (nextOpen) {
                        if (!loggedIn) {
                          loginGate?.showLoginRequired({ returnTo: '/paper-trading' });
                          return nextOpen;
                        }
                        navigate('/paper-trading');
                        closeMobileSidebar();
                      }
                      return nextOpen;
                    });
                  }}
                >
                  <span
                    className={'app-sidebar__indices-chevron' + (paperOpen ? ' app-sidebar__indices-chevron--open' : '')}
                    aria-hidden
                  >
                    <IconChevronRight />
                  </span>
                </button>
              </div>
              {paperOpen ? (
                <div id="app-sidebar-paper-options" className="app-sidebar__subnav" role="group" aria-label="Virtual portfolio options">
                  <NavRow
                    to="/paper-trading"
                    icon={IconWallet}
                    label="Your Portfolio"
                    active={isPaperYourRoute}
                    end
                    onClick={onPaperTradingNavClick}
                  />
                  <NavRow
                    to="/paper-trading/public"
                    icon={IconPeople}
                    label="Public Portfolios"
                    active={isPaperPublicRoute}
                    onClick={onPublicPortfoliosNavClick}
                  />
                </div>
              ) : null}
              <NavRow to="/market-movers" icon={IconFlame} label="Market Movers" />
              
              <NavRow to="/heatmap" icon={IconGrid} label="Heatmaps" />
              <NavRow
                to="/sector-data/xlk"
                icon={IconPie}
                label="Sector Data"
                active={isSectorDataRoute}
              />
              <NavRow to="/news" icon={IconNews} label="News" />
              <NavRow to="/newsletter" icon={IconNews} label="Newsletter" />
              {isAdmin ? (
                <NavRow to="/admin" icon={IconShield} label="Admin" active={isAdminRoute} />
              ) : null}
            </nav>

            
            

            <nav className="app-sidebar__nav" aria-label="Statistics">
              <div
                className={
                  'app-sidebar__row app-sidebar__row--indices app-sidebar__row--indices-split' +
                  (isStatsRoute ? ' app-sidebar__row--active' : '')
                }
                role="group"
                aria-label="Statistics"
                onMouseEnter={() => {
                  warmRoute(annualTo);
                  warmRoute(quarterlyTo);
                  warmRoute(monthlyTo);
                  warmRoute(weeklyTo);
                  warmRoute(dailyTo);
                }}
              >
                <NavLink
                  to={annualTo}
                  className="app-sidebar__indices-main"
                  onClick={() => {
                    setStatsOpen(true);
                    closeMobileSidebar();
                  }}
                  onFocus={() => {
                    warmRoute(annualTo);
                    warmRoute(quarterlyTo);
                    warmRoute(monthlyTo);
                    warmRoute(weeklyTo);
                    warmRoute(dailyTo);
                  }}
                  title="Open Statistics (annual returns)"
                >
                  <span className="app-sidebar__row-icon">
                    <IconBarChart />
                  </span>
                  <span className="app-sidebar__row-label">Statistics</span>
                </NavLink>
                <button
                  type="button"
                  className="app-sidebar__indices-chevron-btn"
                  aria-expanded={statsOpen}
                  aria-controls="app-sidebar-stats-options"
                  aria-label={statsOpen ? 'Collapse statistics submenu' : 'Expand statistics submenu'}
                  onClick={() => setStatsOpen((v) => !v)}
                >
                  <span
                    className={'app-sidebar__indices-chevron' + (statsOpen ? ' app-sidebar__indices-chevron--open' : '')}
                    aria-hidden
                  >
                    <IconChevronRight />
                  </span>
                </button>
              </div>
              {statsOpen ? (
                <div id="app-sidebar-stats-options" className="app-sidebar__subnav" role="group" aria-label="Statistics options">
                  <NavRow to={annualTo} icon={IconBarChart} label="Annual" active={annualPageActive} />
                  <NavRow
                    to={quarterlyTo}
                    icon={IconBarChart}
                    label="Quarterly"
                    active={quarterlyPageActive || statSection === 'quarterly'}
                  />
                  <NavRow to={monthlyTo} icon={IconBarChart} label="Monthly" active={monthlyPageActive || statSection === 'monthly'} />
                  <NavRow to={weeklyTo} icon={IconBarChart} label="Weekly" active={weeklyPageActive || statSection === 'weekly'} />
                  <NavRow to={dailyTo} icon={IconBarChart} label="Daily" active={dailyPageActive || statSection === 'daily'} />
                </div>
              ) : null}
              <div
                className={
                  'app-sidebar__row app-sidebar__row--indices app-sidebar__row--indices-split' +
                  (isRelativePerformanceRoute ? ' app-sidebar__row--active' : '')
                }
                role="group"
                aria-label="Relative performance"
                onMouseEnter={() => {
                  warmRoute(relativePerformanceTo);
                  warmRoute(returnTableTo);
                }}
              >
                <NavLink
                  to={relativePerformanceTo}
                  className="app-sidebar__indices-main"
                  onClick={() => {
                    setRelativePerformanceOpen(true);
                    closeMobileSidebar();
                  }}
                  onFocus={() => {
                    warmRoute(relativePerformanceTo);
                    warmRoute(returnTableTo);
                  }}
                  title="Open relative performance (opens menu)"
                >
                  <span className="app-sidebar__row-icon">
                    <IconLineChart />
                  </span>
                  <span className="app-sidebar__row-label">Relative performance</span>
                </NavLink>
                <button
                  type="button"
                  className="app-sidebar__indices-chevron-btn"
                  aria-expanded={relativePerformanceOpen}
                  aria-controls="app-sidebar-relative-performance-options"
                  aria-label={
                    relativePerformanceOpen
                      ? 'Collapse relative performance submenu'
                      : 'Expand relative performance submenu'
                  }
                  onClick={() => setRelativePerformanceOpen((v) => !v)}
                >
                  <span
                    className={
                      'app-sidebar__indices-chevron' +
                      (relativePerformanceOpen ? ' app-sidebar__indices-chevron--open' : '')
                    }
                    aria-hidden
                  >
                    <IconChevronRight />
                  </span>
                </button>
              </div>
              {relativePerformanceOpen ? (
                <div
                  id="app-sidebar-relative-performance-options"
                  className="app-sidebar__subnav"
                  role="group"
                  aria-label="Relative performance options"
                >
                  <NavRow to={returnTableTo} icon={IconDocSearch} label="Return table" active={isReturnTableRoute} />
                </div>
              ) : null}
              {/* <NavRow icon={IconFocus} label="Odin Index Signals" onClick={() => {}} /> */}
              {/* <NavRow to="/odin-signals" icon={IconFocus} label="Odin Signals" /> */}
              {/* <NavRow icon={IconWallet} label="Sample Odin Portfolios" onClick={() => {}} />
              <NavRow icon={IconMonitor} label="Odin Signals Performance" onClick={() => {}} /> */}
              <NavRow
                to={`/ticker-report/${DEFAULT_TICKER_ROUTE_SYMBOL.toLowerCase()}`}
                icon={IconCamera}
                label="Ticker reports"
                active={/^\/ticker-report\//i.test(location.pathname)}
              />
            </nav>
            <NavRow to="/stock-splits" icon={IconScissors} label="Stock Splits" />

            <div className="app-sidebar__section-label">Data</div>
            <nav className="app-sidebar__nav" aria-label="Data">
              <NavRow
                to={`/historical-data/${DEFAULT_TICKER_ROUTE_SYMBOL.toLowerCase()}`}
                icon={IconDocSearch}
                label="Historical data"
                active={/^\/historical-data\//i.test(location.pathname)}
              />
              {/* <NavRow icon={IconLineChart} label="Returns" onClick={() => {}} /> */}
              {/* <NavRow to="/statistic-data" icon={IconCamera} label="Statistic Table" /> */}
            </nav>

            {/* <div className="app-sidebar__section-label">Premium</div>
            <nav className="app-sidebar__nav" aria-label="Premium">
              <NavRow to="/premium" icon={IconBriefcase} label="Premium" />
            </nav> */}
          </div>
          <div className="app-sidebar__footer">
            <div className="header-util-wrap" ref={accountWrapRef}>
              <button
                type="button"
                className={'app-sidebar__account-btn' + (profileOpen ? ' app-sidebar__account-btn--active' : '')}
                aria-label="Profile"
                aria-expanded={profileOpen}
                onClick={toggleProfileMenu}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="header-avatar-image" aria-hidden />
                ) : (
                  <span className="header-avatar-placeholder">{initials}</span>
                )}
                <span className="app-sidebar__account-label">{profileName}</span>
                <span className="app-sidebar__account-chevron" aria-hidden>
                  <IconChevronRight />
                </span>
              </button>
              {profileMenuPop}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
