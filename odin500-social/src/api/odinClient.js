const fetch = require('node-fetch');
const { config } = require('../config');

async function request(method, apiPath, { query, body, auth = true } = {}) {
  const base = config.odinApiOrigin;
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const url = `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}${qs}`;

  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (auth && config.odinApiToken) {
    headers.Authorization = `Bearer ${config.odinApiToken}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `API ${res.status}: ${apiPath}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function getOhlcPreview(symbol, limit = 90) {
  return request('GET', '/api/public/market/ohlc-preview', {
    query: { symbol, limit },
    auth: false
  });
}

async function getTickerReturnsBatch(tickers) {
  if (!config.odinApiToken) return null;
  return request('POST', '/api/market/ticker-returns', {
    body: { tickers, batch: true }
  });
}

async function listNewsletters() {
  return request('GET', '/api/public/newsletter', { auth: false });
}

async function getNewsletterBySlug(slug) {
  return request('GET', `/api/public/newsletter/${encodeURIComponent(slug)}`, { auth: false });
}

module.exports = {
  request,
  getOhlcPreview,
  getTickerReturnsBatch,
  listNewsletters,
  getNewsletterBySlug
};
