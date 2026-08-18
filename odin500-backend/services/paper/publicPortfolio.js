const supabaseService = require('../../config/supabaseService');
const redis = require('../../config/redis');
const {
  enrichLotsWithPnl,
  aggregateLotsToPositions,
  summarizeAccountMetrics
} = require('./pnlCalculator');
const { fetchSectorMapForSymbols } = require('./portfolioAnalytics');
const { getRebalanceLogForAccount } = require('./rebalanceLogReader');

/**
 * Portfolios owned by an Odin admin are published under a single house identity rather than a
 * personal display name — they read as first-party Odin books, not one staffer's account.
 */
const ADMIN_OWNER_LABEL = 'Admin';

async function resolveOwnerInfo(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return { label: 'Unknown user', isAdmin: false };

  const { data: profile } = await supabaseService
    .from('user_profiles')
    .select('display_name, is_admin')
    .eq('id', uid)
    .maybeSingle();

  if (profile?.is_admin) return { label: ADMIN_OWNER_LABEL, isAdmin: true };

  const displayName = String(profile?.display_name || '').trim();
  if (displayName) return { label: displayName, isAdmin: false };

  try {
    const { data, error } = await supabaseService.auth.admin.getUserById(uid);
    if (!error && data?.user?.email) return { label: String(data.user.email).trim(), isAdmin: false };
  } catch {
    // ignore auth lookup errors
  }

  return { label: 'Unknown user', isAdmin: false };
}

/**
 * Batch owner lookup. Returns display label plus the admin flag, which decides both the label
 * shown and which of the two AI galleries a portfolio belongs to.
 * @returns {Promise<Map<string, {label: string, isAdmin: boolean}>>}
 */
async function resolveOwnerInfos(userIds) {
  const unique = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const infoByUser = new Map();
  if (!unique.length) return infoByUser;

  const { data: profiles } = await supabaseService
    .from('user_profiles')
    .select('id, display_name, is_admin')
    .in('id', unique);

  for (const row of profiles || []) {
    if (row.is_admin) {
      infoByUser.set(row.id, { label: ADMIN_OWNER_LABEL, isAdmin: true });
      continue;
    }
    const name = String(row.display_name || '').trim();
    if (name) infoByUser.set(row.id, { label: name, isAdmin: false });
  }

  await Promise.all(
    unique
      .filter((uid) => !infoByUser.has(uid))
      .map(async (uid) => {
        try {
          const { data, error } = await supabaseService.auth.admin.getUserById(uid);
          if (!error && data?.user?.email) {
            infoByUser.set(uid, { label: String(data.user.email).trim(), isAdmin: false });
          }
        } catch {
          // ignore
        }
      })
  );

  for (const uid of unique) {
    if (!infoByUser.has(uid)) infoByUser.set(uid, { label: 'Unknown user', isAdmin: false });
  }

  return infoByUser;
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
    publish_strategy: account.publish_strategy ? String(account.publish_strategy) : '',
    ai_managed: Boolean(account.ai_managed),
    ai_engine: account.ai_engine || null,
    ai_index_focus: account.ai_index_focus || null,
    ai_direction: account.ai_direction || null,
    ai_criteria: account.ai_criteria || null,
    ai_rebalance_cadence: account.ai_rebalance_cadence || null,
    // Null on accounts created before the position-sizing migration.
    ai_position_count: account.ai_position_count ?? null,
    ai_position_sizing: account.ai_position_sizing || null,
    ai_position_qty: account.ai_position_qty ?? null,
    // Missing column (migration not yet run) means copying stays available.
    allow_copy: account.allow_copy !== false
  };
}

/** Average calendar days per month (for fair age normalization across portfolios). */
const DAYS_PER_MONTH = 30.4375;

/**
 * A book younger than this has no meaningful monthly rate — dividing a few days of return by a
 * fraction of a month extrapolates wildly (11 days at +7.5% reads as +21%/month). Below the
 * threshold the figure is withheld entirely and the UI shows N/A.
 */
const MIN_MONTHS_FOR_AVG = 1;

/**
 * Normalize total return into an average monthly % so books of different ages compare fairly.
 * Simple (linear) method: total_return_pct / months_elapsed, and only once a full month has
 * actually elapsed.
 * @returns {{ months_elapsed: number|null, days_elapsed: number|null, avg_monthly_return_pct: number|null }}
 */
function computeAvgMonthlyReturn(totalReturnPct, startIso) {
  const startMs = Date.parse(String(startIso || ''));
  if (!Number.isFinite(startMs)) {
    return { months_elapsed: null, days_elapsed: null, avg_monthly_return_pct: null };
  }
  const days = Math.max(0, (Date.now() - startMs) / 86400000);
  const months = days / DAYS_PER_MONTH;
  const total = Number(totalReturnPct);
  const base = {
    months_elapsed: Math.round(months * 100) / 100,
    days_elapsed: Math.round(days * 10) / 10
  };

  if (!Number.isFinite(total) || months < MIN_MONTHS_FOR_AVG) {
    return { ...base, avg_monthly_return_pct: null };
  }
  return { ...base, avg_monthly_return_pct: Math.round((total / months) * 100) / 100 };
}

/**
 * Creation, not publication. An owner who traded for months before publishing has a track record
 * that long, and dating it from `published_at` divides the same total return by a shorter window,
 * overstating the monthly rate. Keep this in step with the frontend's portfolioAgeMetrics.js —
 * the leaderboard column comes from here while the summary card computes its own.
 */
function performanceStartAt(account) {
  return account.created_at || account.published_at || null;
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
  const owner = await resolveOwnerInfo(account.user_id);
  const strategyLabel = await getBoundStrategyLabel(account.id);
  const copyCount = await getCopyCount(account.id);

  return {
    id: account.id,
    name: account.name,
    owner_label: owner.label,
    owner_is_admin: owner.isAdmin,
    published_at: account.published_at,
    // The detail page's avg-monthly-return card dates the track record from creation.
    created_at: account.created_at,
    strategy_mode: account.strategy_mode || 'manual',
    strategy_label: strategyLabel,
    ...publicMetaFields(account),
    starting_capital: Number(account.starting_capital) || 100000,
    ...metrics,
    cash_balance: Number(account.cash_balance) || metrics.cash || 0,
    positions_count: positions.length,
    copy_count: copyCount,
    positions
  };
}

/** Copies made from this portfolio. Returns 0 if the lineage migration has not been run. */
async function getCopyCount(accountId) {
  try {
    const { count, error } = await supabaseService
      .from('paper_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('copied_from_account_id', accountId);
    if (error) return 0;
    return Number(count) || 0;
  } catch {
    return 0;
  }
}

const PUBLIC_LIST_CACHE_KEY = 'public:paper:portfolios:list:v2';
/** In-process fallback when Redis is unavailable (dev / misconfigured). */
let publicListMemoryCache = null;
/** Deduplicate concurrent cold loads (one BigQuery scan shared by waiters). */
let publicListInFlight = null;

async function invalidatePublicPortfoliosListCache() {
  publicListMemoryCache = null;
  publicListInFlight = null;
  if (!redis) return;
  try {
    await redis.del(PUBLIC_LIST_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

async function buildPublishedPortfoliosList() {
  const { data: accounts, error } = await supabaseService
    .from('paper_accounts')
    .select(
      'id, user_id, name, cash_balance, starting_capital, created_at, published_at, strategy_mode, publish_description, publish_strategy, ai_managed, ai_engine, ai_index_focus, ai_direction, ai_criteria, ai_rebalance_cadence'
    )
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  if (error) throw error;
  const rows = accounts || [];
  if (!rows.length) return [];

  const accountIds = rows.map((r) => r.id);

  // Parallel Supabase reads + owner labels (avoids N sequential round-trips).
  const [owners, lotsRes, closedRes] = await Promise.all([
    resolveOwnerInfos(rows.map((r) => r.user_id)),
    supabaseService
      .from('paper_position_lots')
      .select('*')
      .in('account_id', accountIds)
      .eq('status', 'open')
      .gt('remaining_qty', 0),
    supabaseService
      .from('paper_trades_closed')
      .select('account_id, net_realized_pnl')
      .in('account_id', accountIds)
  ]);

  if (lotsRes.error) throw lotsRes.error;
  if (closedRes.error) throw closedRes.error;

  const closedByAccount = new Map();
  for (const row of closedRes.data || []) {
    const aid = row.account_id;
    if (!closedByAccount.has(aid)) closedByAccount.set(aid, []);
    closedByAccount.get(aid).push(row);
  }

  // One BigQuery latest-price scan for all tickers across all published books.
  const enrichedAll = await enrichLotsWithPnl(lotsRes.data || []);
  const enrichedByAccount = new Map();
  for (const lot of enrichedAll) {
    const aid = lot.account_id;
    if (!enrichedByAccount.has(aid)) enrichedByAccount.set(aid, []);
    enrichedByAccount.get(aid).push(lot);
  }

  const summaries = rows.map((account) => {
    const enrichedLots = enrichedByAccount.get(account.id) || [];
    const positions = aggregateLotsToPositions(enrichedLots);
    const closedTrades = closedByAccount.get(account.id) || [];
    const metrics = summarizeAccountMetrics(account, positions, closedTrades);
    const avgMonthly = computeAvgMonthlyReturn(metrics.total_return_pct, performanceStartAt(account));

    return {
      id: account.id,
      name: account.name,
      owner_label: owners.get(account.user_id)?.label || 'Unknown user',
      owner_is_admin: Boolean(owners.get(account.user_id)?.isAdmin),
      published_at: account.published_at,
      strategy_mode: account.strategy_mode || 'manual',
      publish_description: account.publish_description ? String(account.publish_description) : '',
      publish_strategy: account.publish_strategy ? String(account.publish_strategy) : '',
      ai_managed: Boolean(account.ai_managed),
      ai_engine: account.ai_engine || null,
      ai_index_focus: account.ai_index_focus || null,
      ai_direction: account.ai_direction || null,
      ai_criteria: account.ai_criteria || null,
      ai_rebalance_cadence: account.ai_rebalance_cadence || null,
      starting_capital: Number(account.starting_capital) || 100000,
      equity: metrics.equity,
      total_return: metrics.total_return,
      total_return_pct: metrics.total_return_pct,
      months_elapsed: avgMonthly.months_elapsed,
      days_elapsed: avgMonthly.days_elapsed,
      avg_monthly_return_pct: avgMonthly.avg_monthly_return_pct,
      positions_count: positions.length
    };
  });

  // Default ranking: highest total return (nulls last). Average monthly return is still
  // computed on every row but no longer ranks anything — see SORT_KEYS in publicPortfolioQuery.js.
  summaries.sort((a, b) => {
    const av = a.total_return_pct;
    const bv = b.total_return_pct;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return Number(bv) - Number(av);
  });

  return summaries;
}

async function listPublishedPortfolios() {
  const CACHE_TTL_SEC = Number(process.env.PUBLIC_PORTFOLIOS_CACHE_TTL_SECS || 300);
  const now = Date.now();

  if (publicListMemoryCache && publicListMemoryCache.expiresAt > now) {
    return publicListMemoryCache.portfolios;
  }

  if (redis) {
    try {
      const cached = await redis.get(PUBLIC_LIST_CACHE_KEY);
      if (cached && Array.isArray(cached.portfolios)) {
        publicListMemoryCache = {
          portfolios: cached.portfolios,
          expiresAt: now + Math.min(CACHE_TTL_SEC, 60) * 1000
        };
        return cached.portfolios;
      }
    } catch {
      /* ignore cache read errors */
    }
  }

  if (publicListInFlight) {
    return publicListInFlight;
  }

  publicListInFlight = (async () => {
    try {
      const summaries = await buildPublishedPortfoliosList();

      if (CACHE_TTL_SEC > 0) {
        publicListMemoryCache = {
          portfolios: summaries,
          expiresAt: Date.now() + CACHE_TTL_SEC * 1000
        };
        if (redis) {
          try {
            await redis.set(
              PUBLIC_LIST_CACHE_KEY,
              { portfolios: summaries, cached_at: new Date().toISOString() },
              { ex: CACHE_TTL_SEC }
            );
          } catch {
            /* ignore cache write errors */
          }
        }
      }

      return summaries;
    } finally {
      publicListInFlight = null;
    }
  })();

  return publicListInFlight;
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

/**
 * AI rebalance history for a published portfolio.
 *
 * Reasoning is included: a published AI book's whole claim is that its decisions are inspectable,
 * and the owner opted into publishing. Flip `includeReasoning` to false here to withhold the
 * model's raw text from public viewers while keeping it on the owner's own page.
 */
async function getPublishedRebalances(accountId) {
  const account = await getPublishedAccount(accountId);
  if (!account) {
    const err = new Error('Portfolio not found');
    err.status = 404;
    throw err;
  }
  return getRebalanceLogForAccount(account.id, { includeReasoning: true });
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
  invalidatePublicPortfoliosListCache,
  getPublishedPortfolioDetail,
  getPublishedPortfolioHistory,
  getPublishedClosedTrades,
  getPublishedSectorAllocation,
  getPublishedOrders,
  getPublishedRebalances,
  getPublishedStrategy
};
