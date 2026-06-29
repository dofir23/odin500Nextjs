/** Selectors required before the paper strategy manage tour can start. */
export const PAPER_STRATEGY_MANAGE_ANCHORS = [
  '[data-tour="paper-strategy-panel-intro"]',
  '[data-tour="paper-strategy-controls"]',
  '[data-tour="paper-strategy-watchlist"]',
  '[data-tour="paper-strategy-rules"]',
  '[data-tour="paper-strategy-log"]',
  '[data-tour="paper-blotter-tabs-row"]'
];

/**
 * Poll until every selector matches an element in the document.
 * @returns {Promise<boolean>} true when all anchors exist
 */
export function waitForTourSelectors(selectors, { timeoutMs = 10000, intervalMs = 80 } = {}) {
  const list = Array.isArray(selectors) ? selectors : [];
  if (!list.length) return Promise.resolve(true);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    const tick = () => {
      const ready = list.every((sel) => {
        try {
          return Boolean(document.querySelector(sel));
        } catch {
          return false;
        }
      });
      if (ready) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, intervalMs);
    };

    tick();
  });
}
