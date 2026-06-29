'use client';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';
import { PortfolioCompareChart } from './PortfolioCompareChart.jsx';
import { SectorAllocationSection } from './SectorAllocationSection.jsx';
import { exportAccountsSummaryCsv } from '../../utils/paperPortfolioExport.js';

function money(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number(v)
  );
}

function toneClass(v) {
  if (Number(v) > 0) return 'paper-tone-up';
  if (Number(v) < 0) return 'paper-tone-down';
  return '';
}

/**
 * @param {{
 *   summaries: object[],
 *   compareHistory: object[],
 *   sectors: object[],
 *   sectorEquity: number,
 *   loading?: boolean,
 *   error?: string,
 *   activeAccountId?: string,
 *   activeAccountName?: string,
 *   onSelectAccount?: (id: string) => void,
 *   onExportPositions?: () => void,
 *   onExportClosedTrades?: () => void
 * }} props
 */
export function PortfolioInsightsTab({
  summaries = [],
  compareHistory = [],
  sectors = [],
  sectorEquity = 0,
  loading = false,
  error = '',
  activeAccountId = '',
  activeAccountName = '',
  onSelectAccount,
  onExportPositions,
  onExportClosedTrades
}) {
  const multiAccount = summaries.length > 1;

  return (
    <div className="paper-insights-tab">
      <div className="paper-help-banner" role="note">
        <p className="paper-help-banner__title">What is this page?</p>
        <p>
          Review how your paper portfolios are doing, compare them side by side, and see which sectors you are
          invested in. Numbers update from your simulated trades — nothing here uses real money.
        </p>
      </div>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      <section className="paper-insights-tab__section" aria-labelledby="paper-compare-table-title">
        <div className="paper-insights-tab__section-head">
          <h3 id="paper-compare-table-title" className="paper-insights-tab__h">
            All your portfolios
          </h3>
          <p className="paper-insights-tab__sub">
            {multiAccount
              ? 'Tap a row to switch the active account for trading. Use Export to save this table as a spreadsheet.'
              : 'Create a second account (New account above) to compare strategies side by side.'}
          </p>
          {summaries.length > 0 ? (
            <button
              type="button"
              className="paper-btn paper-btn--ghost paper-insights-tab__export"
              onClick={() => exportAccountsSummaryCsv(summaries)}
              title="Download comparison table as CSV"
            >
              Export comparison
            </button>
          ) : null}
        </div>

        {loading && !summaries.length ? (
          <div className="paper-skeleton" style={{ minHeight: '8rem' }} aria-busy="true" />
        ) : (
          <div className="paper-table-wrap">
            <table className="paper-table paper-table--compare">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Value</th>
                  <th>Total return</th>
                  <th>Open P&amp;L</th>
                  <th>Closed P&amp;L</th>
                  <th>Positions</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((row) => {
                  const active = row.id === activeAccountId;
                  return (
                    <tr
                      key={row.id}
                      className={active ? 'paper-table__row--active' : ''}
                      onClick={() => onSelectAccount?.(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectAccount?.(row.id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Switch to ${row.name}`}
                      title="Click to use this account for trading"
                    >
                      <td>
                        <span className="paper-table__sym">{row.name}</span>
                        {row.is_automated ? (
                          <span className="wl-flyout__select-item-tag wl-flyout__select-item-tag--auto paper-tabs__auto-tag">
                            Auto
                          </span>
                        ) : null}
                        {active ? <span className="paper-compare-active-tag">Active</span> : null}
                      </td>
                      <td>{money(row.equity)}</td>
                      <td className={toneClass(row.total_return)}>
                        {money(row.total_return)}
                        <span className="paper-table__sub">
                          {fmtPctSigned(row.total_return_pct, { decimals: 2 })}
                        </span>
                      </td>
                      <td className={toneClass(row.unrealized_pnl_total)}>{money(row.unrealized_pnl_total)}</td>
                      <td className={toneClass(row.realized_pnl_total)}>{money(row.realized_pnl_total)}</td>
                      <td>{row.positions_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PortfolioCompareChart accounts={compareHistory} allAccounts={summaries} loading={loading} />

      <SectorAllocationSection
        sectors={sectors}
        equity={sectorEquity}
        loading={loading}
        accountName={activeAccountName}
      />

      <section className="paper-insights-tab__section" aria-labelledby="paper-export-title">
        <h3 id="paper-export-title" className="paper-insights-tab__h">
          Download your data
        </h3>
        <p className="paper-insights-tab__sub">
          Save a copy of your current holdings or closed trades for <strong>{activeAccountName || 'this account'}</strong>{' '}
          to open in Excel or Google Sheets.
        </p>
        <div className="paper-export-actions">
          <button type="button" className="paper-btn" onClick={onExportPositions}>
            Download positions (CSV)
          </button>
          <button type="button" className="paper-btn paper-btn--ghost" onClick={onExportClosedTrades}>
            Download closed trades (CSV)
          </button>
        </div>
      </section>
    </div>
  );
}
