const fetch = require('node-fetch');
const { MASSIVE_API_BASE, getMassiveApiKey } = require('./splitConfig');

/**
 * @param {Record<string, string | number | undefined>} [params]
 * @returns {Promise<{ results?: object[], next_url?: string, status?: string }>}
 */
async function fetchSplitsPage(params = {}) {
  const apiKey = getMassiveApiKey();
  if (!apiKey) {
    throw new Error('MASSIVE_API_KEY is not configured');
  }

  const url = new URL(`${MASSIVE_API_BASE}/stocks/v1/splits`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set('apiKey', apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload?.error || payload?.message || res.statusText || 'Massive splits request failed';
    throw new Error(msg);
  }
  return payload;
}

/**
 * Follow Massive pagination (`next_url`) until exhausted.
 * @param {Record<string, string | number | undefined>} initialParams
 * @param {{ maxPages?: number }} [opts]
 */
async function fetchAllSplits(initialParams = {}, opts = {}) {
  const maxPages = opts.maxPages ?? 200;
  const all = [];
  let page = 0;
  let nextUrl = null;
  let params = { ...initialParams };

  while (page < maxPages) {
    const payload = nextUrl
      ? await fetchSplitsPageFromUrl(nextUrl)
      : await fetchSplitsPage(params);
    const batch = Array.isArray(payload?.results) ? payload.results : [];
    all.push(...batch);
    nextUrl = payload?.next_url || null;
    page += 1;
    if (!nextUrl) break;
    params = {};
  }

  return all;
}

async function fetchSplitsPageFromUrl(nextUrl) {
  const apiKey = getMassiveApiKey();
  const url = new URL(nextUrl);
  if (!url.searchParams.get('apiKey') && apiKey) {
    url.searchParams.set('apiKey', apiKey);
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload?.error || payload?.message || res.statusText || 'Massive splits request failed';
    throw new Error(msg);
  }
  return payload;
}

module.exports = {
  fetchSplitsPage,
  fetchAllSplits
};
