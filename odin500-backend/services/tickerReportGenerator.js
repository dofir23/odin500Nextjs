const bigquery = require('../config/bigquery');
const supabaseService = require('../config/supabaseService');

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'extended-byway-454621-s6';
const DATASET = process.env.BIGQUERY_DATASET || 'sp500data1';
const TABLE = process.env.BIGQUERY_TABLE || 'stock_all_data';
const TABLE_FQN = `${PROJECT_ID}.${DATASET}.${TABLE}`;
const TICKER_DETAILS_TABLE = process.env.TICKER_DETAILS_TABLE || 'TickerDetails';
const TICKER_DETAILS_FQN = `${PROJECT_ID}.${DATASET}.${TICKER_DETAILS_TABLE}`;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = [
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

function toIsoDate(d) {
  return new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10);
}

function addYears(iso, delta) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

function addMonths(iso, delta) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function quarterOfMonth(month1Based) {
  return Math.floor((month1Based - 1) / 3) + 1;
}

function clampNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function round(n, dp = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

function fmtPct(n, dp = 2) {
  if (!Number.isFinite(n)) return '—';
  const x = round(n, dp);
  const sign = x > 0 ? '+' : x < 0 ? '−' : '';
  return `${sign}${Math.abs(x).toFixed(dp)}%`;
}

function fmtMoney(n, dp = 2) {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: dp,
    maximumFractionDigits: dp
  }).format(n);
}

function pctAbs(n, dp = 2) {
  if (!Number.isFinite(n)) return '—';
  return `${Math.abs(round(n, dp)).toFixed(dp)}%`;
}

function upDownPhrase(n, dp = 2) {
  if (!Number.isFinite(n)) return 'was unchanged';
  const v = pctAbs(n, dp);
  if (n > 0) return `up ${v}`;
  if (n < 0) return `down ${v}`;
  return `flat at ${v}`;
}

function parseDateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function normalizeIndexMembership(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  return s
    .split(/[|,;/]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const up = x.toUpperCase();
      if (up === 'SP500' || up === 'S&P500' || up === 'S&P 500') return 'S&P 500';
      if (up === 'NASDAQ100' || up === 'NASDAQ-100' || up === 'NASDAQ 100') return 'Nasdaq-100';
      if (up === 'DJI' || up === 'DOW' || up === 'DOW JONES') return 'Dow Jones Industrial Average';
      return x;
    });
}

async function fetchTickerMeta(symbol) {
  const sym = String(symbol || '').toUpperCase();
  let companyName = sym;
  let sector = 'N/A';
  let industry = 'N/A';
  let exchange = 'US';
  let indices = ['S&P 500'];

  try {
    const query = `
      SELECT Symbol, Security, Sector, Industry, \`Index\`
      FROM \`${TICKER_DETAILS_FQN}\`
      WHERE UPPER(Symbol) = @symbol
      LIMIT 1
    `;
    const [rows] = await bigquery.query({ query, params: { symbol: sym } });
    const row = rows?.[0];
    if (row) {
      companyName = String(row.Security || '').trim() || companyName;
      sector = String(row.Sector || '').trim() || sector;
      industry = String(row.Industry || '').trim() || industry;
      const idx = normalizeIndexMembership(row.Index);
      if (idx.length) indices = idx;
    }
  } catch {
    // non-fatal: metadata falls back below
  }

  try {
    const { data } = await supabaseService
      .from('tickers')
      .select('symbol, company_name')
      .eq('symbol', sym)
      .limit(1);
    const row = data?.[0];
    if (row?.company_name) companyName = String(row.company_name).trim() || companyName;
  } catch {
    // non-fatal
  }

  return { companyName, sector, industry, exchange, indices };
}

async function fetchDailyBars(symbol, startDate, endDate) {
  const query = `
    SELECT Date AS date, Open AS open, High AS high, Low AS low, Close AS close
    FROM \`${TABLE_FQN}\`
    WHERE Ticker = @symbol
      AND Date BETWEEN @start AND @end
    ORDER BY Date ASC
  `;
  const [rows] = await bigquery.query({
    query,
    params: { symbol: String(symbol || '').toUpperCase(), start: startDate, end: endDate }
  });
  return rows
    .map((r) => ({
      date: String(r.date && r.date.value ? r.date.value : r.date).slice(0, 10),
      open: clampNum(r.open, NaN),
      high: clampNum(r.high, NaN),
      low: clampNum(r.low, NaN),
      close: clampNum(r.close, NaN)
    }))
    .filter((r) => r.date && Number.isFinite(r.close));
}

function nearestIndexOnOrBefore(rows, iso) {
  let idx = -1;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].date <= iso) idx = i;
    else break;
  }
  return idx;
}

function pctBetween(rows, fromIso, toIdx) {
  if (toIdx <= 0) return null;
  const fromIdx = nearestIndexOnOrBefore(rows, fromIso);
  if (fromIdx < 0 || fromIdx >= toIdx) return null;
  const a = rows[fromIdx].close;
  const b = rows[toIdx].close;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

function pctFromLag(rows, toIdx, lagTradingDays) {
  const fromIdx = toIdx - lagTradingDays;
  if (fromIdx < 0 || toIdx < 0) return null;
  const a = rows[fromIdx].close;
  const b = rows[toIdx].close;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

function aggregateMonthly(rows) {
  const map = new Map();
  for (const r of rows) {
    const p = parseDateParts(r.date);
    if (!p) continue;
    const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        year: p.year,
        month: p.month,
        key,
        startDate: r.date,
        endDate: r.date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close
      });
    } else {
      cur.endDate = r.date;
      cur.close = r.close;
      cur.high = Math.max(cur.high, r.high);
      cur.low = Math.min(cur.low, r.low);
    }
  }
  const out = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const m of out) {
    m.returnPct = Number.isFinite(m.open) && m.open !== 0 ? ((m.close - m.open) / m.open) * 100 : null;
  }
  return out;
}

function stddev(values) {
  if (!values.length) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function monthLabel(year, month) {
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

function downsampleForSparse(points, target = 40) {
  if (!points?.length) return { labels: [], values: [] };
  if (points.length <= target) {
    return { labels: points.map((p) => monthLabel(p.year, p.month)), values: points.map((p) => round(p.value, 2)) };
  }
  const step = Math.ceil(points.length / target);
  const picked = [];
  for (let i = 0; i < points.length; i += step) picked.push(points[i]);
  if (picked[picked.length - 1] !== points[points.length - 1]) picked.push(points[points.length - 1]);
  return { labels: picked.map((p) => monthLabel(p.year, p.month)), values: picked.map((p) => round(p.value, 2)) };
}

function buildSeasonality(monthly, asOfYear) {
  const years = [asOfYear - 3, asOfYear - 2, asOfYear - 1, asOfYear];
  const cells = {};
  for (const y of years) {
    const arr = Array.from({ length: 12 }, () => null);
    for (const r of monthly) {
      if (r.year !== y) continue;
      arr[r.month - 1] = Number.isFinite(r.returnPct) ? round(r.returnPct, 1) : null;
    }
    cells[String(y)] = arr;
  }

  const avgYears = [asOfYear - 2, asOfYear - 1, asOfYear];
  const averages = Array.from({ length: 12 }, (_, mi) => {
    const vals = avgYears.map((y) => cells[String(y)]?.[mi]).filter((v) => Number.isFinite(v));
    if (!vals.length) return 0;
    return round(vals.reduce((s, v) => s + v, 0) / vals.length, 1);
  });

  return { years, months: MONTH_SHORT, cells, averages };
}

function buildReportObject({
  symbol,
  period,
  tickerRows,
  benchRows,
  metaInfo
}) {
  const asOfIso = period.asOf;
  const asOfParts = parseDateParts(asOfIso);
  const asOfIdx = nearestIndexOnOrBefore(tickerRows, asOfIso);
  const benchAsOfIdx = nearestIndexOnOrBefore(benchRows, asOfIso);
  if (asOfIdx < 0 || benchAsOfIdx < 0) throw new Error(`No data available through ${asOfIso}`);

  const tickerClose = tickerRows[asOfIdx].close;
  const benchClose = benchRows[benchAsOfIdx].close;
  const tickerMonthly = aggregateMonthly(tickerRows.filter((r) => r.date <= asOfIso));
  const benchMonthly = aggregateMonthly(benchRows.filter((r) => r.date <= asOfIso));
  const trailing39 = tickerMonthly.slice(-39);

  const periods = [
    { label: '1 Day', t: pctFromLag(tickerRows, asOfIdx, 1), b: pctFromLag(benchRows, benchAsOfIdx, 1) },
    { label: '1 Week', t: pctFromLag(tickerRows, asOfIdx, 5), b: pctFromLag(benchRows, benchAsOfIdx, 5) },
    { label: '1 Month', t: pctFromLag(tickerRows, asOfIdx, 21), b: pctFromLag(benchRows, benchAsOfIdx, 21) },
    { label: '3 Months', t: pctFromLag(tickerRows, asOfIdx, 63), b: pctFromLag(benchRows, benchAsOfIdx, 63) },
    { label: '6 Months', t: pctFromLag(tickerRows, asOfIdx, 126), b: pctFromLag(benchRows, benchAsOfIdx, 126) },
    { label: 'YTD', t: pctBetween(tickerRows, `${asOfParts.year}-01-01`, asOfIdx), b: pctBetween(benchRows, `${asOfParts.year}-01-01`, benchAsOfIdx) },
    { label: '12 Months', t: pctBetween(tickerRows, addYears(asOfIso, -1), asOfIdx), b: pctBetween(benchRows, addYears(asOfIso, -1), benchAsOfIdx) },
    { label: '3 Years', t: pctBetween(tickerRows, addYears(asOfIso, -3), asOfIdx), b: pctBetween(benchRows, addYears(asOfIso, -3), benchAsOfIdx) }
  ];

  const trailingReturns = periods.map((p) => {
    const excess = Number.isFinite(p.t) && Number.isFinite(p.b) ? p.t - p.b : null;
    return {
      period: p.label,
      ticker: fmtPct(p.t),
      bench: fmtPct(p.b),
      excess: fmtPct(excess),
      tickerTone: (p.t || 0) > 0 ? 'pos' : (p.t || 0) < 0 ? 'neg' : 'neutral',
      benchTone: (p.b || 0) > 0 ? 'pos' : (p.b || 0) < 0 ? 'neg' : 'neutral',
      excessTone: (excess || 0) > 0 ? 'pos' : (excess || 0) < 0 ? 'neg' : 'neutral',
      bold: p.label === '3 Years'
    };
  });

  const monthReturns = trailing39.map((m) => m.returnPct).filter((v) => Number.isFinite(v));
  const avgMonthly = monthReturns.length ? monthReturns.reduce((s, v) => s + v, 0) / monthReturns.length : null;
  const sortedMonthly = [...monthReturns].sort((a, b) => a - b);
  const medianMonthly =
    sortedMonthly.length === 0
      ? null
      : sortedMonthly.length % 2
        ? sortedMonthly[(sortedMonthly.length - 1) / 2]
        : (sortedMonthly[sortedMonthly.length / 2 - 1] + sortedMonthly[sortedMonthly.length / 2]) / 2;
  const stdMonthly = stddev(monthReturns);
  const annVol = Number.isFinite(stdMonthly) ? stdMonthly * Math.sqrt(12) : null;
  const sharpe = Number.isFinite(avgMonthly) && Number.isFinite(stdMonthly) && stdMonthly > 0 ? (avgMonthly / stdMonthly) * Math.sqrt(12) : null;
  const cagr3y = pctBetween(tickerRows, addYears(asOfIso, -3), asOfIdx);
  const positiveMonths = monthReturns.filter((v) => v > 0).length;
  const negativeMonths = monthReturns.filter((v) => v < 0).length;
  const bestMonth = monthReturns.length ? Math.max(...monthReturns) : null;
  const worstMonth = monthReturns.length ? Math.min(...monthReturns) : null;

  const byQuarter = new Map();
  for (const m of tickerMonthly) {
    const q = quarterOfMonth(m.month);
    const key = `${m.year}-Q${q}`;
    const cur = byQuarter.get(key) || { year: m.year, quarter: q, factors: [] };
    const f = Number.isFinite(m.returnPct) ? 1 + m.returnPct / 100 : null;
    if (f != null) cur.factors.push(f);
    byQuarter.set(key, cur);
  }
  const quarterRows = [...byQuarter.values()]
    .sort((a, b) => (a.year === b.year ? a.quarter - b.quarter : a.year - b.year))
    .map((q) => {
      const compounded = q.factors.length ? (q.factors.reduce((s, f) => s * f, 1) - 1) * 100 : null;
      const isCurrent = q.year === asOfParts.year && q.quarter === quarterOfMonth(asOfParts.month);
      return {
        quarter: `Q${q.quarter} ${q.year}${isCurrent ? ' (QTD)' : ''}`,
        value: fmtPct(compounded),
        tone: (compounded || 0) > 0 ? 'pos' : (compounded || 0) < 0 ? 'neg' : 'neutral',
        numeric: compounded
      };
    });
  const quarters = quarterRows.slice(-6).map(({ quarter, value, tone }) => ({ quarter, value, tone }));

  function buildCalendarRows(monthly) {
    const map = new Map();
    for (const m of monthly) {
      const cur = map.get(m.year) || [];
      if (Number.isFinite(m.returnPct)) cur.push(1 + m.returnPct / 100);
      map.set(m.year, cur);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, factors]) => {
        const compounded = factors.length ? (factors.reduce((s, f) => s * f, 1) - 1) * 100 : null;
        return { year, value: compounded };
      });
  }
  const tickerCalendar = buildCalendarRows(tickerMonthly);
  const benchCalendar = buildCalendarRows(benchMonthly);
  const calendarYears = tickerCalendar.slice(-4).map((r) => ({
    year: String(r.year),
    value: fmtPct(r.value),
    tone: (r.value || 0) > 0 ? 'pos' : (r.value || 0) < 0 ? 'neg' : 'neutral'
  }));

  const rows3y = tickerRows.filter((r) => r.date >= addYears(asOfIso, -3) && r.date <= asOfIso);
  let peak = -Infinity;
  let maxDd = 0;
  let maxDdDate = '';
  const drawdownSeries = [];
  for (const r of rows3y) {
    if (r.close > peak) peak = r.close;
    const dd = peak > 0 ? ((r.close - peak) / peak) * 100 : 0;
    if (dd < maxDd) {
      maxDd = dd;
      maxDdDate = r.date;
    }
    const p = parseDateParts(r.date);
    drawdownSeries.push({ year: p.year, month: p.month, value: dd });
  }

  const last252 = rows3y.slice(-252);
  let high52 = null;
  let low52 = null;
  let high52Date = '';
  let low52Date = '';
  for (const r of last252) {
    if (high52 == null || r.high > high52) {
      high52 = r.high;
      high52Date = r.date;
    }
    if (low52 == null || r.low < low52) {
      low52 = r.low;
      low52Date = r.date;
    }
  }
  const drawdownFrom52 = Number.isFinite(high52) && high52 > 0 ? ((tickerClose - high52) / high52) * 100 : null;
  const maWindow = rows3y.slice(-200).map((r) => r.close).filter((v) => Number.isFinite(v));
  const ma200 = maWindow.length ? maWindow.reduce((s, v) => s + v, 0) / maWindow.length : null;
  const priceVs200 = Number.isFinite(ma200) && ma200 !== 0 ? ((tickerClose - ma200) / ma200) * 100 : null;

  const benchByDate = new Map(benchRows.map((r) => [r.date, r.close]));
  const rsAligned = rows3y
    .map((r) => ({ date: r.date, t: r.close, b: benchByDate.get(r.date) }))
    .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.b) && r.t > 0 && r.b > 0);
  const rsBase = rsAligned.length ? rsAligned[0].t / rsAligned[0].b : null;
  const rsSeries = rsAligned.map((r) => {
    const p = parseDateParts(r.date);
    return { year: p.year, month: p.month, date: r.date, value: round(((r.t / r.b) / rsBase) * 100, 1) };
  });
  const rsVals = rsSeries.map((r) => r.value).filter((v) => Number.isFinite(v));
  const rsPeak = rsVals.length ? Math.max(...rsVals) : null;
  const rsTrough = rsVals.length ? Math.min(...rsVals) : null;
  const rsNow = rsVals.length ? rsVals[rsVals.length - 1] : null;
  const rsPeakPoint = rsSeries.find((r) => r.value === rsPeak);
  const rsTroughPoint = rsSeries.find((r) => r.value === rsTrough);
  const excess3y = Number.isFinite(periods[7].t) && Number.isFinite(periods[7].b) ? periods[7].t - periods[7].b : null;

  const trailingReturnsMap = Object.fromEntries(periods.map((p) => [p.label, p]));
  const bestRows = trailing39
    .filter((m) => Number.isFinite(m.returnPct))
    .map((m) => ({ label: `${MONTH_SHORT[m.month - 1]} ${m.year}`, value: m.returnPct }))
    .sort((a, b) => b.value - a.value);
  const worstRows = [...bestRows].sort((a, b) => a.value - b.value);

  const seasonality = buildSeasonality(tickerMonthly, asOfParts.year);
  const drawSparse = downsampleForSparse(drawdownSeries);
  const rsSparse = downsampleForSparse(rsSeries);

  const benchYearMap = new Map(benchCalendar.map((r) => [String(r.year), r.value]));
  const annualCompareYears = calendarYears.map((r) => r.year);
  const annualCompareTicker = annualCompareYears.map((y) => round(tickerCalendar.find((r) => String(r.year) === y)?.value, 2) || 0);
  const annualCompareBench = annualCompareYears.map((y) => round(benchYearMap.get(y), 2) || 0);

  const monthPeriodLabel =
    Number.isFinite(Number(period.month)) && Number(period.month) >= 1
      ? `${MONTH_FULL[Number(period.month) - 1]} ${period.year}`
      : `${period.year}`;
  const periodLabel = period.reportKind === 'annual' ? `${period.year} Annual` : monthPeriodLabel;
  const isAnnual = period.reportKind === 'annual';

  const oneMonthReturn = trailingReturnsMap['1 Month']?.t;
  const oneMonthBench = trailingReturnsMap['1 Month']?.b;
  const oneMonthExcess =
    Number.isFinite(oneMonthReturn) && Number.isFinite(oneMonthBench) ? oneMonthReturn - oneMonthBench : null;
  const ytdReturn = trailingReturnsMap.YTD?.t;
  const ytdBench = trailingReturnsMap.YTD?.b;
  const ytdGap = Number.isFinite(ytdReturn) && Number.isFinite(ytdBench) ? ytdReturn - ytdBench : null;
  const qtdRow = quarterRows.find((q) => q.quarter.includes('(QTD)')) || quarterRows[quarterRows.length - 1];

  const recapParagraphs = isAnnual
    ? [
        `${metaInfo?.companyName || symbol} ended ${period.year} at ${fmtMoney(tickerClose)}, with a full-year return of ${fmtPct(
          tickerCalendar.find((r) => r.year === period.year)?.value
        )}. Against SPY, calendar-year relative performance was ${fmtPct(
          (tickerCalendar.find((r) => r.year === period.year)?.value || 0) -
            (benchCalendar.find((r) => r.year === period.year)?.value || 0)
        )}.`,
        `Through ${asOfIso}, the stock sits ${fmtPct(priceVs200)} versus its 200-day moving average (${fmtMoney(
          ma200
        )}) and ${fmtPct(drawdownFrom52)} below the 52-week high (${fmtMoney(high52)}).`,
        `Longer-term context remains ${Number(excess3y) >= 0 ? 'constructive' : 'mixed'}: 3-year return is ${fmtPct(
          trailingReturnsMap['3 Years']?.t
        )} versus SPY ${fmtPct(trailingReturnsMap['3 Years']?.b)} (excess ${fmtPct(excess3y)}).`
      ]
    : [
        `${metaInfo?.companyName || symbol} ended ${periodLabel} at ${fmtMoney(tickerClose)}, posting a monthly return of ${fmtPct(
          oneMonthReturn
        )}. The S&P 500 returned ${fmtPct(
          oneMonthBench
        )} over the same window, leaving relative performance at ${fmtPct(oneMonthExcess)}.`,
        `The current quarter stands at ${fmtPct(qtdRow?.numeric)} ${qtdRow ? `(${qtdRow.quarter})` : ''}, while medium-term trend remains ${
          Number(priceVs200) >= 0 ? 'constructive' : 'soft'
        }: price is ${fmtPct(priceVs200)} versus the 200-day moving average (${fmtMoney(ma200)}).`,
        `Year-to-date, ${symbol} is ${fmtPct(ytdReturn)} against SPY ${fmtPct(
          ytdBench
        )}, a gap of ${fmtPct(ytdGap)}. The stock is currently ${fmtPct(
          drawdownFrom52
        )} below its 52-week high, with maximum 3-year drawdown at ${fmtPct(maxDd)}.`
      ];

  const sectionNarratives = {
    priceChartCaption: `${symbol} 3-year price with 200-day moving average. Shaded band indicates the current 52-week range (${fmtMoney(
      low52
    )} to ${fmtMoney(high52)}).`,
    trailingReturns: {
      intro: `Trailing performance compares ${symbol} against SPY across standard horizons from 1 day to 3 years.`,
      summary: `${symbol} shows ${Number(oneMonthExcess) >= 0 ? 'outperformance' : 'underperformance'} in the latest month (${fmtPct(
        oneMonthExcess
      )} excess), while 3-year excess return stands at ${fmtPct(excess3y)}.`
    },
    monthlyStats: {
      intro: `Statistics below are computed from the most recent ${monthReturns.length} monthly observations ending ${asOfIso}.`,
      summary: `Average monthly return is ${fmtPct(avgMonthly)} with annualized volatility of ${
        round(annVol, 2) ?? '—'
      }%. Win rate is ${round((positiveMonths / Math.max(1, monthReturns.length)) * 100, 1)}% (${positiveMonths} positive vs ${negativeMonths} negative months).`
    },
    bestWorstMonths: {
      summary: `Best month in the trailing window was ${bestRows[0]?.label || '—'} (${fmtPct(
        bestRows[0]?.value
      )}), while the weakest was ${worstRows[0]?.label || '—'} (${fmtPct(worstRows[0]?.value)}).`
    },
    quarterlyAnnual: {
      summary: `Recent quarterly returns show ${fmtPct(quarterRows[quarterRows.length - 2]?.numeric)} followed by ${fmtPct(
        quarterRows[quarterRows.length - 1]?.numeric
      )}. Calendar-year series highlights how ${symbol} has tracked versus SPY through ${asOfParts.year}.`
    },
    drawdown: {
      intro: `Drawdown and range metrics are calculated from live daily OHLC data through ${asOfIso}.`,
      summary: `Current drawdown from the 52-week high is ${fmtPct(drawdownFrom52)}. The deepest drawdown in the 3-year window was ${fmtPct(
        maxDd
      )} on ${maxDdDate}.`
    },
    relativeStrength: {
      intro: `Relative strength rebases ${symbol} / SPY to 100 at the start of the 3-year observation window.`,
      summary: `The RS index is currently ${Number.isFinite(rsNow) ? round(rsNow, 1) : '—'}, with peak ${
        Number.isFinite(rsPeak) ? round(rsPeak, 1) : '—'
      } and trough ${Number.isFinite(rsTrough) ? round(rsTrough, 1) : '—'}.`,
      summaryExtra: `On total return basis, 3-year excess versus SPY is ${fmtPct(excess3y)}.`
    },
    seasonality: {
      intro: `Seasonality matrix displays monthly returns by calendar year, with shading tied to return magnitude.`,
      summary: `Three-year monthly averages show strongest seasonal tendency in ${
        MONTH_SHORT[seasonality.averages.indexOf(Math.max(...seasonality.averages))]
      } (${fmtPct(Math.max(...seasonality.averages), 1)}) and weakest in ${
        MONTH_SHORT[seasonality.averages.indexOf(Math.min(...seasonality.averages))]
      } (${fmtPct(Math.min(...seasonality.averages), 1)}).`
    }
  };

  const companyName = metaInfo?.companyName || symbol;
  const trailing12 = trailingReturnsMap['12 Months']?.t;
  const ytdLeadLag = Number(ytdGap) >= 0 ? 'outperforming' : 'underperforming';
  const trendSignal =
    Number(priceVs200) > 0
      ? 'a bullish technical signal'
      : Number(priceVs200) < 0
        ? 'a cautious technical signal'
        : 'a neutral technical signal';
  const rsStatusWord = Number(excess3y) >= 0 ? 'outperformed' : 'underperformed';

  return {
    meta: {
      symbol,
      companyName: metaInfo?.companyName || symbol,
      exchange: metaInfo?.exchange || 'US',
      sector: metaInfo?.sector || 'N/A',
      industry: metaInfo?.industry || 'N/A',
      indices: metaInfo?.indices?.length ? metaInfo.indices : ['S&P 500'],
      benchmark: 'S&P 500 (SPY)',
      periodKey: period.reportKind === 'annual' ? String(period.year) : `${period.year}-${String(period.month).padStart(2, '0')}`,
      month: period.reportKind === 'annual' ? null : period.month,
      year: period.year,
      monthLabel: period.reportKind === 'annual' ? '' : MONTH_FULL[period.month - 1],
      periodLabel,
      reportKind: period.reportKind,
      periodEnd: asOfIso,
      publishedLabel: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      asOfLabel: asOfIso,
      dataWindow: `${addYears(asOfIso, -3).slice(0, 4)} – ${asOfIso.slice(0, 4)}`
    },
    takeaways: [
      `${companyName} (${symbol}) closed ${periodLabel} at ${fmtMoney(tickerClose)}, ${upDownPhrase(
        oneMonthReturn
      )} for the month and ${fmtPct(trailing12)} over the trailing 12 months.`,
      `Year-to-date, ${symbol} is ${fmtPct(ytdReturn)}, ${ytdLeadLag} the S&P 500 which has returned ${fmtPct(
        ytdBench
      )} YTD.`,
      `The stock is trading ${fmtPct(priceVs200)} versus its 200-day moving average (${fmtMoney(ma200)}), ${trendSignal}.`,
      `Over the past three years, ${symbol} has ${rsStatusWord} the S&P 500 by ${fmtPct(
        excess3y
      )}, with a relative strength index reading of ${Number.isFinite(rsNow) ? round(rsNow, 1) : '—'}.`,
      `Win rate over the trailing ${monthReturns.length} months stands at ${round(
        (positiveMonths / Math.max(1, monthReturns.length)) * 100,
        1
      )}% — ${positiveMonths} positive months versus ${negativeMonths} negative months.`
    ],
    statsGrid: [
      { label: 'Last Close', value: fmtMoney(tickerClose), tone: 'neutral' },
      { label: '1-Month Return', value: fmtPct(trailingReturnsMap['1 Month'].t), tone: (trailingReturnsMap['1 Month'].t || 0) >= 0 ? 'pos' : 'neg' },
      { label: 'YTD Return', value: fmtPct(trailingReturnsMap.YTD.t), tone: (trailingReturnsMap.YTD.t || 0) >= 0 ? 'pos' : 'neg' },
      { label: '12-Month Return', value: fmtPct(trailingReturnsMap['12 Months'].t), tone: (trailingReturnsMap['12 Months'].t || 0) >= 0 ? 'pos' : 'neg' },
      { label: '3-Year Return', value: fmtPct(trailingReturnsMap['3 Years'].t), tone: (trailingReturnsMap['3 Years'].t || 0) >= 0 ? 'pos' : 'neg' },
      { label: 'Drawdown from 52W High', value: fmtPct(drawdownFrom52), tone: (drawdownFrom52 || 0) >= 0 ? 'pos' : 'neg' }
    ],
    recapParagraphs,
    sectionNarratives,
    monthlyStatsObservationCount: monthReturns.length,
    trailingReturns,
    monthlyStatsLeft: [
      { label: 'Average Monthly Return', value: fmtPct(avgMonthly), tone: (avgMonthly || 0) >= 0 ? 'pos' : 'neg' },
      { label: 'Median Monthly Return', value: fmtPct(medianMonthly), tone: (medianMonthly || 0) >= 0 ? 'pos' : 'neg' },
      { label: 'Standard Deviation', value: `${round(stdMonthly, 2) ?? '—'}%`, tone: 'neutral' },
      { label: 'Annualized Volatility', value: `${round(annVol, 2) ?? '—'}%`, tone: 'neutral' },
      { label: 'CAGR (3-Year)', value: fmtPct(cagr3y), tone: (cagr3y || 0) >= 0 ? 'pos' : 'neg' },
      { label: 'Sharpe Ratio (rf=0)', value: Number.isFinite(sharpe) ? String(round(sharpe, 2)) : '—', tone: 'neutral' }
    ],
    monthlyStatsRight: [
      { label: 'Positive Months', value: String(positiveMonths), tone: 'pos' },
      { label: 'Negative Months', value: String(negativeMonths), tone: 'neg' },
      { label: 'Total Months', value: String(monthReturns.length), tone: 'neutral' },
      { label: 'Win Rate', value: `${round((positiveMonths / Math.max(1, monthReturns.length)) * 100, 1)}%`, tone: 'pos', bold: true },
      { label: 'Best Month', value: fmtPct(bestMonth), tone: 'pos' },
      { label: 'Worst Month', value: fmtPct(worstMonth), tone: 'neg' }
    ],
    bestMonths: bestRows.slice(0, 5).map((r, i) => ({ rank: i + 1, label: r.label, value: fmtPct(r.value) })),
    worstMonths: worstRows.slice(0, 5).map((r, i) => ({ rank: i + 1, label: r.label, value: fmtPct(r.value) })),
    quarters,
    calendarYears,
    drawdownMetrics: [
      { label: '52-Week High', value: `${fmtMoney(high52)} (${high52Date})`, tone: 'neutral' },
      { label: '52-Week Low', value: `${fmtMoney(low52)} (${low52Date})`, tone: 'neutral' },
      { label: 'Current Price', value: fmtMoney(tickerClose), tone: 'neutral' },
      { label: '200-Day Moving Average', value: fmtMoney(ma200), tone: 'neutral' },
      { label: 'Price vs 200DMA', value: fmtPct(priceVs200), tone: (priceVs200 || 0) >= 0 ? 'pos' : 'neg' },
      { label: '3-Year Maximum Drawdown', value: `${fmtPct(maxDd)} (${maxDdDate})`, tone: 'neg' },
      { label: 'Current Drawdown from 52W High', value: fmtPct(drawdownFrom52), tone: (drawdownFrom52 || 0) >= 0 ? 'pos' : 'neg' }
    ],
    relativeStrength: [
      { label: 'RS Index (3-year, rebased to 100)', value: Number.isFinite(rsNow) ? String(round(rsNow, 1)) : '—', tone: 'neutral' },
      { label: '3-Year Excess Return vs S&P 500', value: fmtPct(excess3y), tone: (excess3y || 0) >= 0 ? 'pos' : 'neg' },
      { label: 'RS Peak', value: `${Number.isFinite(rsPeak) ? round(rsPeak, 1) : '—'}${rsPeakPoint ? ` (${monthLabel(rsPeakPoint.year, rsPeakPoint.month)})` : ''}`, tone: 'neutral' },
      { label: 'RS Trough', value: `${Number.isFinite(rsTrough) ? round(rsTrough, 1) : '—'}${rsTroughPoint ? ` (${monthLabel(rsTroughPoint.year, rsTroughPoint.month)})` : ''}`, tone: 'neutral' },
      { label: 'Status', value: (excess3y || 0) >= 0 ? 'Outperforming Benchmark' : 'Underperforming Benchmark', tone: (excess3y || 0) >= 0 ? 'pos' : 'neg' }
    ],
    seasonality,
    faqs: [
      { q: `What was ${symbol}'s return for this report period?`, a: `${symbol} returned ${fmtPct(trailingReturnsMap['1 Month'].t)} in the latest monthly window ending ${asOfIso}.` },
      { q: `Has ${symbol} outperformed SPY year to date?`, a: `YTD ${symbol}: ${fmtPct(trailingReturnsMap.YTD.t)} vs SPY: ${fmtPct(trailingReturnsMap.YTD.b)}.` },
      { q: `What is ${symbol}'s 12-month return?`, a: `${fmtPct(trailingReturnsMap['12 Months'].t)} over the trailing 12 months.` },
      { q: `Is ${symbol} above or below its 200-day moving average?`, a: `Price is ${fmtPct(priceVs200)} versus 200DMA (${fmtMoney(ma200)}).` },
      { q: `What is the maximum drawdown in the 3-year window?`, a: `${fmtPct(maxDd)} on ${maxDdDate}.` }
    ],
    charts: {
      price3y: { high52: round(high52, 2), low52: round(low52, 2) },
      monthlyReturns: { values: trailing39.map((m) => round(m.returnPct, 2)).filter((v) => Number.isFinite(v)) },
      annualCompare: { years: annualCompareYears, ticker: annualCompareTicker, bench: annualCompareBench },
      drawdown: drawSparse,
      relativeStrength: {
        ...rsSparse,
        peak: rsPeak,
        trough: rsTrough,
        peakDate: rsPeakPoint ? monthLabel(rsPeakPoint.year, rsPeakPoint.month) : '',
        troughDate: rsTroughPoint ? monthLabel(rsTroughPoint.year, rsTroughPoint.month) : ''
      }
    }
  };
}

async function buildTickerReport(symbol, { year, month }) {
  const sym = String(symbol || 'AAPL').toUpperCase();
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const safeYear = Number.isFinite(Number(year)) ? Number(year) : currentYear;
  const safeMonth = Number.isFinite(Number(month)) ? Number(month) : now.getUTCMonth() + 1;
  const isAnnual = safeYear !== currentYear;

  const periodEnd = isAnnual
    ? `${safeYear}-12-31`
    : new Date(Date.UTC(safeYear, safeMonth, 0)).toISOString().slice(0, 10);
  const queryStart = addYears(periodEnd, -5);

  const [tickerRows, benchRows] = await Promise.all([
    fetchDailyBars(sym, queryStart, periodEnd),
    fetchDailyBars('SPY', queryStart, periodEnd)
  ]);
  const metaInfo = await fetchTickerMeta(sym);

  if (!tickerRows.length) throw new Error(`No OHLC data found for ${sym}`);
  if (!benchRows.length) throw new Error('No benchmark data found for SPY');

  const asOfIdx = nearestIndexOnOrBefore(tickerRows, periodEnd);
  const asOf = asOfIdx >= 0 ? tickerRows[asOfIdx].date : tickerRows[tickerRows.length - 1].date;

  return buildReportObject({
    symbol: sym,
    period: {
      year: safeYear,
      month: isAnnual ? null : safeMonth,
      reportKind: isAnnual ? 'annual' : 'monthly',
      asOf
    },
    tickerRows,
    benchRows,
    metaInfo
  });
}

module.exports = { buildTickerReport };
