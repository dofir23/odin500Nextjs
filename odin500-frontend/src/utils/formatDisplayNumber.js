/** Site-wide display: one decimal, en-US grouping (e.g. 10333.44 → 10,333.4). */

export const DISPLAY_DECIMAL_PLACES = 1;

export function isDisplayableNumber(v) {
  return v != null && Number.isFinite(Number(v));
}

/**
 * @param {number|null|undefined} v
 * @param {object} [options]
 * @param {number} [options.decimals=1]
 * @param {boolean} [options.signed=false]
 * @param {boolean} [options.plusOnPositive]
 * @param {string} [options.suffix='']
 * @param {string} [options.empty='—']
 */
export function fmtNumber(v, options = {}) {
  const {
    decimals = DISPLAY_DECIMAL_PLACES,
    signed = false,
    plusOnPositive = signed,
    suffix = '',
    empty = '—',
    locale = 'en-US'
  } = options;
  if (!isDisplayableNumber(v)) return empty;
  const n = Number(v);
  const body = Math.abs(n).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  let core;
  if (signed || plusOnPositive) {
    if (n < 0) core = `-${body}`;
    else if (n > 0 && plusOnPositive) core = `+${body}`;
    else core = body;
  } else {
    core = n < 0 ? `-${body}` : body;
  }
  return `${core}${suffix}`;
}

/** Percent; default signed with + on positives. Pass `plainPositive: true` to omit +. */
export function fmtPct(v, options = {}) {
  const { plainPositive = false, ...rest } = options;
  if (plainPositive) {
    if (!isDisplayableNumber(v)) return rest.empty ?? '—';
    const n = Number(v);
    const body = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: DISPLAY_DECIMAL_PLACES,
      maximumFractionDigits: DISPLAY_DECIMAL_PLACES
    });
    if (n < 0) return `-${body}%`;
    return `${body}%`;
  }
  return fmtNumber(v, {
    signed: true,
    plusOnPositive: true,
    suffix: '%',
    ...rest
  });
}

export function fmtPrice(v, options = {}) {
  return fmtNumber(v, { decimals: DISPLAY_DECIMAL_PLACES, ...options });
}

export function fmtAbsSigned(v, options = {}) {
  return fmtNumber(v, { signed: true, plusOnPositive: true, ...options });
}

export function fmtPctSigned(v, options = {}) {
  return fmtPct(v, { signed: true, plusOnPositive: true, ...options });
}

export function formatRelativePerfPct(v) {
  return fmtPctSigned(v);
}

export function fmtVolumeCompact(v, options = {}) {
  if (!isDisplayableNumber(v)) return options.empty ?? '—';
  const n = Number(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) {
    return `${sign}${fmtNumber(abs / 1e9, { decimals: DISPLAY_DECIMAL_PLACES, suffix: 'B', empty: '' })}`;
  }
  if (abs >= 1e6) {
    return `${sign}${fmtNumber(abs / 1e6, { decimals: DISPLAY_DECIMAL_PLACES, suffix: 'M', empty: '' })}`;
  }
  if (abs >= 1e3) {
    return `${sign}${fmtNumber(abs / 1e3, { decimals: DISPLAY_DECIMAL_PLACES, suffix: 'K', empty: '' })}`;
  }
  return fmtNumber(n, options);
}

export function fmtChartPrice(v) {
  return fmtPrice(v);
}
