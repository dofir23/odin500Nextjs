'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const LEGACY_ACCOUNT_KEY = 'paper.activeAccountId';

function readLegacyAccountId() {
  try {
    return window.localStorage.getItem(LEGACY_ACCOUNT_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Shared paper-trading session (active account + light strategy flag).
 * Position/order tables stay in hooks; this avoids prop-drill of account id.
 */
export const usePaperSessionStore = create(
  persist(
    (set, get) => ({
      activeAccountId: '',
      /** @type {Array<{ id: string, name?: string }>} */
      accounts: [],
      strategyActive: false,

      setActiveAccountId: (id) => {
        const next = String(id || '');
        set({ activeAccountId: next });
        try {
          if (next) window.localStorage.setItem(LEGACY_ACCOUNT_KEY, next);
          else window.localStorage.removeItem(LEGACY_ACCOUNT_KEY);
        } catch {
          /* ignore */
        }
      },

      setAccounts: (accounts) => set({ accounts: Array.isArray(accounts) ? accounts : [] }),

      setStrategyActive: (v) => set({ strategyActive: Boolean(v) }),

      clearPaperSession: () => {
        set({ activeAccountId: '', accounts: [], strategyActive: false });
        try {
          window.localStorage.removeItem(LEGACY_ACCOUNT_KEY);
        } catch {
          /* ignore */
        }
      },

      /** Migrate legacy key once if persist store has no id yet. */
      ensureActiveAccountId: () => {
        if (get().activeAccountId) return get().activeAccountId;
        const legacy = typeof window !== 'undefined' ? readLegacyAccountId() : '';
        if (legacy) {
          get().setActiveAccountId(legacy);
          return legacy;
        }
        return '';
      }
    }),
    {
      name: 'odin-paper-session',
      partialize: (s) => ({ activeAccountId: s.activeAccountId }),
      onRehydrateStorage: () => (state) => {
        if (!state?.activeAccountId && typeof window !== 'undefined') {
          const legacy = readLegacyAccountId();
          if (legacy) {
            usePaperSessionStore.setState({ activeAccountId: legacy });
          }
        }
      }
    }
  )
);
