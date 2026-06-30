const supabaseService = require('../../config/supabaseService');
const {
  enrichLotsWithPnl,
  aggregateLotsToPositions,
  summarizeAccountMetrics
} = require('./pnlCalculator');
const { fetchSectorMapForSymbols } = require('./portfolioAnalytics');

async function resolveOwnerLabel(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return 'Unknown user';

  const { data: profile } = await supabaseService
    .from('user_profiles')
    .select('display_name')
    .eq('id', uid)
    .maybeSingle();

  const displayName = String(profile?.display_name || '').trim();
  if (displayName) return displayName;

  try {
    const { data, error } = await supabaseService.auth.admin.getUserById(uid);
    if (!error && data?.user?.email) return String(data.user.email).trim();
  } catch {
    // ignore auth lookup errors
  }

  return 'Unknown user';
}

async function resolveOwnerLabels(userIds) {
  const unique = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const labelByUser = new Map();
  if (!unique.length) return labelByUser;

  const { data: profiles } = await supabaseService
    .from('user_profiles')
    .select('id, display_name')
    .in('id', unique);

  for (const row of profiles || []) {
    const name = String(row.display_name || '').trim();
    if (name) labelByUser.set(row.id, name);
  }

  await Promise.all(
    unique
      .filter((uid) => !labelByUser.has(uid))
      .map(async (uid) => {
        try {
          const { data, error } = await supabaseService.auth.admin.getUserById(uid);
          if (!error && data?.user?.email) {
            labelByUser.set(uid, String(data.user.email).trim());
          }
        } catch {
          // ignore
        }
      })
  );

  for (const uid of unique) {
    if (!labelByUser.has(uid)) labelByUser.set(uid, 'Unknown user');
  }

  return labelByUser;
}

async function getPublishedAccount(accountId) {
  const id = String(accountId || '').trim();
  if (!id) return null;

  const { data, error } = await supabaseService
    .from('paper_accounts')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getBoundStrategyLabel(accountId) {
  const { data: binding } = await supabaseService
    .from('paper_strategy_account_bindings')
    .select('paper_strategies(name, strategy_key, is_active)')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const strategy = binding?.paper_strategies;
  if (!strategy) return null;
  const name = String(strategy.name || '').trim();
  if (name) return name;
  const key = String(strategy.strategy_key || '').trim();
  return key || null;
}

function publicMetaFields(account) {
  return {
    publish_description: account.publish_description ? String(account.publish_description) : '',
    publish_strategy: account.publish_strategy ? String(account.publish_strategy) : ''
  };
}

async function loadPublishedAccountSnapshot(account) {
  const { data: lots, error: lotErr } = await supabaseService
    .from('paper_position_lots')
    .select('*')
    .eq('account_id', account.id)
    .eq('status', 'open')
    .gt('remaining_qty', 0);
  if (lotErr) throw lotErr;

  const { data: closedTrades, error: closeErr } = await supabaseService
    .from('paper_trades_closed')
    .select('*')
    .eq('account_id', account.id)
    .order('closed_at', { ascending: false })
    .limit(500);
  if (closeErr) throw closeErr;

  const enrichedLots = await enrichLotsWithPnl(lots || []);
  const positions = aggregateLotsToPositions(enrichedLots);
  const metrics = summarizeAccountMetrics(account, positions, closedTrades || []);
  const ownerLabel = await resolveOwnerLabel(account.user_id);
  const strategyLabel = await getBoundStrategyLabel(account.id);

  return {
    id: account.id,
    name: account.name,
    owner_label: ownerLabel,
    published_at: account.published_at,
    strategy_mode: account.strategy_mode || 'manual',
    strategy_label: strategyLabel,
    ...publicMetaFields(account),
    starting_capital: Number(account.starting_capital) || 100000,
    ...metrics,
    cash_balance: Number(account.cash_balance) || metrics.cash || 0,
    positions_count: positions.length,
    positions
  };
}

async function listPublishedPortfolios() {
  const { data: accounts, error } = await supabaseService
    .from('paper_accounts')
    .select('id, user_id, name, cash_balance, starting_capital, published_at, strategy_mode')
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  if (error) throw error;
  const rows = accounts || [];
  if (!rows.length) return [];

  const labels = await resolveOwnerLabels(rows.map((r) => r.user_id));
  const summaries = [];

  for (const account of rows) {
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

    summaries.push({
      id: account.id,
      name: account.name,
      owner_label: labels.get(account.user_id) || 'Unknown user',
      published_at: account.published_at,
      strategy_mode: account.strategy_mode || 'manual',
      publish_description: account.publish_description ? String(account.publish_description) : '',
      publish_strategy: account.publish_strategy ? String(account.publish_strategy) : '',
      starting_capital: Number(account.starting_capital) || 100000,
      equity: metrics.equity,
      total_return: metrics.total_return,
      total_return_pct: metrics.total_return_pct,
      positions_count: positions.length
    });
  }

  return summaries;
}

async function getPublishedPortfolioDetail(accountId) {
  const account = await getPublishedAccount(accountId);
  if (!account) {
    const err = new Error('Portfolio not found');
    err.status = 404;
    throw err;
  }
  return loadPublishedAccountSnapshot(account);
}

async function getPublishedPortfolioHistory(accountId) {
  const account = await getPublishedAccount(accountId);
  if (!account) {
    const err = new Error('Portfolio not found');
    err.status = 404;
    throw err;
  }

  const { data, error } = await supabaseService
    .from('paper_portfolio_snapshots')
    .select('snapshot_at, equity, cash')
    .eq('account_id', account.id)
    .order('snapshot_at', { ascending: true })
    .limit(500);

  if (error) throw error;
  return (data || []).map((row) => ({
    snapshot_at: row.snapshot_at,
    equity: row.equity,
    cash_balance: row.cash
  }));
}

async function getPublishedClosedTrades(accountId) {
  const account = await getPublishedAccount(accountId);
  if (!account) {
    const err = new Error('Portfolio not found');
    err.status = 404;
    throw err;
  }

  const { data, error } = await supabaseService
    .from('paper_trades_closed')
    .select('*')
    .eq('account_id', account.id)
    .order('closed_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const totals = (data || []).reduce(
    (acc, row) => {
      acc.realized += Number(row.net_realized_pnl || 0);
      acc.gross += Number(row.gross_realized_pnl || 0);
      return acc;
    },
    { realized: 0, gross: 0 }
  );

  return {
    trades: data || [],
    totals: {
      gross_realized_pnl: Math.round(totals.gross * 100) / 100,
      net_realized_pnl: Math.round(totals.realized * 100) / 100
    }
  };
}

async function getPublishedSectorAllocation(accountId) {
  const account = await getPublishedAccount(accountId);
  if (!account) {
    const err = new Error('Portfolio not found');
    err.status = 404;
    throw err;
  }

  const { data: lots, error } = await supabaseService
    .from('paper_position_lots')
    .select('*')
    .eq('account_id', account.id)
    .eq('status', 'open')
    .gt('remaining_qty', 0);
  if (error) throw error;

  const enrichedLots = await enrichLotsWithPnl(lots || []);
  const positions = aggregateLotsToPositions(enrichedLots);
  const equity =
    Number(summarizeAccountMetrics(account, positions, []).equity) || 0;
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

async function getPublishedOrders(accountId) {
  const account = await getPublishedAccount(accountId);
  if (!account) {
    const err = new Error('Portfolio not found');
    err.status = 404;
    throw err;
  }

  const { data, error } = await supabaseService
    .from('paper_orders')
    .select('*')
    .eq('account_id', account.id)
    .order('submitted_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

async function getPublishedStrategy(accountId) {
  const account = await getPublishedAccount(accountId);
  if (!account) {
    const err = new Error('Portfolio not found');
    err.status = 404;
    throw err;
  }

  const { data: binding, error: bErr } = await supabaseService
    .from('paper_strategy_account_bindings')
    .select('*, paper_strategies(*, paper_strategy_rules(*))')
    .eq('account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bErr) throw bErr;

  if (!binding?.paper_strategies) {
    return { strategy: null, binding: null, rules: [], executionLog: [] };
  }

  const strategy = binding.paper_strategies;
  const rules = (strategy.paper_strategy_rules || []).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const { data: log, error: logErr } = await supabaseService
    .from('paper_strategy_execution_log')
    .select('*, paper_strategy_rules(rule_type, ticker, action)')
    .eq('account_id', account.id)
    .order('ran_at', { ascending: false })
    .limit(50);
  if (logErr) throw logErr;

  return {
    strategy: { ...strategy, paper_strategy_rules: undefined },
    binding: {
      id: binding.id,
      strategy_id: binding.strategy_id,
      account_id: binding.account_id,
      is_active: binding.is_active,
      last_run_at: binding.last_run_at,
      last_error: binding.last_error,
      created_at: binding.created_at
    },
    rules,
    executionLog: log || []
  };
}

module.exports = {
  listPublishedPortfolios,
  getPublishedPortfolioDetail,
  getPublishedPortfolioHistory,
  getPublishedClosedTrades,
  getPublishedSectorAllocation,
  getPublishedOrders,
  getPublishedStrategy
};
