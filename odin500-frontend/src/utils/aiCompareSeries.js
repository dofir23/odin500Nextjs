/**
 * Series registry for the AI portfolio comparison chart.
 *
 * NormalizedPerformanceCard is keyed by opaque strings and resolves each key through a
 * `metaByKey` / `tickerByKey` pair. Here we build that pair from two very different sources —
 * static market indices and live published portfolios — so both can be plotted on one axis.
 *
 * Keys are namespaced (`idx:SPX`, `pf:<uuid>`) so the loader can tell which backend to call
 * without a second lookup, and so a portfolio id can never collide with an index symbol.
 */

import { MARKET_SERIES } from '../components/marketSeriesRegistry.js';
import { enrichPortfolioTags } from './aiPortfolioTags.js';

/** Index keys offered on this page — the three the AI portfolios actually trade against. */
export const COMPARE_INDEX_KEYS = ['INDU', 'SPX', 'NDX'];

/**
 * Trade directions the "best of each" picker can be narrowed to, in menu order. Ids match the
 * `ai_direction` column (and the text heuristic's fallback) so a series can be filtered by
 * straight equality — see `pickBestPerEngine`.
 */
export const DIRECTION_PRESETS = [
  { id: 'long', label: 'Best long only' },
  { id: 'short', label: 'Best short only' },
  { id: 'long_short', label: 'Best long-short only' }
];

export const ENGINE_SECTIONS = [
  { id: 'claude', label: 'Claude' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' }
];

/**
 * Per-engine line palettes. Portfolios take their colour from their engine's ramp so the chart
 * legend reinforces which model is which — the same amber/emerald/sky split the leaderboard
 * badges use. Five shades because each section shows five portfolios.
 */
const ENGINE_RAMPS = {
  claude: ['#f59e0b', '#fbbf24', '#d97706', '#fcd34d', '#b45309'],
  chatgpt: ['#10b981', '#34d399', '#059669', '#6ee7b7', '#047857'],
  gemini: ['#38bdf8', '#7dd3fc', '#0284c7', '#bae6fd', '#0369a1'],
  ai: ['#a78bfa', '#c4b5fd', '#8b5cf6', '#ddd6fe', '#7c3aed']
};

export const INDEX_KEY_PREFIX = 'idx:';
export const PORTFOLIO_KEY_PREFIX = 'pf:';

export function indexKey(marketKey) {
  return `${INDEX_KEY_PREFIX}${marketKey}`;
}

export function portfolioKey(accountId) {
  return `${PORTFOLIO_KEY_PREFIX}${accountId}`;
}

export function isPortfolioKey(key) {
  return String(key || '').startsWith(PORTFOLIO_KEY_PREFIX);
}

/** Strips the namespace back off — the loader needs the raw id/symbol. */
export function keyTarget(key) {
  const s = String(key || '');
  if (s.startsWith(PORTFOLIO_KEY_PREFIX)) return s.slice(PORTFOLIO_KEY_PREFIX.length);
  if (s.startsWith(INDEX_KEY_PREFIX)) return s.slice(INDEX_KEY_PREFIX.length);
  return s;
}

/** Short axis-badge label. Portfolio names are long, so badges get an abbreviation. */
function badgeLabel(name) {
  const clean = String(name || '').trim();
  if (clean.length <= 12) return clean.toUpperCase();
  const words = clean.split(/[\s\-_]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  return clean.slice(0, 10).toUpperCase();
}

/** The three comparison indices, in the shape NormalizedPerformanceCard expects. */
export function buildIndexSeries() {
  return COMPARE_INDEX_KEYS.map((mk) => {
    const meta = MARKET_SERIES.find((s) => s.key === mk);
    if (!meta) return null;
    return {
      ...meta,
      key: indexKey(mk),
      target: meta.ticker,
      kind: 'index',
      chipLabel: meta.label
    };
  }).filter(Boolean);
}

/**
 * One chart series per portfolio row, coloured from its engine's ramp.
 * @param {string} engineId
 * @param {Array<{id: string, name: string}>} portfolios
 */
export function buildEngineSeries(engineId, portfolios) {
  const ramp = ENGINE_RAMPS[engineId] || ENGINE_RAMPS.ai;
  return (portfolios || []).map((p, i) => {
    const color = ramp[i % ramp.length];
    // Same enrichment the /ai listing uses, so the direction shown on a portfolio's row there
    // is the one the "best of each" presets filter on here.
    const direction = enrichPortfolioTags(p).direction?.id || 'long';
    return {
      key: portfolioKey(p.id),
      target: p.id,
      kind: 'portfolio',
      engineId,
      label: p.name,
      chipLabel: p.name,
      symbol: badgeLabel(p.name),
      color,
      badge: color,
      tone: engineId,
      accountId: p.id,
      direction,
      publishedAt: p.published_at || null,
      // Fill the rail's Last / Δ / % columns the same way an index snapshot does.
      equity: p.equity ?? null,
      totalReturn: p.total_return ?? null,
      totalReturnPct: p.total_return_pct ?? null
    };
  });
}

/**
 * Best portfolio per engine, optionally narrowed to one trade direction.
 *
 * Each engine's list arrives already sorted by total return, so "best" is just the first row
 * that matches. The match is exact and exclusive: `short` never picks up a long-short book and
 * vice versa, since a hedged strategy answers a different question than a directional one.
 * Engines with nothing matching are skipped rather than substituted. Only the rail's own top-N
 * rows are considered, since a key outside the registry has no series for the chart to draw.
 *
 * @param {Record<string, Array<object>>} engineSeries keyed by engine id
 * @param {string[]} engineIds order to pick in
 * @param {string} [direction] one of `DIRECTION_PRESETS`; omitted means best overall
 * @returns {Array<object>}
 */
export function pickBestPerEngine(engineSeries, engineIds, direction) {
  return (engineIds || [])
    .map((id) => {
      const rows = engineSeries?.[id] || [];
      return direction ? rows.find((s) => s.direction === direction) : rows[0];
    })
    .filter(Boolean);
}

/**
 * Makes every badge unique.
 *
 * Initials collide constantly across a portfolio list — "AI-Claude-DowJones-Long-Strategy" and
 * "AI-Claude-DowJones-Long-Short" both reduce to ACD. The badge is also the chart's axis label,
 * so a repeat leaves two lines labelled identically. Repeats get a numeric suffix.
 * @param {Array<object>} series
 */
export function dedupeSeriesSymbols(series) {
  const taken = new Set();
  return (series || []).map((s) => {
    const base = String(s.symbol || '').toUpperCase() || 'PF';
    if (!taken.has(base)) {
      taken.add(base);
      return s;
    }
    let n = 2;
    while (taken.has(`${base}${n}`)) n += 1;
    const unique = `${base}${n}`;
    taken.add(unique);
    return { ...s, symbol: unique };
  });
}

/**
 * Collapses every series into the `{ metaByKey, tickerByKey }` pair the chart resolves keys
 * through. A key missing from `tickerByKey` is silently skipped by the chart, so both maps are
 * always built from the same list.
 * @param {Array<object>} allSeries
 */
export function buildChartRegistry(allSeries) {
  const metaByKey = {};
  const tickerByKey = {};
  for (const s of allSeries) {
    metaByKey[s.key] = s;
    tickerByKey[s.key] = s.target;
  }
  return { metaByKey, tickerByKey };
}

/**
 * Baseline for a mixed selection: the latest inception among the selected portfolios, so every
 * series is measured over a span all of them actually cover. Indices alone need no baseline —
 * they all run the full window — so this returns null when nothing but indices is selected.
 * @param {string[]} selectedKeys
 * @param {Record<string, object>} metaByKey
 * @returns {number|null}
 */
export function commonBaselineMs(selectedKeys, metaByKey) {
  let latest = null;
  for (const key of selectedKeys || []) {
    const meta = metaByKey[key];
    if (!meta || meta.kind !== 'portfolio' || !meta.publishedAt) continue;
    const ms = Date.parse(meta.publishedAt);
    if (!Number.isFinite(ms)) continue;
    if (latest == null || ms > latest) latest = ms;
  }
  return latest;
}

/** Human label for the baseline notice under the chart. */
export function baselineLabel(baselineMs) {
  if (!Number.isFinite(baselineMs)) return '';
  return new Date(baselineMs).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
