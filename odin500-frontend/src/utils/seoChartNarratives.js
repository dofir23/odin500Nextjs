function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const nums = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function fmtPct(v) {
  const n = toNumber(v);
  if (n == null) return '0.00%';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function periodFromRow(row) {
  return String(row?.period ?? row?.year ?? '').trim();
}

function periodNouns(mode) {
  if (mode === 'annual') return { singular: 'year', plural: 'years' };
  if (mode === 'quarterly') return { singular: 'quarter', plural: 'quarters' };
  if (mode === 'monthly') return { singular: 'month', plural: 'months' };
  if (mode === 'weekly') return { singular: 'week', plural: 'weeks' };
  if (mode === 'daily') return { singular: 'day', plural: 'days' };
  return { singular: 'period', plural: 'periods' };
}

export function buildReturnNarrative({ rows, symbol, mode = 'period', valueField = 'totalReturn' }) {
  const list = Array.isArray(rows) ? rows : [];
  const vals = list.map((r) => toNumber(r?.[valueField])).filter((v) => v != null);
  if (!vals.length) return '';
  const nouns = periodNouns(mode);
  const up = vals.filter((v) => v > 0).length;
  const down = vals.filter((v) => v < 0).length;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const med = median(vals);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const maxRow = list.find((r) => toNumber(r?.[valueField]) === maxV);
  const minRow = list.find((r) => toNumber(r?.[valueField]) === minV);
  const sym = String(symbol || 'this symbol').toUpperCase();
  return [
    `In the last ${vals.length} ${nouns.plural}, ${sym} increased in ${up} and decreased in ${down}.`,
    `The average return for this period was ${fmtPct(avg)}, while the median return was ${fmtPct(med)}.`,
    `Maximum gain was ${fmtPct(maxV)} on ${periodFromRow(maxRow)} and maximum loss was ${fmtPct(minV)} on ${periodFromRow(minRow)}.`
  ].join(' ');
}

export function buildComparisonNarrative({ rows, ticker, benchmark, mode = 'period' }) {
  const list = Array.isArray(rows) ? rows : [];
  const tVals = list.map((r) => toNumber(r?.tickerReturn)).filter((v) => v != null);
  const bVals = list.map((r) => toNumber(r?.benchmarkReturn)).filter((v) => v != null);
  if (!tVals.length || !bVals.length) return '';
  const nouns = periodNouns(mode);
  const excess = list.map((r) => toNumber(r?.excessReturn)).filter((v) => v != null);
  const avgT = tVals.reduce((a, b) => a + b, 0) / tVals.length;
  const avgB = bVals.reduce((a, b) => a + b, 0) / bVals.length;
  const avgEx = excess.length ? excess.reduce((a, b) => a + b, 0) / excess.length : avgT - avgB;
  return [
    `This chart compares ${String(ticker || '').toUpperCase()} versus ${String(benchmark || '').toUpperCase()} over ${tVals.length} ${nouns.plural}.`,
    `Average ${String(ticker || '').toUpperCase()} return is ${fmtPct(avgT)} and average ${String(benchmark || '').toUpperCase()} return is ${fmtPct(avgB)}.`,
    `Average excess return (${String(ticker || '').toUpperCase()} minus ${String(benchmark || '').toUpperCase()}) is ${fmtPct(avgEx)}.`
  ].join(' ');
}

export function buildExcessNarrative({ rows, ticker, benchmark, mode = 'period' }) {
  const list = Array.isArray(rows) ? rows : [];
  const vals = list.map((r) => toNumber(r?.excessReturn)).filter((v) => v != null);
  if (!vals.length) return '';
  const nouns = periodNouns(mode);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const med = median(vals);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const maxRow = list.find((r) => toNumber(r?.excessReturn) === maxV);
  const minRow = list.find((r) => toNumber(r?.excessReturn) === minV);
  const t = String(ticker || '').toUpperCase();
  const b = String(benchmark || '').toUpperCase();
  return [
    `Excess return for ${t} versus ${b} is shown for ${vals.length} ${nouns.plural}.`,
    `Average excess return is ${fmtPct(avg)} and median excess return is ${fmtPct(med)}.`,
    `Maximum excess gain is ${fmtPct(maxV)} on ${periodFromRow(maxRow)}, while maximum excess loss is ${fmtPct(minV)} on ${periodFromRow(minRow)}.`
  ].join(' ');
}

function clampLen(s, max = 800) {
  const str = String(s || '').trim();
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + '…';
}

export function buildNormalizedPerformanceNarrative({ timeframe, seriesLabels = [], lastByLabel = {} }) {
  const tf = String(timeframe || '').trim() || 'selected range';
  const labels = (Array.isArray(seriesLabels) ? seriesLabels : []).filter(Boolean);
  if (!labels.length) return '';
  const parts = [];
  parts.push(`Normalized performance compares selected series over ${tf}, all starting from the same 0% baseline.`);
  const lastParts = [];
  for (const label of labels.slice(0, 8)) {
    const v = toNumber(lastByLabel[label]);
    if (v == null) continue;
    lastParts.push(`${String(label).toUpperCase()}: ${fmtPct(v)}`);
  }
  if (lastParts.length) {
    parts.push(`Latest values: ${lastParts.join(', ')}.`);
  }
  return clampLen(parts.join(' '), 900);
}

export function buildHeatmapNarrative({ indexLabel, periodLabel, rowCount, gainers, losers }) {
  const idx = String(indexLabel || 'the selected index');
  const per = String(periodLabel || 'the selected period');
  const n = Number(rowCount);
  const countText = Number.isFinite(n) && n > 0 ? `${n} stocks` : 'stocks';
  const g = Number(gainers);
  const l = Number(losers);
  const gl =
    Number.isFinite(g) && Number.isFinite(l)
      ? `In ${per}, ${g} finished up and ${l} finished down.`
      : '';
  return clampLen(
    `This heatmap shows ${countText} in ${idx}, colored by return for ${per}. ${gl}`.trim(),
    700
  );
}

export function buildMoversNarrative({ indexLabel, intervalLabel, pointCount }) {
  const idx = String(indexLabel || 'the selected index');
  const it = String(intervalLabel || 'the selected interval');
  const n = Number(pointCount);
  const countText = Number.isFinite(n) && n > 0 ? `${n} stocks` : 'stocks';
  return clampLen(
    `Market movers shows ${countText} in ${idx} for ${it}, highlighting top gainers and losers and their relative volume where available.`,
    700
  );
}

export function buildTableNarrative({ title, rowCount, columns = [] }) {
  const t = String(title || 'Data table');
  const n = Number(rowCount);
  const countText = Number.isFinite(n) ? `${n} rows` : 'rows';
  const cols = (Array.isArray(columns) ? columns : []).filter(Boolean);
  const colText = cols.length ? `Columns include ${cols.slice(0, 10).join(', ')}.` : '';
  return clampLen(`${t} contains ${countText}. ${colText}`.trim(), 700);
}
