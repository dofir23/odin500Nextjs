'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { getChartComparisonColors } from '../utils/chartComparisonTheme.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';

/** Theme-aware axis, grid, and bar-label colors for Chart.js comparison charts. */
export function useChartComparisonColors() {
  const theme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  return useMemo(() => getChartComparisonColors(theme), [theme]);
}
