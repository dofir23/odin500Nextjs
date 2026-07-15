'use client';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { useUiStore } from '../store/uiStore.js';

/** @typedef {'watchlist' | 'news' | 'market-movers' | 'notifications'} RightRailDockPanel */

/**
 * Thin shell for router-driven dock open; panel state lives in uiStore.
 */
export function WatchlistDockProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = () => useUiStore.getState().openWatchlist();
    window.addEventListener('ticker:open-watchlist', onOpen);
    return () => window.removeEventListener('ticker:open-watchlist', onOpen);
  }, []);

  useEffect(() => {
    const st = location.state && /** @type {{ openWatchlist?: boolean }} */ (location.state).openWatchlist;
    if (!st) return;
    useUiStore.getState().openWatchlist();
    const rest = { ...(location.state || {}) };
    delete rest.openWatchlist;
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: Object.keys(rest).length ? rest : undefined }
    );
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  return children;
}

export function useRightRailDock() {
  const activePanel = useUiStore((s) => s.activeDockPanel);
  const openWatchlist = useUiStore((s) => s.openWatchlist);
  const toggleWatchlist = useUiStore((s) => s.toggleWatchlist);
  const toggleNews = useUiStore((s) => s.toggleNews);
  const toggleMarketMovers = useUiStore((s) => s.toggleMarketMovers);
  const toggleNotifications = useUiStore((s) => s.toggleNotifications);
  const close = useUiStore((s) => s.closeDock);

  return useMemo(
    () => ({
      activePanel,
      isDockOpen: activePanel !== null,
      openWatchlist,
      toggleWatchlist,
      toggleNews,
      toggleMarketMovers,
      toggleNotifications,
      close
    }),
    [
      activePanel,
      openWatchlist,
      toggleWatchlist,
      toggleNews,
      toggleMarketMovers,
      toggleNotifications,
      close
    ]
  );
}

/** @typedef {{ isOpen: boolean, open: () => void, close: () => void, toggle: () => void }} WatchlistDockCompat */

export function useWatchlistDock() {
  const d = useRightRailDock();
  return useMemo(
    () => ({
      isOpen: d.activePanel === 'watchlist',
      open: d.openWatchlist,
      close: d.close,
      toggle: d.toggleWatchlist
    }),
    [d.activePanel, d.openWatchlist, d.close, d.toggleWatchlist]
  );
}

/**
 * When true, returns charts and related toolbars use the single “Filters” trigger; the
 * panel holds dropdowns and actions. Always true so desktop matches narrow/docked layouts.
 */
export function useReturnsChartFiltersMenuMode() {
  return true;
}
