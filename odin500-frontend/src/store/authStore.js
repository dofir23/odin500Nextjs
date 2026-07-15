'use client';

import { create } from 'zustand';
import { getAuthToken, isAuthHydrated } from './apiStore.js';

/**
 * Auth UI surface synced from apiStore token + hydration events.
 * Tokens/cookies stay in apiStore; this store is for reactive React consumers.
 */
export const useAuthStore = create((set) => ({
  hydrated: typeof window !== 'undefined' ? isAuthHydrated() : false,
  isLoggedIn: typeof window !== 'undefined' ? Boolean(getAuthToken()) : false,
  authVersion: 0,

  sync: () => {
    set({
      hydrated: isAuthHydrated() || useAuthStore.getState().hydrated,
      isLoggedIn: Boolean(getAuthToken())
    });
  },

  markHydrated: () => {
    set({
      hydrated: true,
      isLoggedIn: Boolean(getAuthToken())
    });
  },

  bumpAuthVersion: () => set((s) => ({ authVersion: s.authVersion + 1 }))
}));

function bindAuthStoreListeners() {
  if (typeof window === 'undefined') return;
  const onUpdated = () => {
    useAuthStore.getState().sync();
    useAuthStore.getState().bumpAuthVersion();
  };
  const onHydrated = () => {
    useAuthStore.getState().markHydrated();
    useAuthStore.getState().sync();
  };
  window.addEventListener('odin-auth-updated', onUpdated);
  window.addEventListener('odin-auth-hydrated', onHydrated);
  queueMicrotask(() => {
    useAuthStore.getState().sync();
    if (isAuthHydrated()) useAuthStore.getState().markHydrated();
  });
}

bindAuthStoreListeners();
