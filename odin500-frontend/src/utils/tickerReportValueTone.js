/**
 * Map display strings (+7.30%, −5.2%, etc.) to pos/neg for app-num--up / app-num--down.
 * @param {unknown} value
 * @returns {'pos' | 'neg' | ''}
 */
export function toneFromValue(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return 'pos';
  if (s.startsWith('-') || s.startsWith('−')) return 'neg';
  return '';
}

/**
 * @param {'pos' | 'neg' | 'neutral' | '' | undefined} tone
 * @param {unknown} [value]
 * @returns {'pos' | 'neg' | ''}
 */
export function resolveValueTone(tone, value) {
  if (tone === 'pos' || tone === 'neg') return tone;
  return toneFromValue(value);
}

/**
 * @param {'pos' | 'neg' | 'neutral' | '' | undefined} tone
 * @param {unknown} [value]
 * @returns {string}
 */
export function valueToneClassName(tone, value) {
  const t = resolveValueTone(tone, value);
  if (t === 'pos') return 'app-num--up';
  if (t === 'neg') return 'app-num--down';
  return '';
}
