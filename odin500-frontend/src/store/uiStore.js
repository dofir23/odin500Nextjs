'use client';

import { create } from 'zustand';
import { getAuthToken } from './apiStore.js';
import { GUEST_AUTH_ENTRY_PATHS, buildAuthEntryUrl } from '../utils/authRedirect.js';

/** @typedef {'watchlist' | 'news' | 'market-movers' | 'notifications'} RightRailDockPanel */

/**
 * Cross-route UI: login gate modal + right-rail dock.
 * Navigation callbacks are registered by LoginGateProvider / WatchlistDockProvider.
 */
export const useUiStore = create((set, get) => ({
  loginModalOpen: false,
  /** @type {(() => void) | null} */
  _loginDismiss: null,
  /** @type {string | null} */
  _loginReturnTo: null,
  /** @type {((path: string) => void) | null} */
  _authNavigate: null,

  /** @type {RightRailDockPanel | null} */
  activeDockPanel: null,
  /** @type {((action: () => void) => boolean) | null} */
  _requireLoginFn: null,

  setAuthNavigate: (fn) => set({ _authNavigate: typeof fn === 'function' ? fn : null }),

  setRequireLoginFn: (fn) => set({ _requireLoginFn: typeof fn === 'function' ? fn : null }),

  clearLoginGateOnAuthPath: (pathname) => {
    if (GUEST_AUTH_ENTRY_PATHS.has(pathname)) {
      set({ loginModalOpen: false, _loginDismiss: null, _loginReturnTo: null });
    }
  },

  closeLoginIfLoggedIn: () => {
    if (get().loginModalOpen && Boolean(getAuthToken())) {
      set({ loginModalOpen: false, _loginDismiss: null, _loginReturnTo: null });
    }
  },

  resolveReturnTo: () => {
    const explicit = get()._loginReturnTo;
    if (explicit && explicit.startsWith('/')) return explicit;
    if (typeof window === 'undefined') return '/market';
    const current = window.location.pathname + window.location.search;
    if (current.startsWith('/') && !GUEST_AUTH_ENTRY_PATHS.has(current.split('?')[0])) {
      return current;
    }
    return '/market';
  },

  /** @param {{ onDismiss?: () => void, returnTo?: string }} [opts] */
  showLoginRequired: (opts, pathname) => {
    if (Boolean(getAuthToken())) return;
    const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (GUEST_AUTH_ENTRY_PATHS.has(path)) return;
    set({
      loginModalOpen: true,
      _loginDismiss: typeof opts?.onDismiss === 'function' ? opts.onDismiss : null,
      _loginReturnTo:
        typeof opts?.returnTo === 'string' && opts.returnTo.startsWith('/') ? opts.returnTo : null
    });
  },

  closeLoginRequired: () => {
    const onDismiss = get()._loginDismiss;
    set({ loginModalOpen: false, _loginDismiss: null });
    if (typeof onDismiss === 'function') onDismiss();
  },

  requireLogin: (onAllowed, pathname) => {
    if (Boolean(getAuthToken())) {
      if (typeof onAllowed === 'function') onAllowed();
      return true;
    }
    const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (GUEST_AUTH_ENTRY_PATHS.has(path)) return false;
    set({ loginModalOpen: true });
    return false;
  },

  goLogin: () => {
    const dest = buildAuthEntryUrl('/login', get().resolveReturnTo());
    set({ loginModalOpen: false, _loginDismiss: null, _loginReturnTo: null });
    const nav = get()._authNavigate;
    if (nav) nav(dest);
    else if (typeof window !== 'undefined') window.location.assign(dest);
  },

  goSignup: () => {
    const dest = buildAuthEntryUrl('/signup', get().resolveReturnTo());
    set({ loginModalOpen: false, _loginDismiss: null, _loginReturnTo: null });
    const nav = get()._authNavigate;
    if (nav) nav(dest);
    else if (typeof window !== 'undefined') window.location.assign(dest);
  },

  setActiveDockPanel: (panel) => set({ activeDockPanel: panel }),

  closeDock: () => {
    try {
      sessionStorage.removeItem('ticker_open_watchlist');
      sessionStorage.removeItem('watchlist_add_symbol');
    } catch {
      /* ignore */
    }
    set({ activeDockPanel: null });
  },

  openWatchlist: () => {
    const requireLogin = get()._requireLoginFn || ((action) => get().requireLogin(action));
    requireLogin(() => set({ activeDockPanel: 'watchlist' }));
  },

  toggleWatchlist: () => {
    const requireLogin = get()._requireLoginFn || ((action) => get().requireLogin(action));
    requireLogin(() =>
      set((s) => ({ activeDockPanel: s.activeDockPanel === 'watchlist' ? null : 'watchlist' }))
    );
  },

  toggleNews: () =>
    set((s) => ({ activeDockPanel: s.activeDockPanel === 'news' ? null : 'news' })),

  toggleMarketMovers: () =>
    set((s) => ({
      activeDockPanel: s.activeDockPanel === 'market-movers' ? null : 'market-movers'
    })),

  toggleNotifications: () => {
    const requireLogin = get()._requireLoginFn || ((action) => get().requireLogin(action));
    requireLogin(() =>
      set((s) => ({
        activeDockPanel: s.activeDockPanel === 'notifications' ? null : 'notifications'
      }))
    );
  }
}));
