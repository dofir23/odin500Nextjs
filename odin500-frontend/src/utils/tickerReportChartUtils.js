/** Safe teardown — lightweight-charts throws if listeners attach after remove. */
export function detachTickerReportChart(chart, timeScale, onRange) {
  if (timeScale && onRange) {
    try {
      timeScale.unsubscribeVisibleLogicalRangeChange(onRange);
    } catch {
      /* chart already removed */
    }
    try {
      timeScale.unsubscribeVisibleTimeRangeChange(onRange);
    } catch {
      /* chart already removed */
    }
  }
  if (chart) {
    try {
      chart.remove();
    } catch {
      /* already removed */
    }
  }
}

/** Safe subscribe for time-scale range callbacks. */
export function subscribeTickerReportTimeScale(timeScale, onRange) {
  if (!timeScale || typeof onRange !== 'function') return;
  try {
    timeScale.subscribeVisibleLogicalRangeChange(onRange);
    timeScale.subscribeVisibleTimeRangeChange(onRange);
  } catch {
    /* time scale not ready */
  }
}
