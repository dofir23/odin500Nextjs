'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyDocumentTheme } from '../utils/documentTheme.js';

function readLegacyTheme() {
  try {
    const saved = localStorage.getItem('odin_theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

/**
 * Lightweight persisted prefs (theme, last ticker chart timeframe).
 */
export const usePrefsStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      tickerChartTimeframe: '1Y',

      setTheme: (theme) => {
        const next = theme === 'light' ? 'light' : 'dark';
        applyDocumentTheme(next);
        set({ theme: next });
      },

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        applyDocumentTheme(next);
        set({ theme: next });
      },

      setTickerChartTimeframe: (tf) => {
        const next = String(tf || '1Y').trim() || '1Y';
        set({ tickerChartTimeframe: next });
      },

      /** One-shot migrate from legacy odin_theme key into store. */
      hydrateThemeFromLegacy: () => {
        if (get().theme) {
          const preferred = get().theme || readLegacyTheme();
          applyDocumentTheme(preferred);
          if (get().theme !== preferred) set({ theme: preferred });
        }
      }
    }),
    {
      name: 'odin-prefs',
      partialize: (s) => ({
        theme: s.theme,
        tickerChartTimeframe: s.tickerChartTimeframe
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const theme = state.theme === 'light' || state.theme === 'dark' ? state.theme : readLegacyTheme();
        applyDocumentTheme(theme);
        if (state.theme !== theme) {
          usePrefsStore.setState({ theme });
        }
      }
    }
  )
);
