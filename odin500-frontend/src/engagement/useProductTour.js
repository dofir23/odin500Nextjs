'use client';
import { useCallback, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { markTourCompleted, markTourSkipped } from './tourStorage.js';
import { buildPaperStrategyManageSteps } from './tourDefinitions/paperStrategyManageTour.js';
import { TOUR_IDS } from './tourStorage.js';

function themePopoverClass() {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  return light ? 'odin-tour-popover odin-tour-popover--light' : 'odin-tour-popover';
}

function filterExistingSteps(steps) {
  return steps.filter((step) => {
    if (!step.element) return true;
    try {
      return Boolean(document.querySelector(step.element));
    } catch {
      return false;
    }
  });
}

function stepsForTourId(tourId) {
  if (tourId === TOUR_IDS.PAPER_STRATEGY_MANAGE) return buildPaperStrategyManageSteps();
  return [];
}

function isBlotterTabsTarget(el) {
  if (!(el instanceof Element)) return false;
  return (
    el.matches('[data-tour="paper-blotter-tabs-row"]') ||
    Boolean(el.closest('[data-tour="paper-blotter-tabs-row"]'))
  );
}

function refreshPopoverAfterScroll(driverInstance, delays = [400, 850]) {
  for (const ms of delays) {
    window.setTimeout(() => driverInstance?.refresh?.(), ms);
  }
}

export function useProductTour() {
  const driverRef = useRef(null);
  const tourIdRef = useRef(null);
  const stepCountRef = useRef(0);
  const lastIndexRef = useRef(0);

  const destroy = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
    tourIdRef.current = null;
    stepCountRef.current = 0;
    lastIndexRef.current = 0;
    document.documentElement.classList.remove('product-tour-active');
  }, []);

  const startTour = useCallback(
    (tourId, { onDestroyed } = {}) => {
      destroy();
      const steps = filterExistingSteps(stepsForTourId(tourId));
      if (!steps.length) {
        onDestroyed?.({ reason: 'no-steps' });
        return false;
      }

      tourIdRef.current = tourId;
      stepCountRef.current = steps.length;
      lastIndexRef.current = 0;
      document.documentElement.classList.add('product-tour-active');

      const d = driver({
        showProgress: true,
        animate: true,
        smoothScroll: false,
        allowClose: true,
        overlayClickBehavior: () => {},
        disableActiveInteraction: true,
        overlayOpacity: 0.55,
        stagePadding: 8,
        stageRadius: 10,
        popoverOffset: 16,
        popoverClass: themePopoverClass(),
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        steps,
        onHighlightStarted: (el, _step, { driver: tourDriver }) => {
          if (!(el instanceof Element)) return;
          if (isBlotterTabsTarget(el)) {
            const row = el.matches('[data-tour="paper-blotter-tabs-row"]')
              ? el
              : el.closest('[data-tour="paper-blotter-tabs-row"]');
            row?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
            refreshPopoverAfterScroll(tourDriver);
          }
        },
        onHighlighted: (el, _step, { state, driver: tourDriver }) => {
          if (typeof state.activeIndex === 'number') lastIndexRef.current = state.activeIndex;
          if (!(el instanceof Element)) return;
          if (isBlotterTabsTarget(el)) {
            refreshPopoverAfterScroll(tourDriver, [150, 500]);
          }
        },
        onDestroyed: () => {
          const id = tourIdRef.current;
          const finished = lastIndexRef.current >= stepCountRef.current - 1;
          if (id) {
            if (finished) markTourCompleted(id);
            else markTourSkipped(id);
          }
          const reason = finished ? 'completed' : 'skipped';
          destroy();
          onDestroyed?.({ reason });
        }
      });

      driverRef.current = d;
      d.drive();
      return true;
    },
    [destroy]
  );

  return { startTour };
}
