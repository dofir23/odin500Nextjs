/** Matches backend default PAPER_STRATEGY_INTERVAL_MS (1 hour). */
export const STRATEGY_CHECK_INTERVAL_MS = 3_600_000;

export const STRATEGY_SCHEDULE_HELP =
  'Your rules are checked automatically about every hour while automation is active. Timing follows the server schedule — not tied to when you save.';

/**
 * @param {string|Date|null|undefined} lastRunAt
 * @param {number} [nowMs]
 * @returns {string}
 */
export function formatNextStrategyCheck(lastRunAt, nowMs = Date.now()) {
  if (!lastRunAt) return 'within ~1 hour';
  const last = new Date(lastRunAt).getTime();
  if (!Number.isFinite(last)) return 'within ~1 hour';

  let next = last + STRATEGY_CHECK_INTERVAL_MS;
  while (next <= nowMs) {
    next += STRATEGY_CHECK_INTERVAL_MS;
  }

  const diffMs = next - nowMs;
  const mins = Math.max(1, Math.ceil(diffMs / 60_000));
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return `${hrs} hr${hrs === 1 ? '' : 's'}`;
  return `${hrs} hr ${rem} min`;
}
