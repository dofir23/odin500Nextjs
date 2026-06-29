'use client';
import { fmtPctSigned } from '../../utils/formatDisplayNumber.js';

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

function positionCostBasis(p) {
  const netQty = Number(p.net_qty) || 0;
  if (netQty > 0 && p.avg_long_cost != null) return Number(p.avg_long_cost);
  if (netQty < 0 && p.avg_short_cost != null) return Number(p.avg_short_cost);
  if (Number(p.long_qty) > 0 && !Number(p.short_qty) && p.avg_long_cost != null) return Number(p.avg_long_cost);
  if (Number(p.short_qty) > 0 && !Number(p.long_qty) && p.avg_short_cost != null) return Number(p.avg_short_cost);
  return null;
}

function positionUnrealizedPct(p) {
  if (p.unrealized_pnl_pct != null && Number.isFinite(Number(p.unrealized_pnl_pct))) {
    return Number(p.unrealized_pnl_pct);
  }
  const cost = positionCostBasis(p);
  const price = Number(p.current_price);
  if (cost == null || !Number.isFinite(price) || cost <= 0) return null;
  const netQty = Number(p.net_qty) || 0;
  if (netQty > 0) return ((price - cost) / cost) * 100;
  if (netQty < 0) return ((cost - price) / cost) * 100;
  return null;
}

function allocationRows(positions, equity) {
  const base = Number(equity) > 0 ? Number(equity) : 0;
  return (positions || [])
    .map((p) => {
      const mv = Math.abs(Number(p.market_value) || 0);
      const pct = base > 0 ? (mv / base) * 100 : 0;
      return { ticker: p.ticker, mv, pct, unrealized: Number(p.unrealized_pnl) || 0 };
    })
    .filter((r) => r.mv > 0)
    .sort((a, b) => b.mv - a.mv)
    .slice(0, 5);
}

/**
 * @param {{
 *   account: object | null,
 *   positions: object[],
 *   pendingCount: number,
 *   closedTradesCount: number,
 *   strategyActive: boolean,
 *   showStrategyTab: boolean,
 *   loading?: boolean,
 *   onSetupStrategy?: () => void,
 *   sectors?: Array<{ sector: string, weight_pct: number, market_value: number }>,
 *   sectorEquity?: number,
 *   sectorsLoading?: boolean
 * }} props
 */
export function PortfolioInsightsPanel({
  account,
  positions,
  pendingCount,
  closedTradesCount,
  strategyActive,
  showStrategyTab,
  loading = false,
  onSetupStrategy,
  sectors = [],
  sectorEquity = 0,
  sectorsLoading = false
}) {
  const equity = Number(account?.equity) || 0;
  const cash = Number(account?.cash_balance) || 0;
  const openList = positions || [];
  const longExposure = openList.reduce((s, p) => s + Math.max(0, Number(p.long_market_value) || 0), 0);
  const shortExposure = openList.reduce((s, p) => s + Math.max(0, Number(p.short_market_value) || 0), 0);
  const invested = longExposure + shortExposure;
  const cashPct = equity > 0 ? (cash / equity) * 100 : 0;
  const investedPct = equity > 0 ? (invested / equity) * 100 : 0;

  const allocation = allocationRows(openList, equity);

  const ranked = [...openList]
    .map((p) => ({ ...p, pct: positionUnrealizedPct(p) }))
    .filter((p) => p.unrealized_pnl != null && Number.isFinite(Number(p.unrealized_pnl)))
    .sort((a, b) => Number(b.unrealized_pnl) - Number(a.unrealized_pnl));
  const topGainer = ranked.find((p) => Number(p.unrealized_pnl) > 0) || null;
  const topLoser = [...ranked].reverse().find((p) => Number(p.unrealized_pnl) < 0) || null;

  if (loading && !account) {
    return (
      <div className="paper-card paper-insights" aria-busy="true">
        <div className="paper-card__body">
          <div className="paper-skeleton" style={{ minHeight: '12rem' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="paper-card paper-insights">
      <div className="paper-card__head">
        <h2 className="paper-card__title">Portfolio snapshot</h2>
      </div>
      <div className="paper-card__body paper-insights__body">
        {openList.length === 0 ? (
          <div className="paper-insights__empty">
            <p className="paper-insights__empty-title">No holdings yet</p>
            <p className="paper-insights__empty-copy">
              Use the order ticket to place simulated trades. Positions, P&amp;L, and allocation will show here once
              you are invested.
            </p>
            <ul className="paper-insights__tips">
              <li>Market orders fill at the latest Odin daily close.</li>
              <li>Track equity in the chart above as snapshots are recorded.</li>
              {!showStrategyTab && onSetupStrategy ? (
                <li>
                  <button type="button" className="paper-link-btn" onClick={onSetupStrategy}>
                    Set up automation
                  </button>{' '}
                  to run rules on a strategy account.
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <>
            <div className="paper-insights__exposure" aria-label="Portfolio exposure">
              <div className="paper-insights__exposure-bar" role="presentation">
                <span
                  className="paper-insights__exposure-seg paper-insights__exposure-seg--long"
                  style={{ width: `${equity > 0 ? (longExposure / equity) * 100 : 0}%` }}
                  title={`Long exposure ${money(longExposure)}`}
                />
                <span
                  className="paper-insights__exposure-seg paper-insights__exposure-seg--short"
                  style={{ width: `${equity > 0 ? (shortExposure / equity) * 100 : 0}%` }}
                  title={`Short exposure ${money(shortExposure)}`}
                />
                <span
                  className="paper-insights__exposure-seg paper-insights__exposure-seg--cash"
                  style={{ width: `${Math.max(0, cashPct)}%` }}
                  title={`Cash ${money(cash)}`}
                />
              </div>
              <div className="paper-insights__exposure-legend">
                <span>Long {fmtPctSigned(investedPct > 0 ? (longExposure / equity) * 100 : 0, { decimals: 1 })}</span>
                <span>Short {fmtPctSigned(equity > 0 ? (shortExposure / equity) * 100 : 0, { decimals: 1 })}</span>
                <span>Cash {fmtPctSigned(cashPct, { decimals: 1 })}</span>
              </div>
            </div>

            {sectorsLoading ? (
              <div className="paper-insights__block">
                <div className="paper-skeleton" style={{ minHeight: '4rem' }} aria-busy="true" />
              </div>
            ) : sectors.length ? (
              <div className="paper-insights__block">
                <h3 className="paper-insights__h">By sector</h3>
                <p className="paper-insights__sector-hint">How your money is spread across industries.</p>
                <ul className="paper-insights__alloc paper-insights__alloc--sector">
                  {sectors.slice(0, 5).map((row) => (
                    <li key={row.sector} className="paper-insights__alloc-row">
                      <span className="paper-insights__alloc-sym" title={row.sector}>
                        {row.sector}
                      </span>
                      <span className="paper-insights__alloc-bar-wrap">
                        <span
                          className="paper-insights__alloc-bar"
                          style={{ width: `${Math.min(100, row.weight_pct)}%` }}
                        />
                      </span>
                      <span className="paper-insights__alloc-pct">{row.weight_pct.toFixed(1)}%</span>
                      <span className="paper-insights__alloc-pnl">{money(row.market_value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {allocation.length ? (
              <div className="paper-insights__block">
                <h3 className="paper-insights__h">Top holdings</h3>
                <ul className="paper-insights__alloc">
                  {allocation.map((row) => (
                    <li key={row.ticker} className="paper-insights__alloc-row">
                      <span className="paper-insights__alloc-sym">{row.ticker}</span>
                      <span className="paper-insights__alloc-bar-wrap">
                        <span
                          className="paper-insights__alloc-bar"
                          style={{ width: `${Math.min(100, row.pct)}%` }}
                        />
                      </span>
                      <span className="paper-insights__alloc-pct">{row.pct.toFixed(1)}%</span>
                      <span className={'paper-insights__alloc-pnl ' + toneClass(row.unrealized)}>
                        {money(row.unrealized)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="paper-insights__block paper-insights__movers">
              {topGainer && Number(topGainer.unrealized_pnl) > 0 ? (
                <div className="paper-insights__mover">
                  <span className="paper-insights__mover-label">Top gainer</span>
                  <strong className={'paper-insights__mover-val ' + toneClass(topGainer.unrealized_pnl)}>
                    {topGainer.ticker} {money(topGainer.unrealized_pnl)}
                    {topGainer.pct != null ? ` (${fmtPctSigned(topGainer.pct)})` : ''}
                  </strong>
                </div>
              ) : null}
              {topLoser && Number(topLoser.unrealized_pnl) < 0 ? (
                <div className="paper-insights__mover">
                  <span className="paper-insights__mover-label">Top loser</span>
                  <strong className={'paper-insights__mover-val ' + toneClass(topLoser.unrealized_pnl)}>
                    {topLoser.ticker} {money(topLoser.unrealized_pnl)}
                    {topLoser.pct != null ? ` (${fmtPctSigned(topLoser.pct)})` : ''}
                  </strong>
                </div>
              ) : null}
            </div>
          </>
        )}

        <dl className="paper-insights__facts">
          <div>
            <dt>Open positions</dt>
            <dd>{openList.length}</dd>
          </div>
          <div>
            <dt>Pending orders</dt>
            <dd>{pendingCount}</dd>
          </div>
          <div>
            <dt>Closed trades</dt>
            <dd>{closedTradesCount}</dd>
          </div>
          <div>
            <dt>Automation</dt>
            <dd>{strategyActive ? 'Active' : showStrategyTab ? 'Paused' : 'Not configured'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
