'use client';

import { useCallback, useEffect } from 'react';
import { usePrefsStore } from '../store/prefsStore.js';
import { applyDocumentTheme, getDocumentTheme } from '../utils/documentTheme.js';

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

export function useDocumentTheme() {
  const theme = usePrefsStore((s) => s.theme);
  const setTheme = usePrefsStore((s) => s.setTheme);
  const toggleThemeInStore = usePrefsStore((s) => s.toggleTheme);

  useEffect(() => {
    const preferred = usePrefsStore.getState().theme || readLegacyTheme();
    if (getDocumentTheme() !== preferred) {
      applyDocumentTheme(preferred);
    }
    if (usePrefsStore.getState().theme !== preferred) {
      usePrefsStore.setState({ theme: preferred });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    toggleThemeInStore();
  }, [toggleThemeInStore]);

  return { theme, toggleTheme, setTheme };
}
