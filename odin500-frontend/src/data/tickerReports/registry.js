import { AAPL_REPORT_2026_04 } from './aapl-2026-04.js';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** @type {Record<string, Record<string, object>>} */
const REPORTS_BY_SYMBOL = {
  AAPL: {
    '2026-04': AAPL_REPORT_2026_04
  }
};

const COMPANY_NAMES = {
  AAPL: 'Apple Inc.',
  AMZN: 'Amazon.com, Inc.',
  NVDA: 'NVIDIA Corporation',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc.',
  META: 'Meta Platforms, Inc.',
  TSLA: 'Tesla, Inc.'
};

export function getCurrentReportYear() {
  return new Date().getFullYear();
}

/** Only the current calendar year has monthly reports in the archive nav. */
export function isMonthlyReportYear(year) {
  return Number(year) === getCurrentReportYear();
}

export function getReportYears() {
  const currentYear = getCurrentReportYear();
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];
}

/**
 * @param {number} year
 * @returns {number[]} 1-based month numbers (current year only, through present month)
 */
export function getMonthsForYear(year) {
  if (!isMonthlyReportYear(year)) return [];
  const currentMonth = new Date().getMonth() + 1;
  return Array.from({ length: currentMonth }, (_, i) => i + 1);
}

export function periodKey(year, month) {
  if (isMonthlyReportYear(year) && month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  return String(year);
}

export function periodEndIso(year, month) {
  if (isMonthlyReportYear(year) && month) {
    return new Date(year, month, 0).toISOString().slice(0, 10);
  }
  return `${year}-12-31`;
}

export function formatMonthYear(year, month) {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export function formatMonthShort(month) {
  return MONTH_SHORT[month - 1] || '';
}

/**
 * Clone canonical report for symbol/period with updated labels (demo until API-backed reports).
 * @param {object} base
 * @param {{ symbol: string, year: number, month: number }} ctx
 */
function personalizeReport(base, { symbol, year, month, reportKind }) {
  const sym = String(symbol || 'AAPL').toUpperCase();
  const companyName = COMPANY_NAMES[sym] || `${sym} Inc.`;
  const annual = reportKind === 'annual';
  const monthLabel = annual ? null : MONTH_LABELS[month - 1] || 'Month';
  const periodLabel = annual ? `${year} Annual` : `${monthLabel} ${year}`;
  const json = JSON.stringify(base);
  const replaced = json
    .replaceAll('AAPL', sym)
    .replaceAll('Apple Inc.', companyName)
    .replaceAll('Apple (', `${companyName.split(' ')[0]} (`)
    .replaceAll('Apple has', `${companyName.split(' ')[0]} has`)
    .replaceAll('Apple\'s', `${sym}'s`)
    .replaceAll('Monthly Stock Report', annual ? 'Annual Stock Report' : 'Monthly Stock Report')
    .replaceAll('Monthly Performance Report', annual ? 'Annual Performance Report' : 'Monthly Performance Report')
    .replaceAll('April 2026', periodLabel)
    .replaceAll('April', annual ? String(year) : monthLabel)
    .replaceAll('2026-04', periodKey(year, month));
  const out = JSON.parse(replaced);
  out.meta = {
    ...out.meta,
    symbol: sym,
    companyName,
    reportKind,
    month: annual ? null : month,
    year,
    monthLabel: monthLabel || '',
    periodLabel,
    periodKey: periodKey(year, month),
    periodEnd: periodEndIso(year, month),
    publishedLabel: base.meta.publishedLabel
  };
  return out;
}

/**
 * @param {string} symbol
 * @param {number} year
 * @param {number} month
 * @returns {object | null}
 */
export function getTickerReport(symbol, year, month) {
  const sym = String(symbol || '').toUpperCase();
  const annual = !isMonthlyReportYear(year);
  const key = periodKey(year, annual ? null : month);
  const symReports = REPORTS_BY_SYMBOL[sym];
  if (symReports?.[key]) return symReports[key];
  const base = symReports?.['2026-04'] || REPORTS_BY_SYMBOL.AAPL['2026-04'];
  if (!base) return null;
  return personalizeReport(base, {
    symbol: sym,
    year,
    month: annual ? 12 : month,
    reportKind: annual ? 'annual' : 'monthly'
  });
}

/**
 * Latest available period for a symbol (for default navigation).
 * @param {string} symbol
 */
export function getLatestReportPeriod(symbol) {
  const sym = String(symbol || 'AAPL').toUpperCase();
  const keys = Object.keys(REPORTS_BY_SYMBOL[sym] || REPORTS_BY_SYMBOL.AAPL || {}).sort();
  const latest = keys[keys.length - 1] || '2026-04';
  const [y, m] = latest.split('-');
  return { year: Number(y), month: Number(m) };
}

export function hasExactReport(symbol, year, month) {
  const sym = String(symbol || '').toUpperCase();
  const annual = !isMonthlyReportYear(year);
  return Boolean(REPORTS_BY_SYMBOL[sym]?.[periodKey(year, annual ? null : month)]);
}
