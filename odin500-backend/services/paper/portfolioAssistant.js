const crypto = require('crypto');
const fetch = require('node-fetch');
const supabaseService = require('../../config/supabaseService');
const analyticsData = require('../../analyticsData');
const { resolveAccountForUser } = require('./orderEngine');
const {
  enrichLotsWithPnl,
  aggregateLotsToPositions,
  summarizeAccountMetrics,
  getCurrentPrice,
  fetchLatestClosePrices
} = require('./pnlCalculator');
const { getWatchlistSignalLeaders } = require('./watchlistResolver');
const {
  getLatestSignalBucket,
  getLatestSignalsForTickers,
  signalSideFromBucket
} = require('./latestSignal');
const { buildTickerReport } = require('../tickerReportGenerator');
const { fetchNewsletterContext, formatContextForPrompt } = require('../newsletter/newsletterContext');
const { listNewsletterSummaries, getNewsletterBySlug } = require('../newsletter/newsletterStore');
const { getSectorAllocation, fetchSectorMapForSymbols } = require('./portfolioAnalytics');
const { fetchGeneralMarketNews, fetchCompanyNews } = require('../marketNews');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TOOL_ROUNDS = 8;
const MAX_RULES_PER_PROPOSAL = 4;
const VALID_ACTIONS = new Set(['BTO', 'STO', 'BTC', 'STC']);
const VALID_BUCKETS = new Set(['L1', 'L2', 'L3', 'S1', 'S2', 'S3', 'N']);
/** API rule_type values stored in paper_strategy_rules / evaluated by strategyRunner. */
const VALID_RULE_TYPES = new Set([
  'always',
  'signal_bucket',
  'signal_side',
  'price_above',
  'price_below'
]);
const ACTION_ALIASES = {
  BUY: 'BTO',
  LONG: 'BTO',
  SELL: 'STC',
  EXIT: 'STC',
  SHORT: 'STO',
  COVER: 'BTC',
  CLOSE: 'STC'
};

const SYSTEM_PROMPT = `You are the Odin500 assistant for ONE virtual (paper) portfolio and the Odin500 website.

SCOPE — answer ONLY questions about:
- This paper portfolio (equity, cash, positions, orders, closed trades, automation, rules)
- Odin500 website features (virtual portfolios, strategies, watchlists, ticker charts, monthly/annual ticker reports, returns, signals, newsletters, market snapshots, news on the site)
- Market/trading data available via your tools (prices, Odin signal buckets, returns, reports, news headlines, sector allocation)
- How Odin signal buckets / paper rules / automation work

OUT OF SCOPE — politely refuse and redirect:
- Homework, coding help, recipes, sports, politics, celebrity gossip, general chat unrelated to markets/Odin500
- Medical, legal, or tax advice
- Personal life questions
- Anything that is not trading, markets, or Odin500 product functionality
Refusal style: one short sentence that you only help with Odin500 / paper trading / market data on this site, then offer a relevant alternative (e.g. ask about a ticker, portfolio, or strategy).

Facts about the product:
- Paper fills use the latest Odin daily close with simulated slippage/fees — not live intraday quotes. Say "latest Odin daily close" when citing prices.
- Strategy rules are evaluated about every hour while automation is active.
- Signal buckets: L1/L2/L3 (bullish), S1/S2/S3 (bearish), N (neutral).
- Actions: BTO (buy to open), STO (short to open), STC (sell to close), BTC (buy to cover).
- rule_type MUST be one of: always | signal_bucket | signal_side | price_above | price_below.
- For signal_side, set params.side to "long", "short", or "neutral" (do NOT use rule_type signal_side_long).
- For signal_bucket, set params.buckets to an array like ["L2","L3"].
- Opening rules (BTO/STO) need qty AND a position cap: params.max_position_qty and/or params.max_position_value.
  Example opening rule:
  {"rule_type":"signal_bucket","ticker":"AAPL","action":"BTO","qty":10,"params":{"buckets":["L2","L3"],"max_position_qty":10}}
- Closing rules may use params.close_all=true with qty ignored.
- If the portfolio has no strategy (has_strategy=false), call propose_create_strategy_and_bind — not propose_create_rules.
- Never invent prices, signals, news, or account numbers. Always use tools.
- Prefer tools: get_ticker_prices, get_ticker_signals, get_ticker_report, get_ticker_returns, get_market_news, get_company_news, get_market_snapshot, get_newsletters, get_portfolio_sectors, plus portfolio tools.
- This is educational paper trading — not investment advice. Do not tell users to invest real money.
- You CANNOT mutate data directly. To create/update/delete rules or pause/resume/run, call the propose_* tools.
- Prefer concise, clear answers. When proposing changes, explain them in plain English.
- If a propose_* tool returns an error, fix the payload using the error message — do not call the same broken payload again.
- News headlines are informational only; summarize briefly and do not present them as trade recommendations.`;

/** In-memory proposals for this process (confirm runs on the client). */
const proposalStore = new Map();
const PROPOSAL_TTL_MS = 30 * 60 * 1000;

function pruneProposals() {
  const now = Date.now();
  for (const [id, row] of proposalStore) {
    if (now - row.at > PROPOSAL_TTL_MS) proposalStore.delete(id);
  }
}

function newProposalId() {
  return crypto.randomUUID();
}

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function openaiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || '',
    model:
      process.env.OPENAI_PORTFOLIO_CHAT_MODEL?.trim() ||
      process.env.OPENAI_PORTFOLIO_SUMMARY_MODEL?.trim() ||
      process.env.OPENAI_NEWSLETTER_MODEL?.trim() ||
      DEFAULT_MODEL,
    timeoutMs: Number(process.env.OPENAI_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  };
}

function normalizeTicker(t) {
  return String(t || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 12);
}

function normalizeAction(a) {
  const raw = String(a || '')
    .trim()
    .toUpperCase();
  const x = ACTION_ALIASES[raw] || raw;
  return VALID_ACTIONS.has(x) ? x : null;
}

function normalizeBuckets(raw) {
  const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const out = [];
  for (const b of list) {
    const u = String(b || '').toUpperCase();
    if (VALID_BUCKETS.has(u) && !out.includes(u)) out.push(u);
  }
  return out;
}

/**
 * Coerce common model / UI shapes into the API rule shape strategyRunner expects.
 */
function normalizeRuleInput(rule) {
  if (!rule || typeof rule !== 'object') return rule;
  const params = {
    ...(rule.params && typeof rule.params === 'object' ? rule.params : {})
  };
  let ruleType = String(rule.rule_type || 'always')
    .trim()
    .toLowerCase();

  // UI aliases → API signal_side + params.side
  if (ruleType === 'signal_side_long' || ruleType === 'long') {
    ruleType = 'signal_side';
    params.side = 'long';
  } else if (ruleType === 'signal_side_short' || ruleType === 'short') {
    ruleType = 'signal_side';
    params.side = 'short';
  } else if (ruleType === 'signal_side_neutral' || ruleType === 'neutral') {
    ruleType = 'signal_side';
    params.side = 'neutral';
  }

  if (ruleType === 'signal_side' && !params.side) {
    const actionHint = normalizeAction(rule.action);
    if (actionHint === 'BTO' || actionHint === 'STC') params.side = 'long';
    else if (actionHint === 'STO' || actionHint === 'BTC') params.side = 'short';
  }

  // Accept buckets at top-level or as a single string.
  if (ruleType === 'signal_bucket') {
    const buckets = normalizeBuckets(
      params.buckets ?? params.bucket ?? rule.buckets ?? rule.bucket ?? rule.signal_buckets
    );
    if (buckets.length) {
      params.buckets = buckets;
      if (buckets.length === 1) params.bucket = buckets[0];
    }
  }

  // Opening caps: prefer explicit params; else lift top-level; else default qty → max_position_qty.
  const action = normalizeAction(rule.action);
  if (action === 'BTO' || action === 'STO') {
    if (params.max_position_qty == null && rule.max_position_qty != null) {
      params.max_position_qty = rule.max_position_qty;
    }
    if (params.max_position_value == null && rule.max_position_value != null) {
      params.max_position_value = rule.max_position_value;
    }
    const maxPos = Number(params.max_position_qty);
    const maxVal = Number(params.max_position_value);
    const hasShares = Number.isFinite(maxPos) && maxPos > 0;
    const hasDollars = Number.isFinite(maxVal) && maxVal > 0;
    if (!hasShares && !hasDollars) {
      const qty = Number(rule.qty);
      if (Number.isFinite(qty) && qty > 0) params.max_position_qty = qty;
    }
  }

  return {
    ...rule,
    rule_type: ruleType,
    action: action || rule.action,
    params
  };
}

function validateRulePayload(rule, { openingRequiresCap = true } = {}) {
  if (!rule || typeof rule !== 'object') return 'Invalid rule object';
  const normalized = normalizeRuleInput(rule);
  const ticker = normalizeTicker(normalized.ticker);
  if (!ticker) return 'Each rule needs a ticker';
  const action = normalizeAction(normalized.action);
  if (!action) return 'Invalid action (use BTO, STO, STC, or BTC)';
  const ruleType = String(normalized.rule_type || 'always');
  if (!VALID_RULE_TYPES.has(ruleType)) {
    return `Invalid rule_type: ${ruleType}. Use always, signal_bucket, signal_side, price_above, or price_below.`;
  }
  const qty = Number(normalized.qty);
  const closeAll = Boolean(normalized.params?.close_all);
  if (!(closeAll && (action === 'STC' || action === 'BTC')) && (!Number.isFinite(qty) || qty <= 0)) {
    return 'Quantity must be greater than 0';
  }
  if (openingRequiresCap && (action === 'BTO' || action === 'STO')) {
    const maxPos = Number(normalized.params?.max_position_qty);
    const maxVal = Number(normalized.params?.max_position_value);
    const hasShares = Number.isFinite(maxPos) && maxPos > 0;
    const hasDollars = Number.isFinite(maxVal) && maxVal > 0;
    if (!hasShares && !hasDollars) {
      return 'Buy/Short rules need params.max_position_qty and/or params.max_position_value';
    }
  }
  if (ruleType === 'signal_bucket') {
    const buckets = normalizeBuckets(normalized.params?.buckets ?? normalized.params?.bucket);
    if (!buckets.length) return 'signal_bucket rules need params.buckets (e.g. ["L2","L3"])';
  }
  if (ruleType === 'signal_side') {
    const side = String(normalized.params?.side || '')
      .trim()
      .toLowerCase();
    if (!['long', 'short', 'neutral'].includes(side)) {
      return 'signal_side rules need params.side of long, short, or neutral';
    }
  }
  if (ruleType === 'price_above' || ruleType === 'price_below') {
    const th = Number(normalized.threshold_value);
    if (!Number.isFinite(th) || th <= 0) return 'Price rules need threshold_value';
  }
  return null;
}

function sanitizeRuleForApi(rule) {
  const normalized = normalizeRuleInput(rule);
  const ticker = normalizeTicker(normalized.ticker);
  const action = normalizeAction(normalized.action);
  const rule_type = String(normalized.rule_type || 'always');
  const params = {
    ...(normalized.params && typeof normalized.params === 'object' ? normalized.params : {})
  };
  if (rule_type === 'signal_bucket') {
    const buckets = normalizeBuckets(params.buckets ?? params.bucket);
    params.buckets = buckets;
    if (buckets.length === 1) params.bucket = buckets[0];
    else delete params.bucket;
  }
  if (rule_type === 'signal_side') {
    params.side = String(params.side || '')
      .trim()
      .toLowerCase();
  }
  if (action === 'BTO' || action === 'STO') {
    if (params.allot_full_cap == null) params.allot_full_cap = true;
  }
  const qty = Number(normalized.qty);
  const closeAll = Boolean(params.close_all);
  return {
    rule_type,
    ticker,
    action,
    qty: closeAll && (action === 'STC' || action === 'BTC') ? 1 : qty,
    threshold_value:
      normalized.threshold_value != null && Number.isFinite(Number(normalized.threshold_value))
        ? Number(normalized.threshold_value)
        : null,
    params,
    is_active: normalized.is_active !== false
  };
}

async function loadPortfolioSnapshot(userId, accountId) {
  const account = await resolveAccountForUser(userId, accountId);
  const [{ data: lots }, { data: closedTrades }, strategyBundle] = await Promise.all([
    supabaseService
      .from('paper_position_lots')
      .select('*')
      .eq('account_id', account.id)
      .eq('status', 'open')
      .gt('remaining_qty', 0),
    supabaseService
      .from('paper_trades_closed')
      .select('net_realized_pnl')
      .eq('account_id', account.id)
      .limit(500),
    loadStrategyBundle(userId, account.id)
  ]);

  const enrichedLots = await enrichLotsWithPnl(lots || []);
  const positions = aggregateLotsToPositions(enrichedLots);
  const metrics = summarizeAccountMetrics(account, positions, closedTrades || []);
  const automationActive = Boolean(
    strategyBundle.binding?.is_active && strategyBundle.strategy?.is_active !== false
  );

  return {
    account_id: account.id,
    name: account.name,
    cash_balance: Number(account.cash_balance) || 0,
    starting_capital: Number(account.starting_capital) || 100000,
    equity: metrics.equity,
    total_return: metrics.total_return,
    total_return_pct: metrics.total_return_pct,
    positions_count: positions.length,
    positions: positions.slice(0, 25).map((p) => ({
      ticker: p.ticker,
      qty: p.qty,
      avg_cost: p.avg_cost,
      market_value: p.market_value,
      unrealized_pnl: p.unrealized_pnl,
      unrealized_pnl_pct: p.unrealized_pnl_pct
    })),
    has_strategy: Boolean(strategyBundle.strategy),
    strategy_id: strategyBundle.strategy?.id || null,
    strategy_name: strategyBundle.strategy?.name || null,
    automation_active: automationActive,
    rules_count: (strategyBundle.rules || []).length,
    last_run_at: strategyBundle.binding?.last_run_at || null,
    last_error: strategyBundle.binding?.last_error || null
  };
}

async function loadStrategyBundle(userId, accountId) {
  const account = await resolveAccountForUser(userId, accountId);
  const { data: binding, error } = await supabaseService
    .from('paper_strategy_account_bindings')
    .select('*, paper_strategies(*, paper_strategy_rules(*))')
    .eq('account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!binding?.paper_strategies) {
    return { account, strategy: null, binding: null, rules: [] };
  }
  const strategy = binding.paper_strategies;
  const rules = (strategy.paper_strategy_rules || []).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  return {
    account,
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
    rules
  };
}

async function loadOrders(userId, accountId, limit = 20) {
  const account = await resolveAccountForUser(userId, accountId);
  const { data, error } = await supabaseService
    .from('paper_orders')
    .select(
      'id, ticker, side, action, qty, status, order_type, limit_price, stop_price, fill_price, submitted_at, filled_at'
    )
    .eq('account_id', account.id)
    .order('submitted_at', { ascending: false })
    .limit(Math.min(Number(limit) || 20, 50));
  if (error) throw error;
  return data || [];
}

async function loadClosedTrades(userId, accountId, limit = 20) {
  const account = await resolveAccountForUser(userId, accountId);
  const { data, error } = await supabaseService
    .from('paper_trades_closed')
    .select('id, ticker, side, qty, entry_price, exit_price, net_realized_pnl, closed_at')
    .eq('account_id', account.id)
    .order('closed_at', { ascending: false })
    .limit(Math.min(Number(limit) || 20, 50));
  if (error) throw error;
  return data || [];
}

async function loadExecutionLog(userId, accountId, limit = 30) {
  const account = await resolveAccountForUser(userId, accountId);
  const { data, error } = await supabaseService
    .from('paper_strategy_execution_log')
    .select('id, ran_at, status, message, ticker, paper_strategy_rules(rule_type, ticker, action)')
    .eq('account_id', account.id)
    .order('ran_at', { ascending: false })
    .limit(Math.min(Number(limit) || 30, 80));
  if (error) throw error;
  return data || [];
}

function storeProposal(proposal) {
  pruneProposals();
  proposalStore.set(proposal.id, { proposal, at: Date.now() });
  return proposal;
}

function makeProposal({ title, summary, actions }) {
  return storeProposal({
    id: newProposalId(),
    title: String(title || 'Proposed change').slice(0, 120),
    summary: String(summary || '').slice(0, 800),
    actions: Array.isArray(actions) ? actions : []
  });
}

function parseTickerList(args) {
  const raw = [];
  if (Array.isArray(args?.tickers)) raw.push(...args.tickers);
  if (args?.ticker) raw.push(args.ticker);
  if (args?.symbol) raw.push(args.symbol);
  const out = [];
  for (const t of raw) {
    const n = normalizeTicker(t);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.slice(0, 12);
}

function summarizeTickerReport(report) {
  if (!report || typeof report !== 'object') return { error: 'Empty report' };
  return {
    meta: report.meta || null,
    takeaways: Array.isArray(report.takeaways) ? report.takeaways.slice(0, 8) : [],
    statsGrid: Array.isArray(report.statsGrid) ? report.statsGrid.slice(0, 8) : [],
    monthlyStatsLeft: Array.isArray(report.monthlyStatsLeft)
      ? report.monthlyStatsLeft.slice(0, 6)
      : [],
    monthlyStatsRight: Array.isArray(report.monthlyStatsRight)
      ? report.monthlyStatsRight.slice(0, 6)
      : [],
    drawdownMetrics: Array.isArray(report.drawdownMetrics)
      ? report.drawdownMetrics.slice(0, 6)
      : [],
    trailingReturns: Array.isArray(report.trailingReturns)
      ? report.trailingReturns.slice(0, 10)
      : [],
    recapParagraphs: Array.isArray(report.recapParagraphs)
      ? report.recapParagraphs.slice(0, 3).map((p) => String(p).slice(0, 600))
      : []
  };
}

function summarizeReturnsPayload(payload) {
  if (!payload || payload.success === false) {
    return { error: payload?.error || 'No returns data' };
  }
  const perf = payload.performance || {};
  const slim = (rows, n = 12) =>
    (Array.isArray(rows) ? rows : []).slice(0, n).map((r) => ({
      period: r.period || r.year || r.month || r.quarter || r.label || null,
      total_return_pct: r.total_return_pct ?? r.return_pct ?? r.value ?? null,
      start_date_found: r.start_date_found || null,
      end_date_found: r.end_date_found || null
    }));
  return {
    ticker: payload.ticker,
    asOfDate: payload.asOfDate,
    dynamicPeriods: slim(perf.dynamicPeriods, 14),
    predefinedPeriods: slim(perf.predefinedPeriods, 16),
    annualReturns: slim(perf.annualReturns, 12),
    monthlyReturns: slim(perf.monthlyReturns, 12),
    quarterlyReturns: slim(perf.quarterlyReturns, 8),
    customRange: slim(perf.customRange, 2)
  };
}

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_portfolio_snapshot',
      description: 'Get equity, cash, positions, and automation status for this portfolio.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_orders',
      description: 'List recent paper orders for this portfolio.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_closed_trades',
      description: 'List recent closed trades / realized P&L.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_strategy',
      description: 'Get the strategy bound to this portfolio, automation binding, and all rules.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_execution_log',
      description: 'Recent automation evaluation log (triggered, skipped, failed).',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 80 } },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_watchlist_signals',
      description: 'If the strategy has a watchlist_key, return top signal leaders from that list.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 40 } },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ticker_prices',
      description:
        'Latest Odin daily close price(s) for one or more tickers (same prices used for paper fills). Not live intraday quotes.',
      parameters: {
        type: 'object',
        properties: {
          ticker: { type: 'string' },
          tickers: { type: 'array', items: { type: 'string' }, maxItems: 12 }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ticker_signals',
      description:
        'Latest Odin signal bucket(s) for ticker(s): L1/L2/L3 bullish, S1/S2/S3 bearish, N neutral, plus side long/short/neutral.',
      parameters: {
        type: 'object',
        properties: {
          ticker: { type: 'string' },
          tickers: { type: 'array', items: { type: 'string' }, maxItems: 12 }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ticker_report',
      description:
        'Odin monthly (or annual) ticker report summary: takeaways, stats, trailing returns vs SPY. Defaults to current month.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          ticker: { type: 'string' },
          year: { type: 'integer' },
          month: { type: 'integer', minimum: 1, maximum: 12 }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ticker_returns',
      description:
        'Performance returns for a ticker (YTD, 1M, 1Y, etc.). Use for “how has X done” questions.',
      parameters: {
        type: 'object',
        properties: {
          ticker: { type: 'string' },
          symbol: { type: 'string' },
          include_annual: { type: 'boolean' },
          include_monthly: { type: 'boolean' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_news',
      description: 'Recent general market news headlines from the site news feed (Finnhub).',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 20 } },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_company_news',
      description: 'Recent company-specific news headlines for a ticker.',
      parameters: {
        type: 'object',
        properties: {
          ticker: { type: 'string' },
          symbol: { type: 'string' },
          days: { type: 'integer', minimum: 1, maximum: 30 },
          limit: { type: 'integer', minimum: 1, maximum: 20 }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_snapshot',
      description:
        'Broad market snapshot used on Odin500: indices/sector returns, S&P signal mix, top gainers/losers.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_newsletters',
      description:
        'List recent Odin weekly newsletter summaries, or fetch one issue by slug (truncated body).',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 10 },
          slug: { type: 'string' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_portfolio_sectors',
      description: 'Sector allocation for this paper portfolio’s open positions.',
      parameters: { type: 'object', properties: {}, additionalProperties: false }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_rules',
      description:
        'Propose adding one or more rules to the existing strategy (user must confirm). Max 4 rules. Use only when has_strategy=true. rule_type must be always|signal_bucket|signal_side|price_above|price_below. Opening BTO/STO rules need params.max_position_qty or params.max_position_value. signal_bucket needs params.buckets. signal_side needs params.side (long|short|neutral).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          rules: {
            type: 'array',
            maxItems: 4,
            items: {
              type: 'object',
              properties: {
                rule_type: {
                  type: 'string',
                  description: 'always | signal_bucket | signal_side | price_above | price_below'
                },
                ticker: { type: 'string' },
                action: {
                  type: 'string',
                  description: 'BTO | STO | STC | BTC'
                },
                qty: { type: 'number' },
                threshold_value: { type: 'number' },
                params: {
                  type: 'object',
                  description:
                    'For signal_bucket: {buckets:["L2","L3"], max_position_qty:N}. For signal_side: {side:"long", max_position_qty:N}. Closing: {close_all:true}.'
                },
                is_active: { type: 'boolean' }
              },
              required: ['ticker', 'action', 'rule_type', 'qty']
            }
          }
        },
        required: ['summary', 'rules']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_update_rule',
      description: 'Propose updating an existing rule by id (user must confirm).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          rule_id: { type: 'string' },
          patch: {
            type: 'object',
            properties: {
              rule_type: { type: 'string' },
              ticker: { type: 'string' },
              action: { type: 'string' },
              qty: { type: 'number' },
              threshold_value: { type: 'number' },
              params: { type: 'object' },
              is_active: { type: 'boolean' }
            }
          }
        },
        required: ['summary', 'rule_id', 'patch']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_delete_rule',
      description: 'Propose deleting a rule by id (user must confirm).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          rule_id: { type: 'string' }
        },
        required: ['summary', 'rule_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_strategy_and_bind',
      description:
        'Propose creating a new strategy, binding it to this portfolio, and optionally adding initial rules (user must confirm). Use when the account has no strategy.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          strategy_name: { type: 'string' },
          strategy_description: { type: 'string' },
          rules: {
            type: 'array',
            maxItems: 4,
            items: {
              type: 'object',
              properties: {
                rule_type: { type: 'string' },
                ticker: { type: 'string' },
                action: { type: 'string' },
                qty: { type: 'number' },
                threshold_value: { type: 'number' },
                params: { type: 'object' },
                is_active: { type: 'boolean' }
              },
              required: ['ticker', 'action', 'rule_type', 'qty']
            }
          }
        },
        required: ['summary', 'strategy_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_set_automation',
      description: 'Propose pausing or resuming automation for this portfolio (user must confirm).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          is_active: { type: 'boolean' }
        },
        required: ['summary', 'is_active']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_run_once',
      description: 'Propose running all strategy rules once immediately (user must confirm).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' }
        },
        required: ['summary']
      }
    }
  }
];

async function executeReadTool(name, args, ctx) {
  const { userId, accountId } = ctx;
  switch (name) {
    case 'get_portfolio_snapshot':
      return loadPortfolioSnapshot(userId, accountId);
    case 'get_orders':
      return loadOrders(userId, accountId, args?.limit);
    case 'get_closed_trades':
      return loadClosedTrades(userId, accountId, args?.limit);
    case 'get_strategy': {
      const bundle = await loadStrategyBundle(userId, accountId);
      return {
        strategy: bundle.strategy,
        binding: bundle.binding,
        rules: bundle.rules
      };
    }
    case 'get_execution_log':
      return loadExecutionLog(userId, accountId, args?.limit);
    case 'get_watchlist_signals': {
      const bundle = await loadStrategyBundle(userId, accountId);
      const key = bundle.strategy?.watchlist_key;
      if (!key) return { watchlist_key: null, leaders: [], note: 'No watchlist bound to this strategy.' };
      try {
        const leaders = await getWatchlistSignalLeaders(userId, key, {
          limit: Math.min(Number(args?.limit) || 20, 40)
        });
        return { watchlist_key: key, leaders: leaders?.data || [] };
      } catch (err) {
        return {
          watchlist_key: key,
          leaders: [],
          note: err?.message || 'Could not load watchlist signals'
        };
      }
    }
    case 'get_ticker_prices': {
      const tickers = parseTickerList(args);
      if (!tickers.length) return { error: 'Provide ticker or tickers' };
      try {
        if (tickers.length === 1) {
          const price = await getCurrentPrice(tickers[0]);
          return {
            note: 'Latest Odin daily close (not live intraday).',
            prices: [{ ticker: tickers[0], price }]
          };
        }
        const map = await fetchLatestClosePrices(tickers);
        return {
          note: 'Latest Odin daily close (not live intraday).',
          prices: tickers.map((t) => ({
            ticker: t,
            price: map.has(t) ? map.get(t) : null
          }))
        };
      } catch (err) {
        return { error: err?.message || 'Could not load prices' };
      }
    }
    case 'get_ticker_signals': {
      const tickers = parseTickerList(args);
      if (!tickers.length) return { error: 'Provide ticker or tickers' };
      try {
        if (tickers.length === 1) {
          const bucket = await getLatestSignalBucket(tickers[0]);
          return {
            signals: [
              {
                ticker: tickers[0],
                bucket,
                side: bucket ? signalSideFromBucket(bucket) : null
              }
            ]
          };
        }
        const map = await getLatestSignalsForTickers(tickers);
        return {
          signals: tickers.map((t) => {
            const bucket = map.get(t) ?? null;
            return {
              ticker: t,
              bucket,
              side: bucket ? signalSideFromBucket(bucket) : null
            };
          })
        };
      } catch (err) {
        return { error: err?.message || 'Could not load signals' };
      }
    }
    case 'get_ticker_report': {
      const symbol = normalizeTicker(args?.symbol || args?.ticker);
      if (!symbol) return { error: 'symbol/ticker required' };
      try {
        const year = args?.year != null ? Number(args.year) : undefined;
        const month = args?.month != null ? Number(args.month) : undefined;
        const report = await buildTickerReport(symbol, { year, month });
        return summarizeTickerReport(report);
      } catch (err) {
        return { error: err?.message || `Could not build report for ${symbol}` };
      }
    }
    case 'get_ticker_returns': {
      const ticker = normalizeTicker(args?.ticker || args?.symbol);
      if (!ticker) return { error: 'ticker required' };
      try {
        const payload = await analyticsData.calculateReturnsSections(ticker, {
          includeDynamic: true,
          includePredefined: true,
          includeAnnual: Boolean(args?.include_annual),
          includeMonthly: Boolean(args?.include_monthly),
          includeQuarterly: false,
          includeCustom: false
        });
        return summarizeReturnsPayload(payload);
      } catch (err) {
        return { error: err?.message || `Could not load returns for ${ticker}` };
      }
    }
    case 'get_market_news': {
      try {
        return await fetchGeneralMarketNews({
          limit: Math.min(Number(args?.limit) || 12, 20)
        });
      } catch (err) {
        return { error: err?.message || 'Could not load market news', items: [] };
      }
    }
    case 'get_company_news': {
      const symbol = normalizeTicker(args?.ticker || args?.symbol);
      if (!symbol) return { error: 'ticker/symbol required', items: [] };
      try {
        return await fetchCompanyNews(symbol, {
          days: Math.min(Number(args?.days) || 10, 30),
          limit: Math.min(Number(args?.limit) || 12, 20)
        });
      } catch (err) {
        return { error: err?.message || 'Could not load company news', items: [] };
      }
    }
    case 'get_market_snapshot': {
      try {
        const ctxSnap = await fetchNewsletterContext();
        if (!ctxSnap) return { error: 'Market snapshot unavailable right now' };
        return {
          asOfDate: ctxSnap.asOfDate,
          indices: ctxSnap.indices,
          topSectors: ctxSnap.topSectors,
          bottomSectors: ctxSnap.bottomSectors,
          signals: ctxSnap.signals,
          topGainers: ctxSnap.topGainers,
          topLosers: ctxSnap.topLosers,
          summary_text: formatContextForPrompt(ctxSnap)
        };
      } catch (err) {
        return { error: err?.message || 'Could not load market snapshot' };
      }
    }
    case 'get_newsletters': {
      try {
        const slug = String(args?.slug || '').trim();
        if (slug) {
          const issue = await getNewsletterBySlug(slug);
          if (!issue) return { error: `Newsletter not found: ${slug}` };
          return {
            issue: {
              slug: issue.slug,
              title: issue.title,
              week_label: issue.weekLabel || issue.week_label,
              published_at: issue.publishedAt || issue.published_at,
              description: issue.description,
              body_excerpt: String(issue.bodyMarkdown || issue.body_markdown || '').slice(0, 4000)
            }
          };
        }
        const limit = Math.min(Number(args?.limit) || 5, 10);
        const rows = await listNewsletterSummaries(limit);
        return {
          issues: (rows || []).map((r) => ({
            slug: r.slug,
            title: r.title,
            week_label: r.weekLabel || r.week_label,
            published_at: r.publishedAt || r.published_at,
            description: r.description
          }))
        };
      } catch (err) {
        return { error: err?.message || 'Could not load newsletters' };
      }
    }
    case 'get_portfolio_sectors': {
      try {
        const allocation = await getSectorAllocation(userId, accountId);
        return allocation;
      } catch (err) {
        // Fallback: map current position tickers if allocation helper fails.
        try {
          const snap = await loadPortfolioSnapshot(userId, accountId);
          const tickers = (snap.positions || []).map((p) => p.ticker).filter(Boolean);
          const sectorMap = await fetchSectorMapForSymbols(tickers);
          return {
            sectors: tickers.map((t) => ({ ticker: t, sector: sectorMap.get(t) || null }))
          };
        } catch (err2) {
          return { error: err2?.message || err?.message || 'Could not load sector allocation' };
        }
      }
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function executeProposeTool(name, args, ctx) {
  const proposals = [];
  try {
    if (name === 'propose_create_rules') {
      const rulesRaw = Array.isArray(args?.rules) ? args.rules.slice(0, MAX_RULES_PER_PROPOSAL) : [];
      if (!rulesRaw.length) return { error: 'rules array required' };
      // No strategy yet → treat as create+bind so the model doesn't loop on the wrong tool.
      if (!ctx.strategyId) {
        return executeProposeTool(
          'propose_create_strategy_and_bind',
          {
            title: args?.title || 'Create automated strategy',
            summary:
              args?.summary ||
              'This portfolio had no strategy yet, so create one, bind it, and add the requested rules.',
            strategy_name: args?.strategy_name || `${ctx.accountName || 'Portfolio'} strategy`,
            strategy_description: args?.strategy_description,
            rules: rulesRaw
          },
          ctx
        );
      }
      const rules = [];
      for (const r of rulesRaw) {
        const err = validateRulePayload(r);
        if (err) {
          return {
            error: err,
            hint:
              'Example: {"rule_type":"signal_bucket","ticker":"AAPL","action":"BTO","qty":10,"params":{"buckets":["L2","L3"],"max_position_qty":10}}'
          };
        }
        rules.push(sanitizeRuleForApi(r));
      }
      const proposal = makeProposal({
        title: args?.title || 'Add strategy rules',
        summary: args?.summary || `Add ${rules.length} rule(s) to the current strategy.`,
        actions: rules.map((rule) => ({
          type: 'add_rule',
          strategy_id: ctx.strategyId,
          payload: rule
        }))
      });
      proposals.push(proposal);
      return { ok: true, proposal_id: proposal.id, proposal };
    }

    if (name === 'propose_update_rule') {
      const ruleId = String(args?.rule_id || '').trim();
      if (!ruleId) return { error: 'rule_id required' };
      if (!ctx.strategyId) return { error: 'No strategy on this portfolio' };
      const existing = (ctx.rules || []).find((r) => r.id === ruleId);
      if (!existing) return { error: `Rule ${ruleId} not found on this strategy` };
      const patchIn = args?.patch && typeof args.patch === 'object' ? args.patch : {};
      const merged = {
        rule_type: patchIn.rule_type ?? existing.rule_type,
        ticker: patchIn.ticker ?? existing.ticker,
        action: patchIn.action ?? existing.action,
        qty: patchIn.qty ?? existing.qty,
        threshold_value:
          patchIn.threshold_value !== undefined ? patchIn.threshold_value : existing.threshold_value,
        params: patchIn.params !== undefined ? patchIn.params : existing.params,
        is_active: patchIn.is_active !== undefined ? patchIn.is_active : existing.is_active
      };
      const err = validateRulePayload(merged);
      if (err) return { error: err };
      const payload = sanitizeRuleForApi(merged);
      const proposal = makeProposal({
        title: args?.title || 'Update rule',
        summary: args?.summary || `Update rule ${existing.ticker} (${existing.action}).`,
        actions: [
          {
            type: 'update_rule',
            strategy_id: ctx.strategyId,
            rule_id: ruleId,
            payload
          }
        ]
      });
      proposals.push(proposal);
      return { ok: true, proposal_id: proposal.id, proposal };
    }

    if (name === 'propose_delete_rule') {
      const ruleId = String(args?.rule_id || '').trim();
      if (!ruleId) return { error: 'rule_id required' };
      if (!ctx.strategyId) return { error: 'No strategy on this portfolio' };
      const existing = (ctx.rules || []).find((r) => r.id === ruleId);
      if (!existing) return { error: `Rule ${ruleId} not found` };
      const proposal = makeProposal({
        title: args?.title || 'Delete rule',
        summary: args?.summary || `Delete rule ${existing.ticker} (${existing.action}).`,
        actions: [
          {
            type: 'delete_rule',
            strategy_id: ctx.strategyId,
            rule_id: ruleId
          }
        ]
      });
      proposals.push(proposal);
      return { ok: true, proposal_id: proposal.id, proposal };
    }

    if (name === 'propose_create_strategy_and_bind') {
      if (ctx.strategyId) {
        return {
          error:
            'This portfolio already has a strategy. Use propose_create_rules / propose_update_rule / propose_delete_rule instead.'
        };
      }
      const name = String(args?.strategy_name || '').trim() || 'Assistant strategy';
      const rulesRaw = Array.isArray(args?.rules) ? args.rules.slice(0, MAX_RULES_PER_PROPOSAL) : [];
      const rules = [];
      for (const r of rulesRaw) {
        const err = validateRulePayload(r);
        if (err) {
          return {
            error: err,
            hint:
              'Example: {"rule_type":"signal_bucket","ticker":"AAPL","action":"BTO","qty":10,"params":{"buckets":["L2","L3"],"max_position_qty":10}}'
          };
        }
        rules.push(sanitizeRuleForApi(r));
      }
      const actions = [
        {
          type: 'create_strategy',
          payload: {
            name: name.slice(0, 120),
            description: args?.strategy_description != null ? String(args.strategy_description).slice(0, 2000) : null,
            is_active: true
          }
        },
        {
          type: 'bind_strategy',
          payload: { account_id: ctx.accountId, is_active: true }
        },
        ...rules.map((rule) => ({ type: 'add_rule', payload: rule }))
      ];
      const proposal = makeProposal({
        title: args?.title || 'Create automated strategy',
        summary:
          args?.summary ||
          `Create strategy "${name}", bind it to this portfolio, and add ${rules.length} rule(s).`,
        actions
      });
      proposals.push(proposal);
      return { ok: true, proposal_id: proposal.id, proposal };
    }

    if (name === 'propose_set_automation') {
      if (!ctx.strategyId) return { error: 'No strategy on this portfolio to pause/resume' };
      const isActive = Boolean(args?.is_active);
      const proposal = makeProposal({
        title: args?.title || (isActive ? 'Resume automation' : 'Pause automation'),
        summary: args?.summary || (isActive ? 'Resume scheduled rule checks.' : 'Pause scheduled rule checks.'),
        actions: [
          {
            type: 'set_automation',
            strategy_id: ctx.strategyId,
            payload: { account_id: ctx.accountId, is_active: isActive }
          }
        ]
      });
      proposals.push(proposal);
      return { ok: true, proposal_id: proposal.id, proposal };
    }

    if (name === 'propose_run_once') {
      if (!ctx.strategyId) return { error: 'No strategy on this portfolio' };
      const proposal = makeProposal({
        title: args?.title || 'Run automation once',
        summary: args?.summary || 'Evaluate all active rules once against current signals/prices.',
        actions: [{ type: 'run_once', payload: { account_id: ctx.accountId } }]
      });
      proposals.push(proposal);
      return { ok: true, proposal_id: proposal.id, proposal };
    }

    return { error: `Unknown propose tool: ${name}` };
  } catch (err) {
    return { error: err?.message || 'Proposal failed' };
  }
}

async function callOpenAiChat({ messages, tools }) {
  const { apiKey, model, timeoutMs } = openaiConfig();
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY is not configured on the server');
    err.status = 503;
    err.code = 'OPENAI_MISSING';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages,
        tools,
        tool_choice: 'auto'
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
      err.status = 502;
      throw err;
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ userId: string, accountId: string, messages: Array<{role:string,content:string}> }} input
 */
async function runPortfolioAssistantChat({ userId, accountId, messages }) {
  const snapshot = await loadPortfolioSnapshot(userId, accountId);
  const bundle = await loadStrategyBundle(userId, accountId);
  const ctx = {
    userId,
    accountId: snapshot.account_id,
    accountName: snapshot.name || 'Portfolio',
    strategyId: bundle.strategy?.id || null,
    rules: bundle.rules || []
  };

  const bootstrap = {
    role: 'system',
    content:
      SYSTEM_PROMPT +
      `\n\nCurrent portfolio bootstrap (authoritative starting context):\n` +
      JSON.stringify(snapshot)
  };

  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  if (!history.length || history[history.length - 1].role !== 'user') {
    const err = new Error('messages must end with a user message');
    err.status = 400;
    throw err;
  }

  const openaiMessages = [bootstrap, ...history];
  const collectedProposals = [];
  const toolTraces = [];
  let consecutiveProposeFailures = 0;
  let lastProposeError = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const payload = await callOpenAiChat({
      messages: openaiMessages,
      tools: TOOL_DEFINITIONS
    });
    const choice = payload?.choices?.[0]?.message;
    if (!choice) {
      const err = new Error('Empty model response');
      err.status = 502;
      throw err;
    }

    const toolCalls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
    if (!toolCalls.length) {
      const reply = String(choice.content || '').trim() || 'Done.';
      console.log(
        `[portfolio-assistant] user=${userId} account=${accountId} proposals=${collectedProposals.length}`
      );
      return {
        reply,
        proposals: collectedProposals,
        openai_configured: true,
        tool_traces: toolTraces.slice(0, 12)
      };
    }

    openaiMessages.push({
      role: 'assistant',
      content: choice.content || null,
      tool_calls: toolCalls
    });

    for (const call of toolCalls) {
      const name = call?.function?.name;
      let args = {};
      try {
        args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }

      let result;
      if (String(name).startsWith('propose_')) {
        result = executeProposeTool(name, args, ctx);
        if (result?.proposal) {
          collectedProposals.push(result.proposal);
          consecutiveProposeFailures = 0;
          lastProposeError = '';
        } else if (result?.error) {
          consecutiveProposeFailures += 1;
          lastProposeError = String(result.error);
        }
      } else {
        result = await executeReadTool(name, args, ctx);
      }

      toolTraces.push({
        name,
        ok: !result?.error,
        error: result?.error || undefined
      });
      openaiMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 12000)
      });
    }

    // Stop burning rounds on the same broken propose payload.
    if (consecutiveProposeFailures >= 3 && !collectedProposals.length) {
      break;
    }
    if (collectedProposals.length && consecutiveProposeFailures >= 2) {
      break;
    }
  }

  const fallbackReply = collectedProposals.length
    ? 'I prepared a change for you to review — confirm it below. (Some follow-up tool steps failed.)'
    : lastProposeError
      ? `I couldn't build that rule change yet: ${lastProposeError}. Try again with ticker, action (BTO/STC), qty, and for buys include max shares or max dollar size.`
      : 'I gathered data but hit the tool-step limit. Ask a more specific question, or confirm any proposals already shown.';

  return {
    reply: fallbackReply,
    proposals: collectedProposals,
    openai_configured: true,
    tool_traces: toolTraces.slice(0, 12)
  };
}

module.exports = {
  hasOpenAiKey,
  runPortfolioAssistantChat,
  loadPortfolioSnapshot
};
