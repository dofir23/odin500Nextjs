const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function roundPct(v) {
  return Math.round(v * 10) / 10;
}

/**
 * Build seasonality heatmap data from monthly return rows (`period` like `2024-03`, `totalReturn` pct).
 * @param {unknown[]} monthlyReturns
 * @param {{ maxYears?: number, avgYears?: number }} [opts]
 */
export function buildMonthlySeasonality(monthlyReturns, opts = {}) {
  const maxYears = opts.maxYears ?? 6;
  const avgYearsCount = opts.avgYears ?? 3;
  if (!Array.isArray(monthlyReturns) || !monthlyReturns.length) return null;

  /** @type {Map<string, number>} */
  const byYearMonth = new Map();

  for (const r of monthlyReturns) {
    const m = String(r?.period || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) continue;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) continue;
    const tr = Number(r.totalReturn);
    if (!Number.isFinite(tr)) continue;
    byYearMonth.set(`${year}-${String(month).padStart(2, '0')}`, tr);
  }

  if (!byYearMonth.size) return null;

  const allYears = [
    ...new Set([...byYearMonth.keys()].map((k) => Number(k.split('-')[0])))
  ].sort((a, b) => a - b);
  const years = allYears.slice(-maxYears);

  /** @type {Record<string, (number|null)[]>} */
  const cells = {};
  for (const y of years) {
    cells[String(y)] = Array.from({ length: 12 }, (_, i) => {
      const key = `${y}-${String(i + 1).padStart(2, '0')}`;
      return byYearMonth.has(key) ? roundPct(byYearMonth.get(key)) : null;
    });
  }

  const avgYears = years.slice(-avgYearsCount);
  const averages = Array.from({ length: 12 }, (_, i) => {
    const vals = avgYears
      .map((y) => byYearMonth.get(`${y}-${String(i + 1).padStart(2, '0')}`))
      .filter((v) => Number.isFinite(v));
    if (!vals.length) return 0;
    return roundPct(vals.reduce((sum, v) => sum + v, 0) / vals.length);
  });

  return { years, months: MONTH_LABELS, cells, averages };
}
