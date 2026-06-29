/** Server-rendered SVG bar chart for return series. */

type BarPoint = { label: string; value: number };

type SvgBarChartProps = {
  points: BarPoint[];
  width?: number;
  height?: number;
  caption?: string;
  positiveColor?: string;
  negativeColor?: string;
};

export function SvgBarChart({
  points,
  width = 640,
  height = 160,
  caption,
  positiveColor = '#22c55e',
  negativeColor = '#ef4444'
}: SvgBarChartProps) {
  const list = points.filter((p) => Number.isFinite(p.value)).slice(-24);
  if (!list.length) return null;

  const maxAbs = Math.max(...list.map((p) => Math.abs(p.value)), 0.01);
  const pad = 12;
  const barGap = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2 - 20;
  const barW = Math.max(4, (innerW - barGap * (list.length - 1)) / list.length);
  const midY = pad + innerH / 2;

  return (
    <figure className="ssr-bar-chart">
      {caption ? <figcaption className="mb-2 text-sm font-semibold">{caption}</figcaption> : null}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={caption || 'Returns bar chart'}
        className="max-w-full"
      >
        <line x1={pad} y1={midY} x2={width - pad} y2={midY} stroke="#334155" strokeWidth="1" />
        {list.map((p, i) => {
          const h = (Math.abs(p.value) / maxAbs) * (innerH / 2);
          const x = pad + i * (barW + barGap);
          const y = p.value >= 0 ? midY - h : midY;
          const fill = p.value >= 0 ? positiveColor : negativeColor;
          return (
            <g key={`${p.label}-${i}`}>
              <rect x={x} y={y} width={barW} height={Math.max(1, h)} fill={fill} rx="1" />
              <title>{`${p.label}: ${p.value.toFixed(2)}%`}</title>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
