// Portfolio-level analytics for paper trading (summaries, sector allocation).

const supabaseService = require('../../config/supabaseService');
const bigquery = require('../../config/bigquery');
const {
  enrichLotsWithPnl,
  aggregateLotsToPositions,
  summarizeAccountMetrics
} = require('./pnlCalculator');
const { listAccountsForUser } = require('./orderEngine');

const TICKER_DETAILS_TABLE = process.env.TICKER_DETAILS_TABLE || 'TickerDetails';
const TICKER_DETAILS_SYMBOL_COLUMN = (process.env.TICKER_DETAILS_SYMBOL_COLUMN || 'Symbol').trim();
const TICKER_DETAILS_FQN = process.env.TICKER_DETAILS_FQN || `extended-byway-454621-s6.sp500data1.${TICKER_DETAILS_TABLE}`;

function detailRowScore(row) {
  let n = 0;
  if (row?.Security) n += 1;
  if (row?.Sector) n += 2;
  if (row?.Industry) n += 1;
  return n;
}

function mergeTickerDetailRowsBySymbol(rawRows) {
  const map = new Map();
  for (const r of rawRows || []) {
    const sym = String(r.Symbol || r.symbol || '').toUpperCase().trim();
    if (!sym) continue;
    const row = {
      Symbol: sym,
      Sector: String(r.Sector ?? r.sector ?? '').trim(),
      Industry: String(r.Industry ?? r.industry ?? '').trim()
    };
    const prev = map.get(sym);
    if (!prev || detailRowScore(row) > detailRowScore(prev)) {
      map.set(sym, row);
    }
  }
  return map;
}

async function fetchSectorMapForSymbols(symbols) {
  const unique = [...new Set((symbols || []).map((s) => String(s || '').toUpperCase().trim()).filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;

  const tickersParam = unique.map((t) => `'${t.replace(/'/g, "\\'")}'`).join(', ');
  const col = /^[A-Za-z_][A-Za-z0-9_]*$/.test(TICKER_DETAILS_SYMBOL_COLUMN)
    ? TICKER_DETAILS_SYMBOL_COLUMN
    : 'Symbol';

  try {
    const sql = `
      SELECT \`${col}\` AS Symbol, Sector, Industry
      FROM \`${TICKER_DETAILS_FQN}\`
      WHERE UPPER(TRIM(CAST(\`${col}\` AS STRING))) IN (${tickersParam})
    `;
    const [rows] = await bigquery.query({ query: sql });
    const merged = mergeTickerDetailRowsBySymbol(rows);
    for (const [sym, row] of merged) {
      map.set(sym, row.Sector || 'Other');
    }
  } catch (err) {
    console.warn('[paper-portfolio-analytics] sector lookup:', err?.message || err);
  }

  for (const sym of unique) {
    if (!map.has(sym)) map.set(sym, 'Other');
  }
  return map;
}

async function loadAccountMetrics(account) {
  const { data: lots, error: lotErr } = await supabaseService
    .from('paper_position_lots')
    .select('*')
    .eq('account_id', account.id)
    .eq('status', 'open')
    .gt('remaining_qty', 0);
  if (lotErr) throw lotErr;

  const { data: closedTrades, error: closeErr } = await supabaseService
    .from('paper_trades_closed')
    .select('net_realized_pnl')
    .eq('account_id', account.id);
  if (closeErr) throw closeErr;

  const enrichedLots = await enrichLotsWithPnl(lots || []);
  const positions = aggregateLotsToPositions(enrichedLots);
  const metrics = summarizeAccountMetrics(account, positions, closedTrades || []);

  return {
    id: account.id,
    name: account.name,
    starting_capital: Number(account.starting_capital) || 100000,
    ...metrics,
    positions_count: positions.length
  };
}

async function getAutomatedAccountIds(userId) {
  const { data, error } = await supabaseService
    .from('paper_strategies')
    .select('paper_strategy_account_bindings(account_id, is_active)')
    .eq('user_id', userId);
  if (error) return new Set();
  const ids = new Set();
  for (const s of data || []) {
    for (const b of s.paper_strategy_account_bindings || []) {
      if (b.is_active && b.account_id) ids.add(b.account_id);
    }
  }
  return ids;
}

/**
 * @param {string} userId
 */
async function getAccountsSummary(userId) {
  const accounts = await listAccountsForUser(userId);
  const automated = await getAutomatedAccountIds(userId);
  const summaries = [];
  for (const account of accounts) {
    const row = await loadAccountMetrics(account);
    summaries.push({
      ...row,
      is_automated: automated.has(account.id)
    });
  }
  return summaries;
}

/**
 * @param {string} userId
 * @param {string} accountId
 */
async function getSectorAllocation(userId, accountId) {
  const { resolveAccountForUser } = require('./orderEngine');
  const account = await resolveAccountForUser(userId, accountId);
  const { data: lots, error } = await supabaseService
    .from('paper_position_lots')
    .select('*')
    .eq('account_id', account.id)
    .eq('status', 'open')
    .gt('remaining_qty', 0);
  if (error) throw error;

  const enrichedLots = await enrichLotsWithPnl(lots || []);
  const positions = aggregateLotsToPositions(enrichedLots);
  const equity = Number((await loadAccountMetrics(account)).equity) || 0;
  const tickers = positions.map((p) => p.ticker).filter(Boolean);
  const sectorMap = await fetchSectorMapForSymbols(tickers);

  const bySector = new Map();
  for (const p of positions) {
    const sym = String(p.ticker || '').toUpperCase();
    const sector = sectorMap.get(sym) || 'Other';
    const mv = Math.abs(Number(p.market_value) || 0);
    if (mv <= 0) continue;
    const cur = bySector.get(sector) || { sector, market_value: 0, weight_pct: 0, tickers: [] };
    cur.market_value += mv;
    if (!cur.tickers.includes(sym)) cur.tickers.push(sym);
    bySector.set(sector, cur);
  }

  const rows = [...bySector.values()]
    .map((r) => ({
      sector: r.sector,
      market_value: Math.round(r.market_value * 100) / 100,
      weight_pct: equity > 0 ? Math.round((r.market_value / equity) * 1000) / 10 : 0,
      tickers: r.tickers.sort()
    }))
    .sort((a, b) => b.market_value - a.market_value);

  return { equity, sectors: rows };
}

/**
 * @param {string} userId
 */
async function getCompareHistory(userId) {
  const accounts = await listAccountsForUser(userId);
  const histories = [];
  for (const account of accounts) {
    const { data, error } = await supabaseService
      .from('paper_portfolio_snapshots')
      .select('snapshot_at, equity, cash')
      .eq('account_id', account.id)
      .order('snapshot_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    histories.push({
      account_id: account.id,
      name: account.name,
      history: (data || []).map((row) => ({
        snapshot_at: row.snapshot_at,
        equity: row.equity,
        cash_balance: row.cash
      }))
    });
  }
  return histories;
}

module.exports = {
  getAccountsSummary,
  getSectorAllocation,
  getCompareHistory,
  fetchSectorMapForSymbols
};
