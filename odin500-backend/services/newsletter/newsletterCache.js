const { getCache, setCache, bumpVersion, getVersion } = require('../../utils/cache');

const NAMESPACE = 'newsletter';
const TTL_SECS = Number(process.env.NEWSLETTER_CACHE_TTL_SECS || 600);
const MEM_TTL_MS = Number(process.env.NEWSLETTER_MEM_CACHE_MS || 30_000);

/** @type {Map<string, { value: unknown, exp: number }>} */
const memory = new Map();

function getMem(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function setMem(key, value) {
  memory.set(key, { value, exp: Date.now() + MEM_TTL_MS });
}

async function versionedKey(suffix) {
  const v = await getVersion(NAMESPACE);
  return `newsletter:${suffix}:v${v}`;
}

/**
 * @template T
 * @param {string} suffix
 * @param {() => Promise<T>} loader
 * @returns {Promise<T>}
 */
async function cached(suffix, loader) {
  const key = await versionedKey(suffix);
  const memHit = getMem(key);
  if (memHit !== null) return memHit;

  const redisHit = await getCache(key);
  if (redisHit !== null) {
    setMem(key, redisHit);
    return redisHit;
  }

  const value = await loader();
  setMem(key, value);
  await setCache(key, value, TTL_SECS);
  return value;
}

async function invalidateNewsletterCache() {
  memory.clear();
  await bumpVersion(NAMESPACE);
}

async function prewarmNewsletterCache() {
  try {
    const { listNewsletterSummaries, ensureTables } = require('./newsletterStore');
    await ensureTables();
    await cached('list:summaries', () => listNewsletterSummaries());
    console.log('[newsletter] cache prewarmed');
  } catch (err) {
    console.warn('[newsletter] prewarm failed:', err?.message || err);
  }
}

function setPublicCacheHeaders(res) {
  const maxAge = TTL_SECS;
  res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=60`);
}

module.exports = {
  cached,
  invalidateNewsletterCache,
  prewarmNewsletterCache,
  setPublicCacheHeaders,
  TTL_SECS
};
