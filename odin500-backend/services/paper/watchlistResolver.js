const supabaseService = require('../../config/supabaseService');
const { getTickersByGroupId } = require('../../utils/watchlistUtils');
const { makeCacheKey, getCache, setCache } = require('../../utils/cache');
const {
  getLatestSignalsForTickers,
  signalSideFromBucket
} = require('./latestSignal');

const LONG_RANK = { L1: 3, L2: 2, L3: 1 };
const SHORT_RANK = { S1: 3, S2: 2, S3: 1 };

const WL_META_CACHE_TTL_SECS = Number(process.env.PAPER_WATCHLIST_META_CACHE_TTL_SECS || 300);
const WL_SIGNALS_CACHE_TTL_SECS = Number(process.env.PAPER_WATCHLIST_SIGNALS_CACHE_TTL_SECS || 120);

/** @type {Map<string, Promise<{ data: object, cacheHit: boolean }>>} */
const inflightLeaders = new Map();

function longRank(bucket) {
  return LONG_RANK[String(bucket || '').toUpperCase()] || 0;
}

function shortRank(bucket) {
  return SHORT_RANK[String(bucket || '').toUpperCase()] || 0;
}

function metaCacheKey(userId, watchlistKey) {
  const key = String(watchlistKey || '').trim();
  if (key.startsWith('def:')) {
    return makeCacheKey('paper:wl-meta:v1', { watchlistKey: key });
  }
  return makeCacheKey('paper:wl-meta:v1', { userId, watchlistKey: key });
}

function leadersCacheKey(userId, watchlistKey, limit) {
  return makeCacheKey('paper:wl-signals:v1', {
    userId,
    watchlistKey: String(watchlistKey || '').trim(),
    limit: limit == null ? 'all' : limit
  });
}

/**
 * @param {string} userId
 * @param {string} watchlistKey e.g. usr:uuid or def:Dow Jones
 */
async function resolveWatchlistMeta(userId, watchlistKey) {
  const key = String(watchlistKey || '').trim();
  if (!key) return null;

  const cached = await getCache(metaCacheKey(userId, key));
  if (cached) return cached;

  let meta = null;

  if (key.startsWith('usr:')) {
    const id = key.slice(4);
    const { data: wl, error } = await supabaseService
      .from('watchlists')
      .select('id, name, watchlist_items(tickers(symbol))')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!wl) return null;
    const symbols = [
      ...new Set(
        (wl.watchlist_items || [])
          .map((i) => i.tickers?.symbol)
          .filter(Boolean)
          .map((s) => String(s).trim().toUpperCase())
      )
    ];
    meta = { key, name: wl.name || 'Untitled', kind: 'user', symbols };
  } else if (key.startsWith('def:')) {
    const groupName = key.slice(4);
    const { data: group, error } = await supabaseService
      .from('market_groups')
      .select('id, name')
      .eq('name', groupName)
      .maybeSingle();
    if (error) throw error;
    if (!group) return null;
    const tickers = await getTickersByGroupId(group.id);
    const symbols = [
      ...new Set(
        (tickers || [])
          .map((t) => String(t.symbol || '').trim().toUpperCase())
          .filter(Boolean)
      )
    ];
    meta = { key, name: groupName, kind: 'default', symbols };
  }

  if (meta) {
    await setCache(metaCacheKey(userId, key), meta, WL_META_CACHE_TTL_SECS);
  }
  return meta;
}

/**
 * @param {string} userId
 * @param {string} watchlistKey
 * @param {{ limit?: number }} [opts]
 */
function parseLeaderLimit(raw) {
  if (raw === 'all' || raw === '0' || raw === 0) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(Math.max(n, 1), 500);
}

function buildLeadersPayload(meta, signalMap, limit) {
  const rows = meta.symbols.map((symbol) => {
    const bucket = signalMap.get(symbol) || 'N';
    return {
      symbol,
      bucket,
      side: signalSideFromBucket(bucket),
      longRank: longRank(bucket),
      shortRank: shortRank(bucket)
    };
  });

  const longSorted = rows
    .filter((r) => r.longRank > 0)
    .sort((a, b) => b.longRank - a.longRank || a.symbol.localeCompare(b.symbol))
    .map(({ symbol, bucket, longRank: rank }) => ({ symbol, bucket, rank }));

  const shortSorted = rows
    .filter((r) => r.shortRank > 0)
    .sort((a, b) => b.shortRank - a.shortRank || a.symbol.localeCompare(b.symbol))
    .map(({ symbol, bucket, shortRank: rank }) => ({ symbol, bucket, rank }));

  return {
    watchlist: {
      key: meta.key,
      name: meta.name,
      kind: meta.kind,
      symbolCount: meta.symbols.length
    },
    tickers: rows
      .map(({ symbol, bucket }) => ({ symbol, bucket }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
    longs: limit == null ? longSorted : longSorted.slice(0, limit),
    shorts: limit == null ? shortSorted : shortSorted.slice(0, limit)
  };
}

/**
 * @returns {Promise<{ data: object, cacheHit: boolean }>}
 */
async function getWatchlistSignalLeaders(userId, watchlistKey, opts = {}) {
  const limit = parseLeaderLimit(opts.limit);
  const cacheKey = leadersCacheKey(userId, watchlistKey, limit);

  const cached = await getCache(cacheKey);
  if (cached) {
    return { data: cached, cacheHit: true };
  }

  if (inflightLeaders.has(cacheKey)) {
    return inflightLeaders.get(cacheKey);
  }

  const work = (async () => {
    const meta = await resolveWatchlistMeta(userId, watchlistKey);
    if (!meta) {
      const err = new Error('Watchlist not found');
      err.status = 404;
      throw err;
    }

    const signalMap = await getLatestSignalsForTickers(meta.symbols);
    const data = buildLeadersPayload(meta, signalMap, limit);
    await setCache(cacheKey, data, WL_SIGNALS_CACHE_TTL_SECS);
    return { data, cacheHit: false };
  })();

  inflightLeaders.set(cacheKey, work);
  try {
    return await work;
  } finally {
    inflightLeaders.delete(cacheKey);
  }
}

module.exports = {
  resolveWatchlistMeta,
  getWatchlistSignalLeaders,
  WL_SIGNALS_CACHE_TTL_SECS,
  WL_META_CACHE_TTL_SECS
};
