// Live P&L: latest close from BigQuery OHLC (same table as utils/watchlistUtils fetchOHLC).
// No Redis price:${ticker} cache exists in this codebase.

const bigquery = require('../../config/bigquery');

const OHLC_TABLE = '`extended-byway-454621-s6.sp500data1.DailyOHLC200MAData`';

function bqArray(arr) {
  return arr.map((s) => `'${String(s).replace(/'/g, "\\'")}'`).join(',');
}

/**
 * @param {string[]} symbols
 * @returns {Promise<Map<string, number>>}
 */
async function fetchLatestClosePrices(symbols) {
  const list = [...new Set((symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  const map = new Map();
  if (list.length === 0) return map;

  const q = `
    SELECT ticker, close_price AS close
    FROM ${OHLC_TABLE}
    WHERE ticker IN (${bqArray(list)})
    QUALIFY ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY market_date DESC) = 1
  `;
  const [job] = await bigquery.createQueryJob({ query: q });
  const [rows] = await job.getQueryResults();
  rows.forEach((r) => {
    const close = r.close != null ? Number(r.close) : null;
    if (close != null && Number.isFinite(close)) {
      map.set(String(r.ticker).toUpperCase(), close);
    }
  });
  return map;
}

/**
 * @param {string} ticker
 * @returns {Promise<number|null>}
 */
async function getCurrentPrice(ticker) {
  const sym = String(ticker || '').trim().toUpperCase();
  if (!sym) return null;
  const map = await fetchLatestClosePrices([sym]);
  return map.get(sym) ?? null;
}

/**
 * @param {Array<{ ticker: string, qty: number, avg_cost: number }>} positions
 */
async function enrichPositionsWithPnl(positions) {
  const open = (positions || []).filter((p) => Number(p.qty) !== 0);
  const symbols = open.map((p) => p.ticker);
  const priceMap = await fetchLatestClosePrices(symbols);

  return open.map((p) => {
    const qty = Number(p.qty);
    const avgCost = Number(p.avg_cost) || 0;
    const currentPrice = priceMap.get(String(p.ticker).toUpperCase()) ?? null;
    const marketValue =
      currentPrice != null ? Math.round(qty * currentPrice * 100) / 100 : null;
    let unrealizedPnl = null;
    let unrealizedPnlPct = null;
    if (currentPrice != null && avgCost > 0) {
      unrealizedPnl = Math.round((currentPrice - avgCost) * qty * 100) / 100;
      unrealizedPnlPct = Math.round(((currentPrice - avgCost) / avgCost) * 10000) / 100;
    }
    return {
      ...p,
      current_price: currentPrice,
      market_value: marketValue,
      unrealized_pnl: unrealizedPnl,
      unrealized_pnl_pct: unrealizedPnlPct
    };
  });
}

async function enrichLotsWithPnl(lots) {
  const openLots = (lots || []).filter((p) => Number(p.remaining_qty) > 0);
  const symbols = openLots.map((p) => p.ticker);
  const priceMap = await fetchLatestClosePrices(symbols);
  return openLots.map((lot) => {
    const qty = Number(lot.remaining_qty || 0);
    const entry = Number(lot.entry_price || 0);
    const currentPrice = priceMap.get(String(lot.ticker).toUpperCase()) ?? null;
    let unrealized = null;
    let unrealizedPct = null;
    if (currentPrice != null && entry > 0 && qty > 0) {
      const gross =
        lot.side === 'long' ? (currentPrice - entry) * qty : (entry - currentPrice) * qty;
      unrealized = Math.round(gross * 100) / 100;
      unrealizedPct = Math.round(((gross / (entry * qty)) * 100) * 100) / 100;
    }
    // Long: +qty×price (asset). Short: −qty×price (liability) — both flow into portfolio equity.
    const signedMarketValue =
      currentPrice != null
        ? Math.round((lot.side === 'long' ? qty : -qty) * currentPrice * 100) / 100
        : null;
    return {
      ...lot,
      current_price: currentPrice,
      market_value: signedMarketValue,
      unrealized_pnl: unrealized,
      unrealized_pnl_pct: unrealizedPct
    };
  });
}

function aggregateLotsToPositions(enrichedLots) {
  const byTicker = new Map();
  for (const lot of enrichedLots || []) {
    const t = String(lot.ticker || '').toUpperCase();
    const row = byTicker.get(t) || {
      ticker: t,
      long_qty: 0,
      short_qty: 0,
      net_qty: 0,
      avg_long_cost: 0,
      avg_short_cost: 0,
      current_price: lot.current_price,
      long_market_value: 0,
      short_market_value: 0,
      market_value: 0,
      unrealized_pnl: 0
    };
    const qty = Number(lot.remaining_qty || 0);
    const entry = Number(lot.entry_price || 0);
    if (lot.side === 'long') {
      row.long_qty += qty;
      row.avg_long_cost += qty * entry;
    } else {
      row.short_qty += qty;
      row.avg_short_cost += qty * entry;
    }
    row.net_qty = row.long_qty - row.short_qty;
    row.current_price = lot.current_price;
    const lotMv = Number(lot.market_value || 0);
    row.market_value += lotMv;
    if (lot.side === 'long') row.long_market_value += lotMv;
    else row.short_market_value += Math.abs(lotMv);
    row.unrealized_pnl += Number(lot.unrealized_pnl || 0);
    byTicker.set(t, row);
  }
  return [...byTicker.values()].map((r) => ({
    ...r,
    avg_long_cost: r.long_qty > 0 ? Math.round((r.avg_long_cost / r.long_qty) * 10000) / 10000 : null,
    avg_short_cost: r.short_qty > 0 ? Math.round((r.avg_short_cost / r.short_qty) * 10000) / 10000 : null,
    long_market_value: Math.round(r.long_market_value * 100) / 100,
    short_market_value: Math.round(r.short_market_value * 100) / 100,
    market_value: Math.round(r.market_value * 100) / 100,
    unrealized_pnl: Math.round(r.unrealized_pnl * 100) / 100
  }));
}

/** Portfolio equity = cash + long market value − short market value (signed lot sums). */
function sumPositionMarketValue(positions) {
  return (positions || []).reduce((s, p) => s + Number(p.market_value || 0), 0);
}

function summarizeAccountMetrics(account, openPositions, closedTrades) {
  const cash = Number(account.cash_balance) || 0;
  const unrealized = (openPositions || []).reduce((sum, p) => sum + Number(p.unrealized_pnl || 0), 0);
  const realized = (closedTrades || []).reduce((sum, t) => sum + Number(t.net_realized_pnl || 0), 0);
  const equity = Math.round((cash + sumPositionMarketValue(openPositions)) * 100) / 100;
  const starting = Number(account.starting_capital) || 100000;
  const totalReturn = Math.round((equity - starting) * 100) / 100;
  const totalReturnPct = starting > 0 ? Math.round(((equity - starting) / starting) * 10000) / 100 : 0;
  return {
    equity,
    cash,
    buying_power: cash,
    unrealized_pnl_total: Math.round(unrealized * 100) / 100,
    realized_pnl_total: Math.round(realized * 100) / 100,
    total_return: totalReturn,
    total_return_pct: totalReturnPct,
    open_trades_count: openPositions.length,
    closed_trades_count: (closedTrades || []).length
  };
}

/**
 * @param {{ cash_balance: number }} account
 * @param {Array<{ market_value?: number|null }>} positions
 */
function calcEquity(account, positions) {
  const cash = Number(account.cash_balance) || 0;
  return Math.round((cash + sumPositionMarketValue(positions)) * 100) / 100;
}

module.exports = {
  getCurrentPrice,
  fetchLatestClosePrices,
  enrichPositionsWithPnl,
  enrichLotsWithPnl,
  aggregateLotsToPositions,
  summarizeAccountMetrics,
  calcEquity
};
