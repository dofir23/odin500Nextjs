const { config } = require('../config');

function pad(n) {
  return String(n).padStart(2, '0');
}

function contentId(campaign, symbol = '') {
  const d = new Date();
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const sym = symbol ? `_${String(symbol).toLowerCase()}` : '';
  return `${ymd}${sym}_${campaign}`;
}

function buildPageUrl(path) {
  const base = config.odinSiteOrigin.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function buildTrackedUrl({ campaign, path, source = 'twitter', content = '' }) {
  if (!config.utmEnabled) {
    return buildPageUrl(path);
  }
  const url = new URL(path, config.odinSiteOrigin);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', config.utm.defaultMedium || 'social');
  url.searchParams.set('utm_campaign', campaign);
  if (content) url.searchParams.set('utm_content', content);
  return url.toString();
}

function resolvePath(campaign, vars = {}) {
  const spec = config.utm.campaigns[campaign];
  if (!spec) return '/market';
  if (spec.path) return spec.path;
  if (spec.pathTemplate) {
    return spec.pathTemplate.replace(/\{(\w+)\}/g, (_, key) =>
      encodeURIComponent(String(vars[key] || '').toLowerCase())
    );
  }
  return '/market';
}

function formatPct(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function formatPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toFixed(2)}`;
}

function etDateLabel(d = new Date()) {
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

module.exports = {
  contentId,
  buildPageUrl,
  buildTrackedUrl,
  resolvePath,
  formatPct,
  formatPrice,
  etDateLabel
};
