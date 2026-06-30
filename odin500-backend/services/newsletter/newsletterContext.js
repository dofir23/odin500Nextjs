const analyticsData = require('../../analyticsData');

const INDEX_TICKERS = [
  { label: 'S&P 500', ticker: 'SPX' },
  { label: 'Nasdaq-100', ticker: 'NDX' },
  { label: 'S&P 500 ETF', ticker: 'SPY' },
  { label: 'Nasdaq-100 ETF', ticker: 'QQQ' }
];

const SECTOR_TICKERS = [
  { label: 'Technology (XLK)', ticker: 'XLK' },
  { label: 'Financials (XLF)', ticker: 'XLF' },
  { label: 'Energy (XLE)', ticker: 'XLE' },
  { label: 'Healthcare (XLV)', ticker: 'XLV' },
  { label: 'Industrials (XLI)', ticker: 'XLI' }
];

function pickDynamicReturn(performance, periodName) {
  const rows = performance?.dynamicPeriods;
  if (!Array.isArray(rows)) return null;
  const row = rows.find((r) => r?.period === periodName);
  if (!row || row.totalReturn == null) return null;
  const n = Number(row.totalReturn);
  return Number.isFinite(n) ? n : null;
}

function formatReturnPct(n) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function rowFromReturns(label, ticker, payload) {
  const perf = payload?.performance;
  return {
    label,
    ticker,
    lastWeek: pickDynamicReturn(perf, 'Last Week'),
    lastMonth: pickDynamicReturn(perf, 'Last Month'),
    ytd: pickDynamicReturn(perf, 'Year to Date (YTD)')
  };
}

function primaryReturn(row) {
  return row.lastWeek ?? row.lastMonth ?? row.ytd;
}

function summarizeSignals(rows) {
  if (!rows?.length) return null;
  const summary = { longL1: 0, longL2: 0, shortS1: 0, shortS2: 0, total: rows.length };
  for (const r of rows) {
    const sig = String(r.signal || r.odin_signal || r.odinsignal || r.signal_bucket || '')
      .toUpperCase()
      .trim();
    if (sig === 'L1') summary.longL1 += 1;
    else if (sig === 'L2') summary.longL2 += 1;
    else if (sig === 'S1') summary.shortS1 += 1;
    else if (sig === 'S2') summary.shortS2 += 1;
  }
  return summary;
}

async function fetchNewsletterContext() {
  const tickers = [...INDEX_TICKERS, ...SECTOR_TICKERS].map((r) => r.ticker);

  const [returnPairs, moversPayload, detailsRows] = await Promise.all([
    Promise.all(
      tickers.map(async (t) => {
        try {
          const returns = await analyticsData.calculateAllReturns(t, true, true, null, 2000);
          return [t, returns];
        } catch {
          return [t, null];
        }
      })
    ),
    analyticsData.calculateIndexMarketMovers('SP500', 'last-date'),
    analyticsData.getTickerDetailsByIndex('SP500', 'last-date')
  ]);

  const byTicker = Object.fromEntries(returnPairs);
  const spx = byTicker.SPX;
  const asOfDate = String(
    spx?.asOfDate || moversPayload?.asOfDate || new Date().toISOString().slice(0, 10)
  ).slice(0, 10);

  const indices = INDEX_TICKERS.map((r) => rowFromReturns(r.label, r.ticker, byTicker[r.ticker]));
  const sectors = SECTOR_TICKERS.map((r) => rowFromReturns(r.label, r.ticker, byTicker[r.ticker]));

  if (!indices.some((r) => primaryReturn(r) != null)) return null;

  const ranked = [...sectors].sort((a, b) => (primaryReturn(b) ?? -999) - (primaryReturn(a) ?? -999));
  const points = Array.isArray(moversPayload?.points) ? moversPayload.points : [];
  const sortedMovers = [...points]
    .filter((p) => p?.dayReturnPct != null)
    .sort((a, b) => Number(b.dayReturnPct) - Number(a.dayReturnPct));

  return {
    asOfDate,
    indices,
    sectors,
    topSectors: ranked.slice(0, 2),
    bottomSectors: ranked.slice(-2).reverse(),
    signals: summarizeSignals(detailsRows),
    topGainers: sortedMovers.slice(0, 3).map((p) => ({
      symbol: String(p.symbol || '').toUpperCase(),
      name: String(p.companyName || '').trim(),
      returnPct: Number(p.dayReturnPct)
    })),
    topLosers: sortedMovers
      .slice(-3)
      .reverse()
      .map((p) => ({
        symbol: String(p.symbol || '').toUpperCase(),
        name: String(p.companyName || '').trim(),
        returnPct: Number(p.dayReturnPct)
      }))
  };
}

function formatContextForPrompt(ctx) {
  const fmtRow = (r) => {
    const bits = [];
    if (r.lastWeek != null) bits.push(`1W ${formatReturnPct(r.lastWeek)}`);
    if (r.lastMonth != null) bits.push(`1M ${formatReturnPct(r.lastMonth)}`);
    if (r.ytd != null) bits.push(`YTD ${formatReturnPct(r.ytd)}`);
    return `${r.label} (${r.ticker}): ${bits.join(', ') || 'n/a'}`;
  };

  const lines = [
    `As of date: ${ctx.asOfDate}`,
    '',
    'Indices & ETFs:',
    ...ctx.indices.map(fmtRow),
    '',
    'Strongest sectors:',
    ...ctx.topSectors.map(fmtRow),
    '',
    'Weakest sectors:',
    ...ctx.bottomSectors.map(fmtRow)
  ];

  if (ctx.signals) {
    lines.push(
      '',
      `Odin signals (S&P 500 sample, n=${ctx.signals.total}): L1=${ctx.signals.longL1}, L2=${ctx.signals.longL2}, S1=${ctx.signals.shortS1}, S2=${ctx.signals.shortS2}`
    );
  }

  if (ctx.topGainers?.length) {
    lines.push('', 'Top S&P 500 gainers:', ...ctx.topGainers.map((m) => `${m.symbol}: ${formatReturnPct(m.returnPct)}`));
  }
  if (ctx.topLosers?.length) {
    lines.push('', 'Top S&P 500 losers:', ...ctx.topLosers.map((m) => `${m.symbol}: ${formatReturnPct(m.returnPct)}`));
  }

  return lines.join('\n');
}

module.exports = { fetchNewsletterContext, formatContextForPrompt, formatReturnPct, primaryReturn };
