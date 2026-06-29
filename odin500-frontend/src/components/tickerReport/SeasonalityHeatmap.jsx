'use client';
import { valueToneClassName } from '../../utils/tickerReportValueTone.js';

function cellTone(v) {
  if (v == null) return 'ticker-report__heat--empty';
  if (v >= 8) return 'ticker-report__heat--pos-strong';
  if (v >= 2) return 'ticker-report__heat--pos';
  if (v >= 0) return 'ticker-report__heat--pos-soft';
  if (v >= -3) return 'ticker-report__heat--neg-soft';
  return 'ticker-report__heat--neg';
}

/**
 * @param {{ seasonality: { years: number[], months: string[], cells: Record<string, (number|null)[]>, averages: number[] } }} props
 */
export function SeasonalityHeatmap({ seasonality }) {
  const { years, months, cells, averages } = seasonality;
  return (
    <div className="ticker-report__heatmap-wrap">
      <table className="ticker-report__heatmap">
        <thead>
          <tr>
            <th>Year</th>
            {months.map((m) => (
              <th key={m}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <th>{y}</th>
              {(cells[String(y)] || []).map((v, idx) => (
                <td key={`${y}-${idx}`} className={cellTone(v)}>
                  {v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th className="ticker-report__heat-avg">3Y Avg</th>
            {averages.map((v, idx) => (
              <td
                key={`avg-${idx}`}
                className={`ticker-report__heat-avg ${valueToneClassName(v > 0 ? 'pos' : v < 0 ? 'neg' : '', v)}`}
              >
                {v > 0 ? '+' : ''}
                {v}%
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
