const NEWSLETTER_TIMEZONE = 'America/New_York';
const SLUG_SUFFIX = 'weekly-market-recap';

const WEEKDAY_TO_OFFSET = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function parseYmd(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function ymdFromParts(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function datePartsInTz(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    weekday: get('weekday')
  };
}

function addDaysYmd(ymd, delta) {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return ymdFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function formatMonthDay(ymd) {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(dt);
}

function formatWeekLabel(weekStart, weekEnd) {
  const startMd = formatMonthDay(weekStart);
  const { m: mStart, y: yStart } = parseYmd(weekStart);
  const { m: mEnd, y: yEnd } = parseYmd(weekEnd);
  const year = yEnd !== yStart ? `${yStart}/${yEnd}` : String(yEnd);
  let range;
  if (mStart === mEnd && yStart === yEnd) {
    range = `${startMd}–${parseYmd(weekEnd).d}`;
  } else {
    range = `${startMd}–${formatMonthDay(weekEnd)}`;
  }
  return `Week of ${range}, ${year}`;
}

function buildWeekFromEnd(weekStart, weekEnd) {
  return {
    weekStart,
    weekEnd,
    publishedAt: weekEnd,
    weekLabel: formatWeekLabel(weekStart, weekEnd),
    slug: `${weekEnd}-${SLUG_SUFFIX}`
  };
}

function getCompletedWeek(asOf = new Date(), timeZone = NEWSLETTER_TIMEZONE) {
  const { y, m, d, weekday } = datePartsInTz(asOf, timeZone);
  const today = ymdFromParts(y, m, d);
  const dow = WEEKDAY_TO_OFFSET[weekday] ?? 0;
  const weekEnd = addDaysYmd(today, -dow);
  const weekStart = addDaysYmd(weekEnd, -6);
  return buildWeekFromEnd(weekStart, weekEnd);
}

function getWeekEndingSunday(sundayYmd) {
  const weekEnd = String(sundayYmd).slice(0, 10);
  const weekStart = addDaysYmd(weekEnd, -6);
  return buildWeekFromEnd(weekStart, weekEnd);
}

module.exports = {
  NEWSLETTER_TIMEZONE,
  getCompletedWeek,
  getWeekEndingSunday,
  formatWeekLabel
};
