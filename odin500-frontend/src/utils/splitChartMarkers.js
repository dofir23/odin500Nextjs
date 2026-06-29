/**
 * Map corporate split rows to lightweight-charts series markers.
 * @param {Array<{ execution_date?: string, split_ratio?: string, adjustment_type?: string }>} splits
 */
export function mapSplitsToChartMarkers(splits) {
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (const split of splits || []) {
    const time = String(split?.execution_date || '').slice(0, 10);
    if (!time || time > today) continue;
    const ratio = split.split_ratio || '';
    const type = split.adjustment_type || '';
    const isReverse = type === 'reverse_split';
    out.push({
      time,
      position: 'aboveBar',
      shape: 'circle',
      color: isReverse ? '#f97316' : '#a855f7',
      text: ratio ? `Split ${ratio}` : 'Split'
    });
  }
  return out;
}

/**
 * Snap marker times to the nearest candle when execution falls on a non-trading day.
 * @param {Array<{ time: string }>} markers
 * @param {Array<{ time: string }>} candles
 */
export function snapMarkersToNearestCandle(markers, candles) {
  if (!markers?.length || !candles?.length) return [];
  const times = candles.map((c) => c.time).filter(Boolean);
  if (!times.length) return [];

  const snap = (target) => {
    if (times.includes(target)) return target;
    let best = times[0];
    let bestDiff = Math.abs(new Date(target) - new Date(best));
    for (let i = 1; i < times.length; i++) {
      const diff = Math.abs(new Date(target) - new Date(times[i]));
      if (diff < bestDiff) {
        best = times[i];
        bestDiff = diff;
      }
    }
    return best;
  };

  const byTime = new Map();
  for (const m of markers) {
    if (!m?.time) continue;
    const t = snap(m.time);
    if (!byTime.has(t)) byTime.set(t, []);
    byTime.get(t).push({ ...m, time: t });
  }

  const merged = [];
  for (const [time, items] of byTime.entries()) {
    merged.push({
      time,
      position: items[0].position,
      shape: items[0].shape,
      color: items[0].color,
      text: items.map((x) => x.text).filter(Boolean).join(' · ')
    });
  }
  return merged.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}
