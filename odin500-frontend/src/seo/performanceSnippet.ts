/** Read period return % from ticker-returns `performance.dynamicPeriods`. */
export function pickDynamicReturn(
  performance: Record<string, unknown> | undefined,
  periodName: string
): number | null {
  const rows = performance?.dynamicPeriods;
  if (!Array.isArray(rows)) return null;
  const row = rows.find((r) => (r as Record<string, unknown>).period === periodName) as
    | Record<string, unknown>
    | undefined;
  if (!row || row.totalReturn == null) return null;
  const n = Number(row.totalReturn);
  return Number.isFinite(n) ? n : null;
}

export function formatReturnPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
