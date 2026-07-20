/**
 * Client-side sort helpers for the public portfolios table.
 */

export const PUBLIC_PORTFOLIO_SORT_KEYS = [
  'avg_monthly_return_pct',
  'total_return_pct',
  'equity',
  'positions_count',
  'published_at'
];

/**
 * @param {object[]} portfolios
 * @param {string} sortKey
 * @param {'asc'|'desc'} sortDir
 */
export function sortPublicPortfolios(portfolios, sortKey, sortDir = 'desc') {
  const key = PUBLIC_PORTFOLIO_SORT_KEYS.includes(sortKey) ? sortKey : 'avg_monthly_return_pct';
  const dir = sortDir === 'asc' ? 1 : -1;
  const list = [...(portfolios || [])];

  list.sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];

    if (key === 'published_at') {
      const am = Date.parse(String(av || ''));
      const bm = Date.parse(String(bv || ''));
      const aOk = Number.isFinite(am);
      const bOk = Number.isFinite(bm);
      if (!aOk && !bOk) return 0;
      if (!aOk) return 1;
      if (!bOk) return -1;
      return (am - bm) * dir;
    }

    const an = av == null || av === '' ? null : Number(av);
    const bn = bv == null || bv === '' ? null : Number(bv);
    const aOk = an != null && Number.isFinite(an);
    const bOk = bn != null && Number.isFinite(bn);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    if (an === bn) return 0;
    return an < bn ? -1 * dir : 1 * dir;
  });

  return list;
}
