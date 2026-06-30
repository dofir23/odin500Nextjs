/** Strip broken YAML block markers (e.g. `>-`) and empty descriptions. */
function normalizeNewsletterDescription(description, fallback = '') {
  const d = String(description || '').trim();
  if (!d) return fallback;
  if (/^>[\-|+]?$/.test(d)) return fallback;
  if (d === '...' || d === '|' || d === '|-') return fallback;
  return d;
}

module.exports = { normalizeNewsletterDescription };
