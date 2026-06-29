/**
 * Build merged watchlist dropdown options (user lists + default groups).
 * @param {unknown} defaultsRaw
 * @param {unknown} mineRaw
 */

function symbolsFromDefaultItems(items) {
  const arr = Array.isArray(items) ? items : [];
  return [
    ...new Set(
      arr
        .map((r) => String(r.symbol || '').trim().toUpperCase())
        .filter(Boolean)
    )
  ];
}

function symbolsFromUserTickers(tickers) {
  const arr = Array.isArray(tickers) ? tickers : [];
  return [
    ...new Set(
      arr
        .map((t) => String(t.symbol || '').trim().toUpperCase())
        .filter(Boolean)
    )
  ];
}

export function optionsFromApiArrays(defaultsRaw, mineRaw) {
  const built = [];
  if (defaultsRaw != null) {
    const defaults = Array.isArray(defaultsRaw) ? defaultsRaw : [];
    for (const d of defaults) {
      const g = String(d.group || '').trim() || 'Default';
      built.push({
        key: 'def:' + g,
        name: g,
        kind: /** @type {'default'} */ ('default'),
        watchlistId: undefined,
        symbols: symbolsFromDefaultItems(d.items)
      });
    }
  }
  /** @type {Array<{ key: string, name: string, kind: 'user' | 'default', watchlistId?: string, symbols: string[] }>} */
  const userOpts = [];
  if (mineRaw != null) {
    const mine = Array.isArray(mineRaw) ? mineRaw : [];
    for (const wl of mine) {
      userOpts.push({
        key: 'usr:' + wl.id,
        watchlistId: String(wl.id),
        name: String(wl.name || 'Untitled').trim() || 'Untitled',
        kind: /** @type {'user'} */ ('user'),
        symbols: symbolsFromUserTickers(wl.tickers)
      });
    }
  }
  return [...userOpts, ...built];
}

export function pickWatchlistKeyForMerged(merged, prevKey) {
  if (prevKey && merged.some((o) => o.key === prevKey)) return prevKey;
  const firstUser = merged.find((o) => o.kind === 'user');
  if (firstUser) return firstUser.key;
  return merged[0]?.key || '';
}

export function watchlistKindTag(kind) {
  if (kind === 'user') return 'Yours';
  if (kind === 'default') return 'Default';
  return '';
}
