'use client';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number(v)
  );
}

const SECTOR_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
  '#ef4444'
];

/**
 * @param {{
 *   sectors: Array<{ sector: string, market_value: number, weight_pct: number, tickers?: string[] }>,
 *   equity?: number,
 *   loading?: boolean,
 *   accountName?: string
 * }} props
 */
export function SectorAllocationSection({ sectors = [], equity = 0, loading = false, accountName = '' }) {
  if (loading) {
    return (
      <div className="paper-card paper-sector-card" aria-busy="true">
        <div className="paper-card__body">
          <div className="paper-skeleton" style={{ minHeight: '10rem' }} />
        </div>
      </div>
    );
  }

  if (!sectors.length) {
    return (
      <div className="paper-card paper-sector-card">
        <div className="paper-card__head">
          <h2 className="paper-card__title">Sector breakdown</h2>
        </div>
        <div className="paper-card__body">
          <p className="paper-chart-empty">
            {accountName ? (
              <>
                <strong>{accountName}</strong> has no stock holdings yet. Sector mix appears once you own shares in
                different industries.
              </>
            ) : (
              'Sector mix appears once you hold shares across different industries.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-card paper-sector-card">
      <div className="paper-card__head">
        <div>
          <h2 className="paper-card__title">Sector breakdown</h2>
          <p className="paper-chart-card__hint">
            How your {accountName ? `${accountName} ` : ''}portfolio is spread across market sectors (based on
            current holdings).
          </p>
        </div>
      </div>
      <div className="paper-card__body">
        <div className="paper-sector-bar" role="img" aria-label="Sector allocation bar">
          {sectors.map((row, i) => (
            <span
              key={row.sector}
              className="paper-sector-bar__seg"
              style={{
                width: `${Math.max(0, Math.min(100, row.weight_pct))}%`,
                background: SECTOR_COLORS[i % SECTOR_COLORS.length]
              }}
              title={`${row.sector}: ${row.weight_pct}%`}
            />
          ))}
        </div>
        <ul className="paper-sector-list">
          {sectors.map((row, i) => (
            <li key={row.sector} className="paper-sector-list__row">
              <span
                className="paper-sector-list__dot"
                style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                aria-hidden
              />
              <span className="paper-sector-list__name">{row.sector}</span>
              <span className="paper-sector-list__pct">{fmtPctSigned(row.weight_pct, { decimals: 1 })}</span>
              <span className="paper-sector-list__val">{money(row.market_value)}</span>
            </li>
          ))}
        </ul>
        {equity > 0 ? (
          <p className="paper-sector-foot">Total invested exposure: {money(equity)} portfolio value.</p>
        ) : null}
      </div>
    </div>
  );
}
