'use client';
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { useProductTour } from '../engagement/useProductTour.js';
import { PAPER_STRATEGY_MANAGE_ANCHORS, waitForTourSelectors } from '../engagement/tourAnchors.js';
import { TOUR_IDS } from '../engagement/tourStorage.js';

const ProductTourContext = createContext(null);

export function ProductTourProvider({ children }) {
  const { startTour } = useProductTour();
  const prepareManageRef = useRef(null);

  const registerManageTourPrepare = useCallback((fn) => {
    prepareManageRef.current = fn;
  }, []);

  const startPaperStrategyManageTour = useCallback(
    async (opts = {}) => {
      prepareManageRef.current?.();

      const ready = await waitForTourSelectors(PAPER_STRATEGY_MANAGE_ANCHORS, {
        timeoutMs: opts.timeoutMs ?? 12000
      });
      if (!ready) {
        opts.onDestroyed?.({ reason: 'no-anchors' });
        return false;
      }

      window.requestAnimationFrame(() => {
        document
          .querySelector('[data-tour="paper-strategy-panel-intro"]')
          ?.scrollIntoView({ behavior: 'auto', block: 'start' });
        window.setTimeout(() => startTour(TOUR_IDS.PAPER_STRATEGY_MANAGE, opts), 200);
      });
      return true;
    },
    [startTour]
  );

  const value = useMemo(
    () => ({
      startPaperStrategyManageTour,
      registerManageTourPrepare
    }),
    [startPaperStrategyManageTour, registerManageTourPrepare]
  );

  return <ProductTourContext.Provider value={value}>{children}</ProductTourContext.Provider>;
}

export function useProductTourContext() {
  const ctx = useContext(ProductTourContext);
  if (!ctx) throw new Error('useProductTourContext must be used within ProductTourProvider');
  return ctx;
}
