const { callAiProvider, hasEngineKey } = require('./aiProviders');
const { getWatchlistSignalLeaders } = require('./watchlistResolver');
const { fetchGeneralMarketNews, fetchCompanyNews } = require('../marketNews');
const { fetchLatestClosePrices } = require('./pnlCalculator');
const { STARTING_CAPITAL } = require('./dbSchema');

/**
 * Chat-driven builder for a brand-new AI-managed portfolio. Unlike
 * services/paper/portfolioAssistant.js (bound to one existing account, read + propose-only),
 * this is stateless per-request and scoped to picking tickers for a portfolio that doesn't
 * exist yet. It never touches the database — it only returns a `proposal` object; the actual
 * account/orders are created by the confirm step in routes/paper.js (`POST /ai-portfolios`).
 */

const MAX_TOOL_ROUNDS = 6;

const INDEX_WATCHLIST_KEYS = {
  dow: 'def:Dow Jones',
  nasdaq: 'def:Nasdaq 100',
  sp500: 'def:SP500'
};

const INDEX_LABELS = {
  dow: 'Dow Jones',
  nasdaq: 'Nasdaq-100',
  sp500: 'S&P 500'
};

/** Position counts per leg — Long-Short = 5 long + 5 short = 10 total, per the product spec. */
const DIRECTION_SPEC = {
  long: { longCount: 5, shortCount: 0, label: 'Long-only' },
  short: { longCount: 0, shortCount: 5, label: 'Short-only' },
  long_short: { longCount: 5, shortCount: 5, label: 'Long-Short' }
};

const CRITERIA_LABELS = {
  none: 'No specific criteria',
  news_momentum: 'News / momentum',
  fundamental: 'Fundamental analysis',
  technical: 'Technical analysis'
};

const CRITERIA_GUIDANCE = {
  none: 'No specific selection criteria — use your own judgement across the candidate list from get_index_universe.',
  news_momentum:
    'Prioritize tickers with notable recent news or momentum. Call get_market_news and get_company_news on your top candidates before finalizing your picks.',
  fundamental:
    'Prioritize tickers you assess as fundamentally strong (weak, for short legs) using your own general knowledge of these companies. Odin500 has no fundamentals-data tool — do not expect one; reason from what you already know.',
  technical:
    'Prioritize tickers by the strongest Odin signal bucket from get_index_universe — for long legs prefer L1, then L2, then L3; for short legs prefer S1, then S2, then S3.'
};

const CADENCE_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

const ENGINE_LABELS = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini' };

/**
 * Default publish-page copy for an AI-managed account, used whenever the user publishes
 * without writing their own description/strategy. `rationale` (the AI's own explanation from
 * when the portfolio was built) is preferred for the description when available.
 */
function buildDefaultPublishText(account, rationale) {
  const engineLabel = ENGINE_LABELS[account.ai_engine] || account.ai_engine;
  const indexLabel = INDEX_LABELS[account.ai_index_focus] || account.ai_index_focus;
  const directionLabel = DIRECTION_SPEC[account.ai_direction]?.label || account.ai_direction;
  const criteriaLabel = (CRITERIA_LABELS[account.ai_criteria] || account.ai_criteria || '').toLowerCase();
  const cadenceLabel = CADENCE_LABELS[account.ai_rebalance_cadence] || account.ai_rebalance_cadence;

  const description =
    String(rationale || '').trim() ||
    `An AI-managed ${String(directionLabel || '').toLowerCase()} portfolio of ${indexLabel} stocks, built and rebalanced ${String(cadenceLabel || '').toLowerCase()} by ${engineLabel}.`;

  const strategy = `Fully automated: ${engineLabel} selects ${indexLabel} constituents (${directionLabel}, ${criteriaLabel}) and rebalances the book ${String(cadenceLabel || '').toLowerCase()}, closing dropped picks and opening new ones without manual intervention.`;

  return { description, strategy };
}

function assertValid(map, value, label) {
  if (!map[value]) {
    const err = new Error(`Invalid ${label}: ${value}`);
    err.status = 400;
    throw err;
  }
}

function buildSystemPrompt({ indexFocus, direction, criteria, cadence, currentHoldings }) {
  const spec = DIRECTION_SPEC[direction];
  const totalCount = spec.longCount + spec.shortCount;
  const isRebalance = Array.isArray(currentHoldings) && currentHoldings.length > 0;

  const intro = isRebalance
    ? `You are running the ${CADENCE_LABELS[cadence].toLowerCase()} rebalance for an existing AI-managed virtual (paper) portfolio on Odin500. This is an automated, unattended run — decide the updated target holdings now, no back-and-forth needed.`
    : `You are building a brand-new AI-managed virtual (paper) portfolio for Odin500 — this chat is scoped ONLY to constructing this one new portfolio, not chatting about an existing one and not general conversation.`;

  const holdingsSection = isRebalance
    ? `\n\nCurrent holdings (from the last rebalance): ${currentHoldings.map((h) => `${h.ticker} (${h.action === 'STO' ? 'short' : 'long'})`).join(', ')}.
Decide the FULL updated target list — keep tickers that still fit your criteria, drop ones that no longer do (they will be closed and become closed trades), and add replacements so the total stays at ${totalCount}. Return the complete final list via propose_create_ai_portfolio, not just the changes.`
    : '';

  return `${intro}

Fixed configuration for this portfolio (already chosen — do not ask about or change them):
- Index universe: ${INDEX_LABELS[indexFocus]} — only pick tickers that are members of this index. Call get_index_universe to see the valid candidate list; never invent a ticker.
- Direction: ${spec.label} — your final proposal must contain exactly ${spec.longCount} long ticker(s) (action BTO) and ${spec.shortCount} short ticker(s) (action STO), ${totalCount} total.
- Selection criteria: ${CRITERIA_LABELS[criteria]} — ${CRITERIA_GUIDANCE[criteria]}
- Rebalance cadence: ${CADENCE_LABELS[cadence]}.
- Position sizing: equal weight. Do not size positions yourself — the system allocates capital equally across all ${totalCount} positions after you pick tickers.${holdingsSection}

Rules:
- Call get_index_universe first, every time — it's your only source of valid tickers and current signal buckets for this index.
- Use get_market_news / get_company_news / get_ticker_prices as needed for your chosen criteria.
- Never invent a ticker, price, signal, or news item — only use tool results.
- When you have your final list, call propose_create_ai_portfolio exactly once with the complete holdings (all long + short legs together), a short portfolio name, and a one-paragraph rationale for the picks.
${isRebalance ? '' : '- If the user asks to swap a pick or reconsider, discuss it, then call propose_create_ai_portfolio again with the corrected full list — always the complete list, not a diff.\n'}- Keep replies concise and focused on this portfolio's construction.
- This is simulated paper trading — never suggest investing real money, and don't give personalized investment advice.`;
}

function buildToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'get_index_universe',
        description:
          'Get every ticker in the configured index with its current Odin signal bucket, sorted into long and short leaders by signal strength. Always call this first.',
        parameters: { type: 'object', properties: {}, additionalProperties: false }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_market_news',
        description: 'Recent general market news headlines from the site news feed.',
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
            days: { type: 'integer', minimum: 1, maximum: 30 },
            limit: { type: 'integer', minimum: 1, maximum: 20 }
          },
          required: ['ticker'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_ticker_prices',
        description: 'Latest Odin daily close price for one or more tickers.',
        parameters: {
          type: 'object',
          properties: { tickers: { type: 'array', items: { type: 'string' }, maxItems: 20 } },
          required: ['tickers'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'propose_create_ai_portfolio',
        description:
          'Finalize this new AI-managed portfolio for the user to review and confirm. Call exactly once you have your complete final holdings.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Short portfolio name, e.g. "Dow Momentum Five"' },
            rationale: { type: 'string', description: 'One paragraph explaining the picks' },
            holdings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ticker: { type: 'string' },
                  action: { type: 'string', description: 'BTO for a long leg, STO for a short leg' }
                },
                required: ['ticker', 'action']
              }
            }
          },
          required: ['name', 'holdings']
        }
      }
    }
  ];
}

async function executeTool(name, args, ctx) {
  switch (name) {
    case 'get_index_universe': {
      const key = INDEX_WATCHLIST_KEYS[ctx.indexFocus];
      const { data } = await getWatchlistSignalLeaders(ctx.userId, key, { limit: 'all' });
      return data;
    }
    case 'get_market_news':
      return fetchGeneralMarketNews({ limit: args?.limit });
    case 'get_company_news':
      return fetchCompanyNews(args?.ticker || args?.symbol, { days: args?.days, limit: args?.limit });
    case 'get_ticker_prices': {
      const tickers = Array.isArray(args?.tickers) ? args.tickers : [];
      const map = await fetchLatestClosePrices(tickers);
      return Object.fromEntries(map);
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function normalizeTicker(t) {
  return String(t || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 12);
}

/** Validates + normalizes a proposed holdings list against the direction spec and the real index universe. */
async function validateProposal({ userId, indexFocus, direction }, args) {
  const spec = DIRECTION_SPEC[direction];
  const name = String(args?.name || '').trim().slice(0, 120);
  if (!name) return { error: 'A portfolio name is required.' };

  const rawHoldings = Array.isArray(args?.holdings) ? args.holdings : [];
  const holdings = [];
  const seen = new Set();
  for (const h of rawHoldings) {
    const ticker = normalizeTicker(h?.ticker);
    const action = String(h?.action || '').trim().toUpperCase();
    if (!ticker || !['BTO', 'STO'].includes(action)) continue;
    if (seen.has(ticker)) continue;
    seen.add(ticker);
    holdings.push({ ticker, action });
  }

  const longs = holdings.filter((h) => h.action === 'BTO');
  const shorts = holdings.filter((h) => h.action === 'STO');
  if (longs.length !== spec.longCount || shorts.length !== spec.shortCount) {
    return {
      error: `Need exactly ${spec.longCount} long (BTO) and ${spec.shortCount} short (STO) tickers — got ${longs.length} long and ${shorts.length} short.`
    };
  }

  const key = INDEX_WATCHLIST_KEYS[indexFocus];
  const { data: universe } = await getWatchlistSignalLeaders(userId, key, { limit: 'all' });
  const validSymbols = new Set((universe?.tickers || []).map((t) => t.symbol));
  const invalid = holdings.filter((h) => !validSymbols.has(h.ticker)).map((h) => h.ticker);
  if (invalid.length) {
    return { error: `These tickers aren't in the ${INDEX_LABELS[indexFocus]} universe: ${invalid.join(', ')}.` };
  }

  return {
    proposal: {
      name,
      rationale: String(args?.rationale || '').trim().slice(0, 2000),
      holdings
    }
  };
}

function assertConfig({ engine, indexFocus, direction, criteria, cadence }) {
  assertValid(INDEX_WATCHLIST_KEYS, indexFocus, 'index_focus');
  assertValid(DIRECTION_SPEC, direction, 'direction');
  assertValid(CRITERIA_LABELS, criteria, 'criteria');
  assertValid(CADENCE_LABELS, cadence, 'cadence');
  if (!hasEngineKey(engine)) {
    const err = new Error('That AI engine is not configured on the server yet.');
    err.status = 503;
    err.code = 'ENGINE_MISSING';
    throw err;
  }
}

/**
 * Shared tool-calling loop for both the interactive creator chat and the unattended
 * rebalance run — everything provider/tool-specific lives here once.
 * @param {{ engine: string, systemPrompt: string, convo: Array<object>, ctx: object }} input
 */
async function runToolLoop({ engine, systemPrompt, convo, ctx }) {
  const tools = buildToolDefinitions();
  const toolTraces = [];
  let proposal = null;
  let lastProposeError = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const result = await callAiProvider({ engine, systemPrompt, messages: convo, tools });

    if (!result.toolCalls.length) {
      return {
        reply: (result.content || '').trim() || 'Done.',
        proposal,
        tool_traces: toolTraces.slice(0, 12)
      };
    }

    convo.push({ role: 'assistant', content: result.content, tool_calls: result.toolCalls });

    for (const call of result.toolCalls) {
      let toolResult;
      if (call.name === 'propose_create_ai_portfolio') {
        const outcome = await validateProposal(ctx, call.arguments);
        if (outcome.proposal) {
          proposal = {
            engine,
            index_focus: ctx.indexFocus,
            direction: ctx.direction,
            criteria: ctx.criteria,
            cadence: ctx.cadence,
            ...outcome.proposal
          };
          toolResult = { ok: true, message: 'Proposal ready.' };
          lastProposeError = '';
        } else {
          toolResult = { error: outcome.error };
          lastProposeError = outcome.error;
        }
      } else {
        try {
          toolResult = await executeTool(call.name, call.arguments, ctx);
        } catch (err) {
          toolResult = { error: err.message || 'Tool failed' };
        }
      }

      toolTraces.push({ name: call.name, ok: !toolResult?.error, error: toolResult?.error || undefined });
      convo.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.name,
        content: JSON.stringify(toolResult).slice(0, 12000)
      });
    }

    if (proposal) break;
  }

  return {
    reply: proposal
      ? 'I put together a portfolio for you to review — confirm it below.'
      : lastProposeError
        ? `I couldn't finalize that yet: ${lastProposeError}`
        : "I gathered data but didn't finish picking within this turn — ask me to continue or finalize.",
    proposal,
    tool_traces: toolTraces.slice(0, 12)
  };
}

/**
 * @param {{ userId: string, engine: string, indexFocus: string, direction: string, criteria: string,
 *           cadence: string, messages: Array<{role:string, content:string}> }} input
 */
async function runAiPortfolioCreatorChat({ userId, engine, indexFocus, direction, criteria, cadence, messages }) {
  assertConfig({ engine, indexFocus, direction, criteria, cadence });

  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

  if (!history.length || history[history.length - 1].role !== 'user') {
    const err = new Error('messages must end with a user message');
    err.status = 400;
    throw err;
  }

  const systemPrompt = buildSystemPrompt({ indexFocus, direction, criteria, cadence });
  const ctx = { userId, indexFocus, direction, criteria, cadence };
  return runToolLoop({ engine, systemPrompt, convo: [...history], ctx });
}

/**
 * Unattended rebalance run for one already-existing AI-managed account — no chat history,
 * just "decide the updated target list now." Used by services/paper/aiRebalancer.js.
 * @param {{ userId: string, engine: string, indexFocus: string, direction: string, criteria: string,
 *           cadence: string, currentHoldings: Array<{ticker:string, action:string}> }} input
 */
async function runAiPortfolioRebalance({
  userId,
  engine,
  indexFocus,
  direction,
  criteria,
  cadence,
  currentHoldings
}) {
  assertConfig({ engine, indexFocus, direction, criteria, cadence });

  const systemPrompt = buildSystemPrompt({ indexFocus, direction, criteria, cadence, currentHoldings });
  const ctx = { userId, indexFocus, direction, criteria, cadence };
  const convo = [
    { role: 'user', content: 'Rebalance this portfolio now — decide the updated full target holdings list.' }
  ];
  return runToolLoop({ engine, systemPrompt, convo, ctx });
}

module.exports = {
  runAiPortfolioCreatorChat,
  runAiPortfolioRebalance,
  validateProposal,
  buildDefaultPublishText,
  INDEX_LABELS,
  DIRECTION_SPEC,
  CRITERIA_LABELS,
  CADENCE_LABELS,
  ENGINE_LABELS
};
