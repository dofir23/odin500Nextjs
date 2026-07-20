'use client';

import { useMemo, useState } from 'react';
import { Link, useParams } from '@/navigation/appRouterCompat.jsx';
import { PaperLoginGate } from '../../components/paper/PaperLoginGate.jsx';
import { usePublicPortfolio } from '../../hooks/usePublicPortfolios.js';
import { AccountSummary } from '../../components/paper/AccountSummary.jsx';
import { PaperPerformanceChart } from '../../components/paper/PaperPerformanceChart.jsx';
import { PortfolioInsightsPanel } from '../../components/paper/PortfolioInsightsPanel.jsx';
import { PositionsTable } from '../../components/paper/PositionsTable.jsx';
import { OrdersTable } from '../../components/paper/OrdersTable.jsx';
import { ClosedTradesTable } from '../../components/paper/ClosedTradesTable.jsx';
import { ClosedTradesAnalytics } from '../../components/paper/ClosedTradesAnalytics.jsx';
import { PortfolioInsightsTab } from '../../components/paper/PortfolioInsightsTab.jsx';
import { StrategyPanel } from '../../components/paper/StrategyPanel.jsx';
import '../../styles/paper-trading.css';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function PublicPortfolioDetailPage() {
  const params = useParams();
  const accountId = String(params?.accountId || '').trim();
  const returnTo = accountId
    ? `/paper-trading/public/${encodeURIComponent(accountId)}`
    : '/paper-trading/public';

  return (
    <PaperLoginGate returnTo="/paper-trading/public">
      <PublicPortfolioDetailContent />
    </PaperLoginGate>
  );
}

function PublicPortfolioDetailContent({ accountId: accountIdProp }) {
  const params = useParams();
  const accountId = accountIdProp || String(params?.accountId || '').trim();
  const [tab, setTab] = useState('positions');
  const {
    portfolio,
    history,
    closedTrades,
    closedTotals,
    sectors,
    sectorEquity,
    orders,
    strategy,
    binding,
    rules,
    executionLog,
    strategyActive,
    pendingCount,
    loading,
    error
  } = usePublicPortfolio(accountId);

  const positions = portfolio?.positions || [];
  const isAutomated = portfolio?.strategy_mode && portfolio.strategy_mode !== 'manual';
  const description = String(portfolio?.publish_description || '').trim();
  const strategyText = String(portfolio?.publish_strategy || '').trim();
  const strategyLabel = String(portfolio?.strategy_label || '').trim();
  const showStrategyTab = Boolean(strategy) || tab === 'strategy';

  const portfolioSummary = useMemo(() => {
    if (!portfolio) return [];
    return [
      {
        id: portfolio.id,
        name: portfolio.name,
        equity: portfolio.equity,
        total_return: portfolio.total_return,
        total_return_pct: portfolio.total_return_pct,
        unrealized_pnl_total: portfolio.unrealized_pnl_total,
        realized_pnl_total: portfolio.realized_pnl_total,
        positions_count: portfolio.positions_count,
        is_automated: isAutomated
      }
    ];
  }, [portfolio, isAutomated]);

  const compareHistory = useMemo(() => {
    if (!portfolio) return [];
    return [
      {
        account_id: portfolio.id,
        name: portfolio.name,
        history
      }
    ];
  }, [portfolio, history]);

  const ownerLine = useMemo(() => {
    if (!portfolio) return '';
    const parts = [portfolio.name];
    if (portfolio.owner_label) parts.push(`by ${portfolio.owner_label}`);
    return parts.join(' · ');
  }, [portfolio]);

  if (!accountId) {
    return (
      <div className="paper-page odin-content-page paper-page--public">
        <div className="paper-alert paper-alert--error">Invalid portfolio link.</div>
      </div>
    );
  }

  return (
    <div className="paper-page odin-content-page paper-page--public">
      <header className="paper-header">
        <div>
          <p className="paper-header__eyebrow">
            <Link to="/paper-trading/public" className="paper-link">
              Public Portfolios
            </Link>
          </p>
          <div className="paper-header__title-row">
            <h1 className="paper-header__title">{portfolio?.name || 'Portfolio'}</h1>
            {portfolio ? (
              <span className="paper-header__view-only-chip" aria-label="View only portfolio">
                View only
              </span>
            ) : null}
          </div>
          {portfolio ? (
            <p className="paper-header__sub">
              {ownerLine}
              {portfolio.published_at ? ` · Published ${fmtDate(portfolio.published_at)}` : ''}
              {isAutomated ? ' · Automated strategy' : ''}
            </p>
          ) : (
            <p className="paper-header__sub">Loading published portfolio…</p>
          )}
        </div>
        <div className="paper-header__actions">
          <Link to="/paper-trading/public" className="paper-btn paper-btn--ghost">
            All public portfolios
          </Link>
          <Link to="/paper-trading" className="paper-btn paper-btn--ghost">
            Your Portfolio
          </Link>
        </div>
      </header>

      {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

      {portfolio && (description || strategyText || strategyLabel) ? (
        <section className="paper-public-about" aria-label="Portfolio overview">
          {description ? (
            <div className="paper-public-about__block">
              <h2 className="paper-public-about__title">About this portfolio</h2>
              <p className="paper-public-about__text">{description}</p>
            </div>
          ) : null}
          {strategyText || strategyLabel ? (
            <div className="paper-public-about__block">
              <h2 className="paper-public-about__title">Strategy</h2>
              {strategyLabel ? (
                <p className="paper-public-about__tag">
                  {strategyLabel}
                  {isAutomated ? ' · Automated' : ''}
                </p>
              ) : null}
              {strategyText ? <p className="paper-public-about__text">{strategyText}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <AccountSummary account={portfolio} loading={loading} />

      <div className="paper-layout paper-layout--view-only">
        <div className="paper-layout__main">
          <PaperPerformanceChart history={history} loading={loading} />
          <PortfolioInsightsPanel
            account={portfolio}
            positions={positions}
            pendingCount={pendingCount}
            closedTradesCount={closedTrades.length}
            strategyActive={strategyActive}
            showStrategyTab={showStrategyTab}
            loading={loading}
            sectors={sectors}
            sectorEquity={sectorEquity}
            sectorsLoading={loading}
            readOnly
          />
        </div>
      </div>

      <section className="paper-card paper-blotter">
        <div className="paper-card__head paper-card__head--tabs">
          <div className="paper-blotter-tabs-row">
            <div className="paper-tabs paper-tabs--scroll" role="tablist" aria-label="Holdings and orders">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'positions'}
                className={'paper-tabs__btn' + (tab === 'positions' ? ' paper-tabs__btn--active' : '')}
                onClick={() => setTab('positions')}
              >
                Positions
                <span className="paper-tabs__count">{positions.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'orders'}
                className={'paper-tabs__btn' + (tab === 'orders' ? ' paper-tabs__btn--active' : '')}
                onClick={() => setTab('orders')}
              >
                Orders
                <span className="paper-tabs__count">{orders.length}</span>
                {pendingCount > 0 ? (
                  <span className="paper-tabs__count paper-tabs__pending">({pendingCount} pending)</span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'closed'}
                className={'paper-tabs__btn' + (tab === 'closed' ? ' paper-tabs__btn--active' : '')}
                onClick={() => setTab('closed')}
              >
                Closed trades
                <span className="paper-tabs__count">{closedTrades.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'insights'}
                className={'paper-tabs__btn' + (tab === 'insights' ? ' paper-tabs__btn--active' : '')}
                onClick={() => setTab('insights')}
                title="Sector allocation and equity history"
              >
                Insights
              </button>
              {showStrategyTab ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'strategy'}
                  className={'paper-tabs__btn' + (tab === 'strategy' ? ' paper-tabs__btn--active' : '')}
                  onClick={() => setTab('strategy')}
                >
                  Strategy
                  {strategyActive ? (
                    <span className="wl-flyout__select-item-tag wl-flyout__select-item-tag--auto paper-tabs__auto-tag">
                      Auto
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="paper-card__body">
          {tab === 'strategy' ? (
            <StrategyPanel
              strategy={strategy}
              binding={binding}
              rules={rules}
              executionLog={executionLog}
              strategyActive={strategyActive}
              loading={loading}
              readOnly
            />
          ) : tab === 'positions' ? (
            <PositionsTable positions={positions} loading={loading} readOnly />
          ) : tab === 'closed' ? (
            <>
              <ClosedTradesAnalytics trades={closedTrades} loading={loading} />
              <ClosedTradesTable trades={closedTrades} totals={closedTotals} loading={loading} />
            </>
          ) : tab === 'insights' ? (
            <PortfolioInsightsTab
              summaries={portfolioSummary}
              compareHistory={compareHistory}
              sectors={sectors}
              sectorEquity={sectorEquity}
              loading={loading}
              activeAccountId={portfolio?.id || ''}
              activeAccountName={portfolio?.name || ''}
              readOnly
            />
          ) : (
            <OrdersTable orders={orders} loading={loading} readOnly />
          )}
        </div>
      </section>
    </div>
  );
}
