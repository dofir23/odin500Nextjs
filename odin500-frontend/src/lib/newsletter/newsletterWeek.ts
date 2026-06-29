/** US Eastern — market week boundaries for Odin500 Weekly. */
export const NEWSLETTER_TIMEZONE = 'America/New_York';

export type NewsletterWeek = {
  /** Monday (ISO YYYY-MM-DD) */
  weekStart: string;
  /** Sunday (ISO YYYY-MM-DD) — also publishedAt */
  weekEnd: string;
  publishedAt: string;
  weekLabel: string;
  slug: string;
};

const SLUG_SUFFIX = 'weekly-market-recap';

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

function ymdFromParts(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Calendar date in timezone as {y,m,d} (month 1–12). */
function datePartsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    weekday: get('weekday')
  };
}

function addDaysYmd(ymd: string, delta: number) {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return ymdFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const WEEKDAY_TO_OFFSET: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

/** Mon–Sun week ending on the most recent Sunday (inclusive) relative to asOf. */
export function getCompletedWeek(
  asOf: Date = new Date(),
  timeZone = NEWSLETTER_TIMEZONE
): NewsletterWeek {
  const { y, m, d, weekday } = datePartsInTz(asOf, timeZone);
  const today = ymdFromParts(y, m, d);
  const dow = WEEKDAY_TO_OFFSET[weekday] ?? 0;
  const daysSinceSunday = dow === 0 ? 0 : dow;
  const weekEnd = addDaysYmd(today, -daysSinceSunday);
  const weekStart = addDaysYmd(weekEnd, -6);
  return buildWeekFromEnd(weekStart, weekEnd);
}

export function getWeekEndingSunday(sundayYmd: string): NewsletterWeek {
  const weekEnd = sundayYmd.slice(0, 10);
  const weekStart = addDaysYmd(weekEnd, -6);
  return buildWeekFromEnd(weekStart, weekEnd);
}

function buildWeekFromEnd(weekStart: string, weekEnd: string): NewsletterWeek {
  return {
    weekStart,
    weekEnd,
    publishedAt: weekEnd,
    weekLabel: formatWeekLabel(weekStart, weekEnd),
    slug: `${weekEnd}-${SLUG_SUFFIX}`
  };
}

function formatMonthDay(ymd: string) {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(dt);
}

export function formatWeekLabel(weekStart: string, weekEnd: string) {
  const startMd = formatMonthDay(weekStart);
  const endMd = formatMonthDay(weekEnd);
  const { m: mStart, y: yStart } = parseYmd(weekStart);
  const { m: mEnd, y: yEnd } = parseYmd(weekEnd);
  const year = yEnd !== yStart ? `${yStart}/${yEnd}` : String(yEnd);

  let range: string;
  if (mStart === mEnd && yStart === yEnd) {
    const endDay = parseYmd(weekEnd).d;
    range = `${startMd}–${endDay}`;
  } else {
    range = `${startMd}–${endMd}`;
  }

  return `Week of ${range}, ${year}`;
}

/** List completed weeks from afterSundayExclusive through lastCompleted (inclusive). */
export function listWeeksBetween(
  afterSundayYmd: string | null,
  lastWeek: NewsletterWeek
): NewsletterWeek[] {
  const out: NewsletterWeek[] = [];
  let cursor = lastWeek;
  const stop = afterSundayYmd ? afterSundayYmd.slice(0, 10) : null;

  while (true) {
    if (stop && cursor.weekEnd <= stop) break;
    out.push(cursor);
    const prevEnd = addDaysYmd(cursor.weekStart, -1);
    cursor = getWeekEndingSunday(prevEnd);
    if (out.length > 104) break;
  }

  return out.reverse();
}
