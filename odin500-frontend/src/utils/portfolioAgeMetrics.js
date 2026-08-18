/**
 * Age-normalised portfolio metrics.
 *
 * Mirrors `computeAvgMonthlyReturn` in odin500-backend/services/paper/publicPortfolio.js — the
 * public leaderboard gets its column from the backend while the summary card computes its own,
 * so the two constants below must stay in sync or the same portfolio shows two different figures.
 */

/** Average calendar days per month, so age normalisation is fair across portfolios. */
const DAYS_PER_MONTH = 30.4375;

/**
 * A book younger than this has no meaningful monthly rate — dividing a few days of return by a
 * fraction of a month extrapolates wildly (11 days at +7.5% reads as +21%/month). Below the
 * threshold the figure is withheld entirely and the UI shows N/A.
 */
const MIN_MONTHS_FOR_AVG = 1;

/**
 * Total return normalised into an average monthly %, measured from when the portfolio was
 * created rather than when it was published — an owner who traded for months before publishing
 * has a track record that long, and dating it from publication overstates the monthly rate.
 *
 * @param {number|null|undefined} totalReturnPct
 * @param {string|null|undefined} startIso Portfolio creation timestamp.
 * @returns {{ monthsElapsed: number|null, daysElapsed: number|null, avgMonthlyReturnPct: number|null }}
 */
export function computeAvgMonthlyReturn(totalReturnPct, startIso) {
  const startMs = Date.parse(String(startIso || ''));
  if (!Number.isFinite(startMs)) {
    return { monthsElapsed: null, daysElapsed: null, avgMonthlyReturnPct: null };
  }

  const days = Math.max(0, (Date.now() - startMs) / 86400000);
  const months = days / DAYS_PER_MONTH;
  const total = Number(totalReturnPct);
  const base = {
    monthsElapsed: Math.round(months * 100) / 100,
    daysElapsed: Math.round(days * 10) / 10
  };

  if (!Number.isFinite(total) || months < MIN_MONTHS_FOR_AVG) {
    return { ...base, avgMonthlyReturnPct: null };
  }
  return { ...base, avgMonthlyReturnPct: Math.round((total / months) * 100) / 100 };
}

/** Explains the N/A rather than leaving the reader guessing whether it is a bug. */
export function avgMonthlyUnavailableReason(daysElapsed) {
  if (daysElapsed == null) return 'Needs a creation date before an average can be calculated';
  return `Created ${Math.round(daysElapsed)} day${Math.round(daysElapsed) === 1 ? '' : 's'} ago — needs a full month before a monthly average is meaningful`;
}
