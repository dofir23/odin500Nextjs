const supabase = require('../../config/supabase');
const { getTickersByGroupId } = require('../../utils/watchlistUtils');
const { makeCacheKey, getCache, setCache } = require('../../utils/cache');

const UNIVERSE_CACHE_TTL_SECS = Number(process.env.SPLITS_UNIVERSE_CACHE_TTL_SECS || 1800);

const INDEX_SLUGS = new Set(['sp500', 'dow', 'nasdaq', 'all']);

const SLUG_TO_INDEX_NAME = {
  sp500: 'SP500',
  dow: 'Dow Jones',
  nasdaq: 'Nasdaq 100'
};

function normIndexKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveMarketGroup(indexValue, groups) {
  const groupsArr = groups || [];
  if (!groupsArr.length) return null;
  const raw = String(indexValue || '').trim();
  if (!raw) return null;
  const n = normIndexKey(raw);
  const up = raw.toUpperCase();

  for (const g of groupsArr) {
    if (g.code && String(g.code).toUpperCase() === up) return g;
  }

  const aliasToCode = {
    's&p 500': 'SP',
    sp500: 'SP',
    'sp 500': 'SP',
    's&p500': 'SP',
    'dow jones 30': 'DJ',
    'dow jones': 'DJ',
    dow: 'DJ',
    djia: 'DJ',
    'nasdaq 100': 'ND',
    nasdaq100: 'ND',
    ndx: 'ND'
  };
  const code = aliasToCode[n] || aliasToCode[raw.toLowerCase().replace(/\s+/g, ' ')];
  if (code) {
    const found = groupsArr.find((x) => (x.code || '').toUpperCase() === code);
    if (found) return found;
  }

  for (const g of groupsArr) {
    if (normIndexKey(g.name) === n) return g;
  }
  const compact = (s) => s.replace(/[^a-z0-9]/gi, '');
  const nc = compact(n);
  for (const g of groupsArr) {
    if (compact(normIndexKey(g.name)) === nc) return g;
  }
  return null;
}

async function fetchMarketGroups() {
  const { data, error } = await supabase
    .from('market_groups')
    .select('id, name, code')
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * @param {'sp500'|'dow'|'nasdaq'|'all'} slug
 * @returns {Promise<string[]>} upper-case symbols
 */
async function getSymbolsForSlug(slug) {
  const cacheKey = makeCacheKey('splits:universe', { slug });
  const cached = await getCache(cacheKey);
  if (Array.isArray(cached)) return cached;

  if (slug === 'all') {
    const parts = await Promise.all(['sp500', 'dow', 'nasdaq'].map((s) => getSymbolsForSlug(s)));
    const merged = [...new Set(parts.flat())];
    await setCache(cacheKey, merged, UNIVERSE_CACHE_TTL_SECS);
    return merged;
  }

  const indexName = SLUG_TO_INDEX_NAME[slug];
  if (!indexName) return [];

  const groups = await fetchMarketGroups();
  const group = resolveMarketGroup(indexName, groups);
  if (!group?.id) return [];

  const tickers = await getTickersByGroupId(group.id);
  const symbols = [
    ...new Set(
      tickers
        .map((t) => String(t.symbol || '').trim().toUpperCase())
        .filter(Boolean)
    )
  ];
  await setCache(cacheKey, symbols, UNIVERSE_CACHE_TTL_SECS);
  return symbols;
}

function normalizeIndexSlug(raw) {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  if (s === 'dow-jones' || s === 'djia') return 'dow';
  if (s === 'nasdaq-100' || s === 'nasdaq100' || s === 'ndx') return 'nasdaq';
  if (INDEX_SLUGS.has(s)) return s;
  return 'all';
}

module.exports = {
  INDEX_SLUGS,
  getSymbolsForSlug,
  normalizeIndexSlug
};
