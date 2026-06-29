'use client';

/**
 * In-chart loader for lightweight-charts hosts (line/area/OHLC).
 * Spinner stays inside the plot area — no line/area skeleton shimmer.
 */
export default function TradingChartLoader({
  label = 'Loading chart data…',
  sublabel = 'Fetching quotes & constituents',
  className = '',
  minHeight = 360
}) {
  const h = Math.max(200, Number(minHeight) || 360);
  return (
    <div
      className={`trading-chart-loader ${className}`.trim()}
      style={{ minHeight: h }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="trading-chart-loader__chart" style={{ minHeight: h }}>
        <div className="trading-chart-loader__center">
          <div className="trading-chart-loader__spinner" aria-hidden />
          <p className="trading-chart-loader__title">{label}</p>
          {sublabel ? <p className="trading-chart-loader__sub">{sublabel}</p> : null}
        </div>
      </div>
    </div>
  );
}
