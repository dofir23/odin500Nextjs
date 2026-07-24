const fetch = require('node-fetch');

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function finnhubToken() {
  return (
    process.env.FINNHUB_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_FINNHUB_TOKEN?.trim() ||
    ''
  );
}

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

function recentRange(days) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - Math.max(1, Number(days) || 10));
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function mapNews(row, prefix) {
  const headline = String(row?.headline || '').trim();
  if (!headline) return null;
  const id = row?.id != null ? `${prefix}-${row.id}` : `${prefix}-${row?.url || headline}`;
  const ts = Number(row?.datetime);
  return {
    id,
    headline,
    source: String(row?.source || 'Finnhub').trim() || 'Finnhub',
    datetime: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : null,
    url: String(row?.url || '').trim() || null
  };
}

async function fetchFinnhubJson(path, params) {
  const token = finnhubToken();
  if (!token) {
    return {
      ok: false,
      error: 'News unavailable — set FINNHUB_TOKEN on the server (same token used by the website news feed).',
      items: []
    };
  }
  const qs = new URLSearchParams({ ...params, token });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${FINNHUB_BASE}${path}?${qs}`, { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: `Finnhub HTTP ${res.status}`, items: [] };
    }
    const payload = await res.json();
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, error: err?.message || 'Finnhub request failed', items: [] };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGeneralMarketNews({ limit = 12 } = {}) {
  const result = await fetchFinnhubJson('/news', { category: 'general' });
  if (!result.ok) return { configured: Boolean(finnhubToken()), ...result, items: [] };
  const list = Array.isArray(result.payload) ? result.payload : [];
  const items = list
    .map((r) => mapNews(r, 'general'))
    .filter(Boolean)
    .slice(0, Math.min(24, Math.max(1, Number(limit) || 12)));
  return { configured: true, ok: true, category: 'general', items };
}

async function fetchCompanyNews(symbol, { days = 10, limit = 12 } = {}) {
  const sym = String(symbol || '')
    .trim()
    .toUpperCase();
  if (!sym) return { configured: Boolean(finnhubToken()), ok: false, error: 'symbol required', items: [] };
  const { from, to } = recentRange(days);
  const result = await fetchFinnhubJson('/company-news', { symbol: sym, from, to });
  if (!result.ok) return { configured: Boolean(finnhubToken()), symbol: sym, ...result, items: [] };
  const list = Array.isArray(result.payload) ? result.payload : [];
  const items = list
    .map((r) => mapNews(r, sym))
    .filter(Boolean)
    .slice(0, Math.min(24, Math.max(1, Number(limit) || 12)));
  return { configured: true, ok: true, symbol: sym, from, to, items };
}

module.exports = {
  finnhubToken,
  fetchGeneralMarketNews,
  fetchCompanyNews
};
