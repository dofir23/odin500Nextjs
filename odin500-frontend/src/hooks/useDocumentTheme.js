'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  applyDocumentTheme,
  getDocumentTheme,
  getServerDocumentTheme,
  subscribeDocumentTheme
} from '../utils/documentTheme.js';

function readPreferredTheme() {
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
  const theme = useSyncExternalStore(
    subscribeDocumentTheme,
    getDocumentTheme,
    getServerDocumentTheme
  );

  useEffect(() => {
    const preferred = readPreferredTheme();
    if (getDocumentTheme() !== preferred) {
      applyDocumentTheme(preferred);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyDocumentTheme(getDocumentTheme() === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggleTheme };
}
