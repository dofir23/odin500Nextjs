'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from '@/navigation/appRouterCompat.jsx';
import { fetchJsonCached, getAuthToken, isAuthDisabled } from '../store/apiStore.js';
import { warmWatchlistDefaults } from '../hooks/useWatchlistDefaults.js';
import { useDocumentTheme } from '../hooks/useDocumentTheme.js';
import { useRightRailDock } from '../context/WatchlistDockContext.jsx';
import { AppMainTopBar } from './AppMainTopBar.jsx';
import { AppSidebar } from './AppSidebar.jsx';
import { AppRightRail } from './AppRightRail.jsx';
import { WatchlistRailFlyout } from './WatchlistRailFlyout.jsx';
import { NewsRailFlyout } from './NewsRailFlyout.jsx';
import { NotificationsRailFlyout } from './NotificationsRailFlyout.jsx';
import { MarketMoversRailFlyout } from './MarketMoversRailFlyout.jsx';
import { notifyChartFullscreenLayout } from '../utils/chartFullscreenLayout.js';
import { RouteNavigationGate } from './RouteNavigationGate.jsx';

function ProtectedLayoutShell({ children, serverNav = null }) {
  const location = useLocation();
  const { activePanel, isDockOpen, close: closeRightDock } = useRightRailDock();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { theme, toggleTheme } = useDocumentTheme();
  const mainScrollRef = useRef(null);
  const sidebarLayoutReadyRef = useRef(false);

  useEffect(() => {
    const warmWatchlistCache = () => {
      const ttlMs = 2 * 60 * 1000;
      const tasks = [warmWatchlistDefaults(ttlMs)];
      if (getAuthToken()) {
        tasks.push(fetchJsonCached({ path: '/api/watchlists', auth: true, ttlMs }));
      } else if (!isAuthDisabled()) {
        return;
      }
      void Promise.all(tasks).catch(() => {});
    };
    warmWatchlistCache();
    window.addEventListener('odin-auth-updated', warmWatchlistCache);
    return () => window.removeEventListener('odin-auth-updated', warmWatchlistCache);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const next = window.innerWidth <= 900;
      setIsMobile((prev) => (prev === next ? prev : next));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileLeftOpen(false);
      setMobileRightOpen(false);
      return;
    }
    setSidebarExpanded(false);
  }, [isMobile]);

  useEffect(() => {
    if (!sidebarLayoutReadyRef.current) {
      sidebarLayoutReadyRef.current = true;
      return;
    }
    if (isMobile) return;
    const t = window.setTimeout(() => notifyChartFullscreenLayout(), 280);
    return () => window.clearTimeout(t);
  }, [sidebarExpanded, isMobile]);

  useEffect(() => {
    const scroller = mainScrollRef.current;
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [location.pathname]);

  const closeMobileOverlays = () => {
    setMobileLeftOpen(false);
    setMobileRightOpen(false);
  };

  const closeMobileLeftSidebar = useCallback(() => {
    setMobileLeftOpen(false);
  }, []);

  const closeMobileRightRail = useCallback(() => {
    setMobileRightOpen(false);
  }, []);

  return (
    <div className={'app-shell' + (serverNav ? ' app-shell--ssr-chrome' : '')}>
      {serverNav}
      <div className="app-body">
        {isMobile && (mobileLeftOpen || mobileRightOpen || isDockOpen) ? (
          <button
            type="button"
            className="app-mobile-overlay-backdrop"
            aria-label="Close side panels"
            onClick={() => {
              closeMobileOverlays();
              if (isDockOpen) closeRightDock();
            }}
          />
        ) : null}
        <AppSidebar
          expanded={sidebarExpanded}
          setExpanded={setSidebarExpanded}
          mobileOpen={isMobile && mobileLeftOpen}
          onRequestClose={closeMobileLeftSidebar}
        />
        <div className={'app-main-column' + (isDockOpen ? ' app-main-column--watchlist-open' : '')}>
          <AppMainTopBar
            theme={theme}
            onToggleTheme={toggleTheme}
            isMobile={isMobile}
            mobileNavOpen={mobileLeftOpen}
            onToggleMobileNav={() => {
              setMobileRightOpen(false);
              setMobileLeftOpen((v) => !v);
            }}
          />
          <div className="app-main-after-topbar">
            <div className="app-main-scroll" ref={mainScrollRef}>
              <main id="app-main-content">
                <RouteNavigationGate>
                  {children}
                </RouteNavigationGate>
              </main>
            </div>
            {isDockOpen && isMobile ? (
              <button
                type="button"
                className="app-watchlist-dock-backdrop"
                aria-label="Close panel"
                onClick={closeRightDock}
              />
            ) : null}
            {activePanel === 'watchlist' ? (
              <aside className="app-watchlist-dock is-open" aria-label="Watchlist sidebar">
                <WatchlistRailFlyout open onClose={closeRightDock} docked />
              </aside>
            ) : null}
            {activePanel === 'news' ? (
              <aside className="app-watchlist-dock is-open" aria-label="Top news">
                <NewsRailFlyout open onClose={closeRightDock} docked />
              </aside>
            ) : null}
            {activePanel === 'market-movers' ? (
              <aside className="app-watchlist-dock is-open" aria-label="Market movers">
                <MarketMoversRailFlyout open onClose={closeRightDock} docked />
              </aside>
            ) : null}
            {activePanel === 'notifications' ? (
              <aside className="app-watchlist-dock is-open" aria-label="Notifications">
                <NotificationsRailFlyout open onClose={closeRightDock} docked />
              </aside>
            ) : null}
          </div>
        </div>
        <AppRightRail mobileOpen={isMobile && mobileRightOpen} onRequestClose={closeMobileRightRail} />
      </div>
    </div>
  );
}

/**
 * @param {{ children: import('react').ReactNode, serverNav?: import('react').ReactNode | null }} props
 */
export default function ProtectedLayout({ children, serverNav = null }) {
  return <ProtectedLayoutShell serverNav={serverNav}>{children}</ProtectedLayoutShell>;
}
