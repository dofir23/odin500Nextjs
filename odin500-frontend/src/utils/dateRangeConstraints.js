/**
 * Shared start/end date and year range rules:
 * - Dates: end must be strictly after start (end >= start + 1 day).
 * - Years: end must be >= start (same year allowed).
 */

/** @param {unknown} v @returns {string} YYYY-MM-DD or '' */
export function normalizeIsoDate(v) {
  const s = String(v ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** @param {unknown} v @returns {string} YYYY or '' */
export function normalizeYear(v) {
  const s = String(v ?? '').trim().slice(0, 4);
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? String(n) : '';
}

/** @param {string} iso @param {number} days @returns {string} */
export function isoAddDays(iso, days) {
  const s = normalizeIsoDate(iso);
  if (!s) return '';
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Earliest valid end date when start is set (start + 1 calendar day). */
export function minEndDateAfterStart(startIso) {
  return isoAddDays(normalizeIsoDate(startIso), 1);
}

/** Latest valid start date when end is set (end - 1 calendar day). */
export function maxStartDateBeforeEnd(endIso) {
  return isoAddDays(normalizeIsoDate(endIso), -1);
}

/**
 * @param {unknown} start
 * @param {unknown} end
 * @returns {{ start: string, end: string }}
 */
export function coerceDateRange(start, end) {
  const s = normalizeIsoDate(start);
  let e = normalizeIsoDate(end);
  if (s && e && e <= s) e = minEndDateAfterStart(s);
  return { start: s, end: e };
}

/**
 * @param {unknown} start
 * @param {unknown} end
 * @returns {{ start: string, end: string }}
 */
export function coerceYearRange(start, end) {
  let s = normalizeYear(start);
  let e = normalizeYear(end);
  if (s && e && Number(e) < Number(s)) e = s;
  return { start: s, end: e };
}

/**
 * @param {string} start
 * @param {string} end
 * @param {unknown} nextStart
 * @returns {{ start: string, end: string }}
 */
export function applyDateStartChange(start, end, nextStart) {
  return coerceDateRange(nextStart, end);
}

/**
 * @param {string} start
 * @param {string} end
 * @param {unknown} nextEnd
 * @returns {{ start: string, end: string }}
 */
export function applyDateEndChange(start, end, nextEnd) {
  return coerceDateRange(start, nextEnd);
}

/**
 * @param {string} start
 * @param {string} end
 * @param {unknown} nextStart
 * @returns {{ start: string, end: string }}
 */
export function applyYearStartChange(start, end, nextStart) {
  return coerceYearRange(nextStart, end);
}

/**
 * @param {string} start
 * @param {string} end
 * @param {unknown} nextEnd
 * @returns {{ start: string, end: string }}
 */
export function applyYearEndChange(start, end, nextEnd) {
  return coerceYearRange(start, nextEnd);
}

/**
 * @param {string} start
 * @param {string} end
 * @param {{ globalMin?: string, globalMax?: string }} [opts]
 */
export function dateInputBounds(start, end, opts = {}) {
  const s = normalizeIsoDate(start);
  const e = normalizeIsoDate(end);
  const globalMin = normalizeIsoDate(opts.globalMin);
  const globalMax = normalizeIsoDate(opts.globalMax);
  const startMax = e ? maxStartDateBeforeEnd(e) : '';
  const endMin = s ? minEndDateAfterStart(s) : '';
  return {
    startMin: globalMin || undefined,
    startMax: startMax || globalMax || undefined,
    endMin: endMin || globalMin || undefined,
    endMax: globalMax || undefined
  };
}

/**
 * @param {Array<{ id: string, label: string }>} allOptions
 * @param {unknown} endYear
 */
export function yearOptionsForStart(allOptions, endYear) {
  const endY = normalizeYear(endYear);
  const max = endY ? Number(endY) : null;
  return (allOptions || []).filter((o) => {
    if (!o?.id) return true;
    const y = Number(o.id);
    if (!Number.isFinite(y)) return true;
    return max == null || y <= max;
  });
}

/**
 * @param {Array<{ id: string, label: string }>} allOptions
 * @param {unknown} startYear
 */
export function yearOptionsForEnd(allOptions, startYear) {
  const startY = normalizeYear(startYear);
  const min = startY ? Number(startY) : null;
  return (allOptions || []).filter((o) => {
    if (!o?.id) return true;
    const y = Number(o.id);
    if (!Number.isFinite(y)) return true;
    return min == null || y >= min;
  });
}

/**
 * @param {number[]} years
 * @param {{ includeAll?: boolean }} [opts]
 * @returns {Array<{ id: string, label: string }>}
 */
export function buildYearDropdownOptions(years, opts = {}) {
  const { includeAll = false } = opts;
  const sorted = [...new Set(years.map((y) => Number(y)).filter(Number.isFinite))].sort((a, b) => b - a);
  const out = sorted.map((y) => ({ id: String(y), label: String(y) }));
  return includeAll ? [{ id: '', label: 'All' }, ...out] : out;
}
