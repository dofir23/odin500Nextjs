import { sanitizeTickerPageInput } from './tickerUrlSync.js';

/** Allow comma-separated ticker tokens in multiselect combobox inputs. */
export function sanitizeTickerMultiselectInput(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9.,-]/g, '')
    .slice(0, 200);
}

/** Search token after the last comma: `AAPL,msft` → `MSFT`. */
export function activeTokenFromMultiselectQuery(rawQuery) {
  const raw = sanitizeTickerMultiselectInput(rawQuery);
  const parts = raw.split(',');
  const last = parts.length ? parts[parts.length - 1] : raw;
  return sanitizeTickerPageInput(String(last || '').trim());
}

/**
 * @param {string} rawQuery
 * @returns {{ committed: string[], active: string }}
 */
export function parseMultiselectTickerInput(rawQuery) {
  const raw = sanitizeTickerMultiselectInput(rawQuery);
  if (!raw) return { committed: [], active: '' };

  const endsWithComma = raw.endsWith(',');
  const parts = raw.split(',');

  if (endsWithComma) {
    const committed = parts
      .slice(0, -1)
      .map((p) => sanitizeTickerPageInput(p.trim()))
      .filter(Boolean);
    return { committed, active: '' };
  }

  if (parts.length === 1) {
    return { committed: [], active: sanitizeTickerPageInput(parts[0].trim()) };
  }

  const active = sanitizeTickerPageInput(String(parts[parts.length - 1] || '').trim());
  const committed = parts
    .slice(0, -1)
    .map((p) => sanitizeTickerPageInput(p.trim()))
    .filter(Boolean);
  return { committed, active };
}

/** Display value after picks: `AAPL,MSFT,` so the user can type the next symbol. */
export function formatMultiselectTickerInput(symbols, activePartial = '') {
  const list = (Array.isArray(symbols) ? symbols : [])
    .map((s) => sanitizeTickerPageInput(s))
    .filter(Boolean);
  const active = sanitizeTickerPageInput(activePartial);
  if (!list.length && !active) return '';
  if (!active) return list.length ? `${list.join(',')},` : '';
  return `${list.join(',')}${list.length ? ',' : ''}${active}`;
}

export function normalizeTickerSymbolList(raw) {
  const out = [];
  const seen = new Set();
  for (const s of Array.isArray(raw) ? raw : []) {
    const sym = sanitizeTickerPageInput(s);
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
  }
  return out;
}
