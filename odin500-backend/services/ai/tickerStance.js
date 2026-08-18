// Per-engine long/short read on a ticker, computed at most once per ticker per market day.
//
// Flow: BigQuery lookup for today -> if complete, return it -> otherwise build a market-data
// context, ask only the engines still missing, persist, and return.

const bigquery = require('../../config/bigquery');
const { callAiProvider, hasEngineKey, engineConfig } = require('../paper/aiProviders');
const { getStancesForDay, insertStances } = require('./tickerStanceStore');
const {
  OHLC_TABLE_FQN,
  OHLC_SIGNALS_TABLE_FQN,
  MA200_TABLE_FQN,
  STANCE_ENGINES,
  CONTEXT_LOOKBACK_DAYS,
  VALID_STANCES
} = require('./tickerStanceConfig');

const ENGINE_LABELS = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini' };

/** Concurrent callers for the same ticker share one round of model calls. */
const inflightByKey = new Map();

function bqCellToPlain(v) {
  if (v == null) return null;
  if (typeof v === 'object' && v.value !== undefined) return v.value;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

/**
 * The market day in New York. Using UTC would roll the cache over at 8pm ET, handing the evening
 * a "new day" with the same closing data and paying for a second round of model calls.
 */
function marketDayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function pctChange(from, to) {
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return Math.round(((b - a) / Math.abs(a)) * 10000) / 100;
}

/**
 * Price, Odin signal, and 200-day MA for the ticker over the lookback window.
 * Returns null when the symbol has no price history — we must not ask a model to opine on a
 * ticker we hold no data for; it would answer from memory and sound just as confident.
 */
async function loadMarketContext(ticker) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - CONTEXT_LOOKBACK_DAYS);
  const params = {
    ticker,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };

  const [priceRows, signalRows, maRows] = await Promise.all([
    bigquery
      .query({
        query: `SELECT Date AS dt, Open, High, Low, Close FROM ${OHLC_TABLE_FQN}
                WHERE Ticker = @ticker AND Date BETWEEN @start AND @end ORDER BY Date ASC`,
        params
      })
      .then((r) => r[0] || []),
    bigquery
      .query({
        query: `SELECT \`Date\` AS dt, \`Signal\` AS sig FROM ${OHLC_SIGNALS_TABLE_FQN}
                WHERE \`Ticker\` = @ticker AND \`Date\` BETWEEN @start AND @end ORDER BY \`Date\` ASC`,
        params
      })
      .then((r) => r[0] || []),
    bigquery
      .query({
        query: `SELECT \`Date\` AS dt, \`DMA_200\` AS dma200 FROM ${MA200_TABLE_FQN}
                WHERE \`Ticker\` = @ticker AND \`Date\` BETWEEN @start AND @end ORDER BY \`Date\` ASC`,
        params
      })
      .then((r) => r[0] || [])
      // The MA table lags or omits some symbols; its absence weakens the prompt but is not fatal.
      .catch(() => [])
  ]);

  const closes = priceRows
    .map((r) => ({ date: bqCellToPlain(r.dt), close: Number(bqCellToPlain(r.Close)) }))
    .filter((r) => r.date && Number.isFinite(r.close));
  if (closes.length < 2) return null;

  const last = closes[closes.length - 1];
  const at = (backDays) => closes[Math.max(0, closes.length - 1 - backDays)];
  const highs = priceRows.map((r) => Number(bqCellToPlain(r.High))).filter(Number.isFinite);
  const lows = priceRows.map((r) => Number(bqCellToPlain(r.Low))).filter(Number.isFinite);
  const lastSignal = signalRows.length ? bqCellToPlain(signalRows[signalRows.length - 1].sig) : null;
  const lastMa200 = maRows.length ? Number(bqCellToPlain(maRows[maRows.length - 1].dma200)) : null;

  return {
    asOf: last.date,
    lastClose: last.close,
    change5d: pctChange(at(5)?.close, last.close),
    change20d: pctChange(at(20)?.close, last.close),
    change60d: pctChange(at(60)?.close, last.close),
    periodHigh: highs.length ? Math.max(...highs) : null,
    periodLow: lows.length ? Math.min(...lows) : null,
    ma200: Number.isFinite(lastMa200) ? lastMa200 : null,
    vsMa200Pct: Number.isFinite(lastMa200) ? pctChange(lastMa200, last.close) : null,
    odinSignal: lastSignal ? String(lastSignal).toUpperCase() : null,
    sessions: closes.length
  };
}

const SYSTEM_PROMPT = [
  'You are a markets analyst giving a directional read on a single US-listed stock.',
  'You will be given recent price action and technical context. Judge only from that context',
  'plus general knowledge of the company; do not claim access to live news or intraday data.',
  '',
  'Reply with a single JSON object and nothing else:',
  '{"stance":"long"|"short"|"neutral","rationale":"one sentence, max 25 words"}',
  '',
  '"long" means you would expect the stock to outperform over the next few weeks,',
  '"short" means underperform, "neutral" only when the evidence genuinely does not lean either way.'
].join('\n');

function buildUserPrompt(ticker, ctx) {
  const line = (label, value, suffix = '') =>
    value == null ? null : `- ${label}: ${typeof value === 'number' ? value.toFixed(2) : value}${suffix}`;
  return [
    `Ticker: ${ticker}`,
    `As of: ${ctx.asOf} (${ctx.sessions} sessions of history)`,
    line('Last close', ctx.lastClose),
    line('5-day change', ctx.change5d, '%'),
    line('20-day change', ctx.change20d, '%'),
    line('60-day change', ctx.change60d, '%'),
    line('Period high', ctx.periodHigh),
    line('Period low', ctx.periodLow),
    line('200-day MA', ctx.ma200),
    line('Price vs 200-day MA', ctx.vsMa200Pct, '%'),
    line('Odin signal bucket', ctx.odinSignal),
    '',
    'Give your stance as JSON.'
  ]
    .filter(Boolean)
    .join('\n');
}

/** Models wrap JSON in prose or fences often enough that a bare JSON.parse is not reliable. */
function parseStanceReply(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const match = fenced.match(/\{[\s\S]*\}/);
  let parsed = null;
  try {
    parsed = JSON.parse(match ? match[0] : fenced);
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed === 'object') {
    const stance = String(parsed.stance || '').toLowerCase().trim();
    if (VALID_STANCES.has(stance)) {
      return { stance, rationale: String(parsed.rationale || '').trim() || null };
    }
  }
  // Last resort: the model answered in prose. Only accept an unambiguous single direction.
  const lower = fenced.toLowerCase();
  const saysLong = /\blong\b|\bbullish\b/.test(lower);
  const saysShort = /\bshort\b|\bbearish\b/.test(lower);
  if (saysLong && !saysShort) return { stance: 'long', rationale: null };
  if (saysShort && !saysLong) return { stance: 'short', rationale: null };
  return null;
}

async function askEngine(engine, ticker, ctx) {
  const { model } = engineConfig(engine);
  const reply = await callAiProvider({
    engine,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(ticker, ctx) }]
  });
  const parsed = parseStanceReply(reply?.content);
  if (!parsed) throw new Error('unparseable stance reply');
  return { engine, stance: parsed.stance, rationale: parsed.rationale, model };
}

function toApiShape(row) {
  if (!row) return null;
  return {
    engine: row.engine,
    label: ENGINE_LABELS[row.engine] || row.engine,
    stance: row.stance,
    rationale: row.rationale || null,
    model: row.model || null
  };
}

/**
 * @param {string} rawTicker
 * @returns {Promise<{ ticker: string, as_of: string, source: 'cache'|'fresh'|'mixed', agents: object[], unavailable: object[] }>}
 */
async function getTickerAiStance(rawTicker) {
  const ticker = String(rawTicker || '').trim().toUpperCase();
  if (!ticker) {
    const err = new Error('ticker is required');
    err.status = 400;
    throw err;
  }

  const stanceDate = marketDayKey();
  const configured = STANCE_ENGINES.filter((e) => hasEngineKey(e));
  const unavailable = STANCE_ENGINES.filter((e) => !hasEngineKey(e)).map((e) => ({
    engine: e,
    label: ENGINE_LABELS[e] || e,
    reason: 'not configured'
  }));

  const stored = await getStancesForDay(ticker, stanceDate);
  const storedByEngine = new Map(stored.map((r) => [r.engine, r]));
  const missing = configured.filter((e) => !storedByEngine.has(e));

  if (!missing.length || !configured.length) {
    return {
      ticker,
      as_of: stanceDate,
      source: 'cache',
      agents: configured.map((e) => toApiShape(storedByEngine.get(e))).filter(Boolean),
      unavailable
    };
  }

  const key = `${ticker}:${stanceDate}`;
  if (!inflightByKey.has(key)) {
    inflightByKey.set(
      key,
      (async () => {
        const ctx = await loadMarketContext(ticker);
        if (!ctx) return [];
        const settled = await Promise.allSettled(missing.map((e) => askEngine(e, ticker, ctx)));
        const fresh = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
        if (fresh.length) {
          try {
            await insertStances(fresh.map((f) => ({ ...f, ticker, stanceDate })));
          } catch (err) {
            // A failed write costs a repeat call tomorrow, not a broken response today.
            console.warn('[tickerStance] persist failed:', err.message);
          }
        }
        for (const s of settled) {
          if (s.status === 'rejected') console.warn('[tickerStance] engine failed:', s.reason?.message);
        }
        return fresh;
      })().finally(() => inflightByKey.delete(key))
    );
  }
  const fresh = await inflightByKey.get(key);

  for (const row of fresh) storedByEngine.set(row.engine, row);
  const agents = configured.map((e) => toApiShape(storedByEngine.get(e))).filter(Boolean);
  const failed = configured
    .filter((e) => !storedByEngine.has(e))
    .map((e) => ({ engine: e, label: ENGINE_LABELS[e] || e, reason: 'no answer' }));

  return {
    ticker,
    as_of: stanceDate,
    source: stored.length ? 'mixed' : 'fresh',
    agents,
    unavailable: [...unavailable, ...failed]
  };
}

module.exports = { getTickerAiStance, marketDayKey, parseStanceReply };
