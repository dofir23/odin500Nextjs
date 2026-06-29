/** Server-rendered SVG line chart from OHLC/close rows. */

function closeFromRow(r: Record<string, unknown>) {
  const n = Number(r.close ?? r.Close ?? r.c ?? r.adj_close);
  return Number.isFinite(n) ? n : null;
}

function dateFromRow(r: Record<string, unknown>) {
  return String(r.date ?? r.trade_date ?? r.time ?? '').slice(0, 10);
}

type SvgSparklineProps = {
  rows: unknown[];
  width?: number;
  height?: number;
  caption?: string;
  stroke?: string;
};

export function SvgSparkline({
  rows,
  width = 640,
  height = 140,
  caption,
  stroke = '#59A9FF'
}: SvgSparklineProps) {
  const list = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && typeof r === 'object')
    .map((r) => r as Record<string, unknown>)
    .map((r) => ({ date: dateFromRow(r), close: closeFromRow(r) }))
    .filter((r) => r.date && r.close != null)
    .slice(-120);

  if (list.length < 2) return null;

  const closes = list.map((r) => r.close as number);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const pad = 8;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = list
    .map((r, i) => {
      const x = pad + (i / (list.length - 1)) * innerW;
      const y = pad + innerH - (((r.close as number) - min) / range) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <figure className="ssr-sparkline">
      {caption ? <figcaption className="mb-2 text-sm font-semibold">{caption}</figcaption> : null}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={caption || 'Price sparkline'}
        className="max-w-full"
      >
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
    </figure>
  );
}
