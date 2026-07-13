const { config } = require('../config');
const { getOhlcPreview, getTickerReturnsBatch } = require('../api/odinClient');
const { formatPct, formatPrice, etDateLabel } = require('../utils/utm');

function pickReturn(perf, label) {
  if (!perf || typeof perf !== 'object') return null;
  const row = perf[label];
  if (row == null) return null;
  if (typeof row === 'number') return row;
  if (typeof row === 'object' && row.return != null) return Number(row.return);
  return null;
}

function ohlcChangePct(rows) {
  if (!rows || rows.length < 2) return null;
  const first = rows[rows.length - 1];
  const last = rows[0];
  const a = Number(first.close);
  const b = Number(last.close);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

async function buildOhlcContext(symbol) {
  const ohlc = await getOhlcPreview(symbol, 120);
  const rows = ohlc.rows || [];
  const chg = ohlcChangePct(rows);
  const bullets = [
    `Latest close ${formatPrice(ohlc.latest_close)} (${ohlc.latest_date})`,
    chg != null ? `Period change ~${formatPct(chg)}` : null
  ].filter(Boolean);

  return {
    hook: `$${symbol} — ${ohlc.company_name || 'U.S. equity'}`,
    bullets,
    context: {
      symbol,
      companyName: ohlc.company_name,
      latestClose: ohlc.latest_close,
      latestDate: ohlc.latest_date,
      changePct: chg,
      date: etDateLabel()
    },
    chartFallback: rows.length
      ? {
          chart: {
            symbol: ohlc.symbol,
            companyName: ohlc.company_name,
            rows,
            subtitle: `~${rows.length} trading days · Odin500`
          }
        }
      : null,
    data: { symbol, companyName: ohlc.company_name, changePct: chg }
  };
}

async function buildAnnualContext(symbol) {
  const bullets = [];
  const context = { symbol, date: etDateLabel() };
  let companyName;

  const batch = await getTickerReturnsBatch([symbol]).catch(() => null);
  if (batch?.byTicker?.[symbol]) {
    const row = batch.byTicker[symbol];
    const perf = row?.data?.performance || row?.performance;
    companyName = row?.data?.company_name || row?.company_name;
    const labels = [
      'Year to Date (YTD)',
      'Last Year',
      'Last 3 Years',
      'Last 5 Years',
      'Last Month'
    ];
    for (const label of labels) {
      const v = pickReturn(perf, label);
      if (v != null) {
        bullets.push(`${label}: ${formatPct(v)}`);
        context[label] = v;
      }
      if (bullets.length >= 4) break;
    }
  }

  if (!bullets.length) {
    const ohlc = await getOhlcPreview(symbol, 252);
    companyName = ohlc.company_name;
    const chg = ohlcChangePct(ohlc.rows || []);
    if (ohlc.latest_close != null) {
      bullets.push(`Latest close ${formatPrice(ohlc.latest_close)} (${ohlc.latest_date})`);
    }
    if (chg != null) bullets.push(`~1y window change ${formatPct(chg)}`);
    context.latestClose = ohlc.latest_close;
    context.latestDate = ohlc.latest_date;
    context.changePct = chg;
  }

  return {
    hook: `$${symbol} annual returns${companyName ? ` — ${companyName}` : ''}`,
    bullets,
    context: { ...context, companyName },
    chartFallback: null,
    data: { symbol, companyName, bullets }
  };
}

async function buildStatsContext(symbol, chartLabel) {
  const base = await buildAnnualContext(symbol);
  return {
    ...base,
    hook: `$${symbol} — ${chartLabel}${base.context?.companyName ? ` · ${base.context.companyName}` : ''}`
  };
}

async function buildMarketContext(chartLabel) {
  const indices = config.watchlist.indices || ['SPY', 'QQQ', 'DIA'];
  const bullets = [];
  const context = { indices, date: etDateLabel(), chartLabel };

  const batch = await getTickerReturnsBatch(indices).catch(() => null);
  if (batch?.byTicker) {
    for (const sym of indices) {
      const row = batch.byTicker[sym];
      const perf = row?.data?.performance || row?.performance;
      const ytd = pickReturn(perf, 'Year to Date (YTD)');
      const m1 = pickReturn(perf, 'Last Month');
      if (ytd != null) bullets.push(`${sym} YTD ${formatPct(ytd)}`);
      if (m1 != null && bullets.length < 5) bullets.push(`${sym} 1M ${formatPct(m1)}`);
    }
  }

  let chartFallback = null;
  const preview = await getOhlcPreview('SPY', 90).catch(() => null);
  if (preview?.rows?.length) {
    if (!bullets.length) {
      const chg = ohlcChangePct(preview.rows);
      if (chg != null) bullets.push(`SPY ${preview.rows.length}d change ${formatPct(chg)}`);
      bullets.push(`Latest close ${formatPrice(preview.latest_close)}`);
    }
    chartFallback = {
      chart: {
        symbol: preview.symbol,
        companyName: preview.company_name,
        rows: preview.rows,
        subtitle: `${chartLabel} · ${etDateLabel()}`
      }
    };
    context.chartSymbol = preview.symbol;
    context.latestClose = preview.latest_close;
  }

  return {
    hook: `${chartLabel} — U.S. markets · ${etDateLabel()}`,
    bullets,
    context,
    chartFallback,
    data: { indices, bullets }
  };
}

/**
 * @param {string} contextKind
 * @param {{ symbol?: string, chartLabel: string }} opts
 */
async function fetchChartContext(contextKind, opts) {
  const { symbol, chartLabel } = opts;
  if (contextKind === 'annual' || contextKind === 'stats') {
    return buildStatsContext(symbol, chartLabel || 'returns');
  }
  if (contextKind === 'ohlc') {
    return buildOhlcContext(symbol);
  }
  return buildMarketContext(chartLabel);
}

module.exports = { fetchChartContext };
