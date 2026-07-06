'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { Loader2, RotateCcw, Trash2, Globe, GlobeLock } from 'lucide-react';
import { PaperAccountCreateMenu } from '../../components/paper/PaperAccountCreateMenu.jsx';
import { apiUrl } from '../../utils/apiOrigin.js';
import { fetchWithAuth } from '../../store/apiStore.js';
import { useLoginGateOptional } from '../../context/LoginGateContext.jsx';
import { useIsLoggedIn } from '../../hooks/useIsLoggedIn.js';
import { usePaperAccount } from '../../hooks/usePaperAccount.js';
import { usePaperPositions } from '../../hooks/usePaperPositions.js';
import { usePaperOrders } from '../../hooks/usePaperOrders.js';
import { usePaperClosedTrades } from '../../hooks/usePaperClosedTrades.js';
import { AccountSummary } from '../../components/paper/AccountSummary.jsx';
import { OrderTicket } from '../../components/paper/OrderTicket.jsx';
import { PositionsTable } from '../../components/paper/PositionsTable.jsx';
import { OrdersTable } from '../../components/paper/OrdersTable.jsx';
import { ClosedTradesTable } from '../../components/paper/ClosedTradesTable.jsx';
import { PaperPerformanceChart } from '../../components/paper/PaperPerformanceChart.jsx';
import { PortfolioInsightsPanel } from '../../components/paper/PortfolioInsightsPanel.jsx';
import { PortfolioInsightsTab } from '../../components/paper/PortfolioInsightsTab.jsx';
import { ClosedTradesAnalytics } from '../../components/paper/ClosedTradesAnalytics.jsx';
import { usePaperPortfolioAnalytics } from '../../hooks/usePaperPortfolioAnalytics.js';
import { exportClosedTradesCsv, exportPositionsCsv } from '../../utils/paperPortfolioExport.js';
import { ThemedDropdown } from '../../components/ThemedDropdown.jsx';
import { PaperManageModal } from '../../components/paper/PaperManageModal.jsx';
import { StrategyPanel } from '../../components/paper/StrategyPanel.jsx';
import { StrategyAccountWizard } from '../../components/paper/StrategyAccountWizard.jsx';
import { usePaperStrategy } from '../../hooks/usePaperStrategy.js';
import { useProductTourContext } from '../../context/ProductTourContext.jsx';
import { clearTourProgress, TOUR_IDS } from '../../engagement/tourStorage.js';
import { readPaperTradingSearchParams } from '../../utils/paperTradingUrl.js';
import { shouldIgnoreRouteLoadError, useRouteNavigationDeps } from '../../hooks/useRouteLoadGuard.js';
import { DataInfoTip } from '../../components/DataInfoTip.jsx';
import '../../styles/paper-trading.css';

function PaperTradingPageContent() {
  const {
    account,
    accounts,
    activeAccountId,
    setActiveAccountId,
    loading: accountLoading,
    error: accountError,
    refetch: refetchAccount,
    resetPortfolio,
    createAccount,
    deleteAccount,
    setPublished
  } = usePaperAccount();
  const { positions, loading: positionsLoading, refetch: refetchPositions } = usePaperPositions({
    accountId: activeAccountId
  });
  const { orders, loading: ordersLoading, placeOrder, cancelOrder, modifyOrder, refetch: refetchOrders } = usePaperOrders({
    accountId: activeAccountId
  });
  const { trades: closedTrades, totals: closedTotals, loading: closedLoading, refetch: refetchClosed } =
    usePaperClosedTrades({ accountId: activeAccountId });
  const {
    strategy,
    binding,
    rules,
    executionLog,
    strategyActive,
    automatedAccountIds,
    loading: strategyLoading,
    error: strategyError,
    refetch: refetchStrategy,
    createStrategy,
    addRule,
    updateRule,
    deleteRule,
    bindStrategy,
    patchBinding,
    patchStrategy,
    runOnce
  } = usePaperStrategy(activeAccountId);
  const [initialUrl] = useState(() => readPaperTradingSearchParams());
  const { pathname, navEpoch } = useRouteNavigationDeps();
  const [tab, setTab] = useState(() => initialUrl.tab);
  const initialTicker = initialUrl.ticker;
  const [wizardOpen, setWizardOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [modal, setModal] = useState(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishDescription, setPublishDescription] = useState('');
  const [publishStrategy, setPublishStrategy] = useState('');
  const { startPaperStrategyManageTour, registerManageTourPrepare } = useProductTourContext();
  const {
    summaries: portfolioSummaries,
    compareHistory,
    sectors,
    sectorEquity,
    loading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics
  } = usePaperPortfolioAnalytics({ accountId: activeAccountId, enabled: true });

  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'pending').length, [orders]);

  const accountOptions = useMemo(
    () =>
      (accounts || []).map((a) => {
        const base = String(a.name || 'Account').trim() || 'Account';
        const auto = automatedAccountIds.has(a.id);
        const published = Boolean(a.is_published);
        let label = base;
        if (auto && published) label = `${base} · auto · public`;
        else if (auto) label = `${base} · auto`;
        else if (published) label = `${base} · public`;
        return auto
          ? { id: a.id, label, tag: 'auto' }
          : published
            ? { id: a.id, label, tag: 'published' }
            : { id: a.id, label };
      }),
    [accounts, automatedAccountIds]
  );

  const showStrategyTab = !!strategy || tab === 'strategy';

  const selectedAccountId = activeAccountId || accountOptions[0]?.id || '';

  const selectedAccountMeta = useMemo(
    () => (accounts || []).find((a) => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  const isSelectedPublished = Boolean(
    selectedAccountMeta?.is_published ?? account?.is_published
  );

  const selectedAccountLabel =
    accountOptions.find((o) => o.id === selectedAccountId)?.label || account?.name || 'this account';

  function closeModal() {
    setModal(null);
    setModalError('');
    setNewAccountName('');
    setModalBusy(false);
  }

  function openCreateModal() {
    setModalError('');
    setNewAccountName('');
    setModal('create');
  }

  function openResetModal() {
    setModalError('');
    setModal('reset');
  }

  function openDeleteModal() {
    setModalError('');
    setModal('delete');
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const endpoint = activeAccountId
        ? `/api/paper/portfolio/history?account_id=${encodeURIComponent(activeAccountId)}`
        : '/api/paper/portfolio/history';
      const res = await fetchWithAuth(apiUrl(endpoint), { method: 'GET' });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) setHistory(payload.history || []);
    } catch (err) {
      if (!shouldIgnoreRouteLoadError(err)) setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [activeAccountId]);

  const goToTab = useCallback((nextTab) => {
    setTab(nextTab);
  }, []);

  useEffect(() => {
    registerManageTourPrepare(() => {
      goToTab('strategy');
      window.requestAnimationFrame(() => {
        document
          .querySelector('[data-tour="paper-strategy-panel-intro"]')
          ?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    });
  }, [registerManageTourPrepare, goToTab]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, pathname, navEpoch]);

  const handleOrderPlaced = useCallback(async () => {
    await Promise.all([refetchAccount(), refetchPositions(), refetchClosed(), loadHistory(), refetchAnalytics()]);
  }, [refetchAccount, refetchPositions, refetchClosed, loadHistory, refetchAnalytics]);

  const handlePlaceOrder = useCallback(
    async (input) => {
      const result = await placeOrder(input);
      await handleOrderPlaced();
      return result;
    },
    [placeOrder, handleOrderPlaced]
  );

  async function submitCreateAccount() {
    const name = newAccountName.trim();
    if (!name) {
      setModalError('Enter an account name');
      return;
    }
    setModalBusy(true);
    setModalError('');
    try {
      await createAccount({ name });
      closeModal();
    } catch (err) {
      setModalError(err?.message || 'Failed to create account');
    } finally {
      setModalBusy(false);
    }
  }

  async function submitResetPortfolio() {
    setResetting(true);
    setModalBusy(true);
    setModalError('');
    try {
      await resetPortfolio();
      closeModal();
      await Promise.all([
        refetchAccount(),
        refetchPositions(),
        refetchOrders(),
        refetchClosed(),
        loadHistory(),
        refetchAnalytics(),
        refetchStrategy()
      ]);
    } catch (err) {
      setModalError(err?.message || 'Failed to reset portfolio');
    } finally {
      setResetting(false);
      setModalBusy(false);
    }
  }

  function openPublishModal() {
    setModalError('');
    setPublishDescription(String(selectedAccountMeta?.publish_description || '').trim());
    setPublishStrategy(String(selectedAccountMeta?.publish_strategy || '').trim());
    setModal(isSelectedPublished ? 'edit-publish' : 'publish');
  }

  async function submitPublishPortfolio() {
    if (!selectedAccountId) return;
    setPublishing(true);
    setModalBusy(true);
    setModalError('');
    try {
      await setPublished(selectedAccountId, true, {
        publishDescription: publishDescription.trim(),
        publishStrategy: publishStrategy.trim()
      });
      closeModal();
    } catch (err) {
      setModalError(err?.message || 'Failed to publish portfolio');
    } finally {
      setPublishing(false);
      setModalBusy(false);
    }
  }

  async function submitUnpublishPortfolio() {
    if (!selectedAccountId) return;
    setPublishing(true);
    setModalBusy(true);
    setModalError('');
    try {
      await setPublished(selectedAccountId, false);
      closeModal();
    } catch (err) {
      setModalError(err?.message || 'Failed to unpublish portfolio');
    } finally {
      setPublishing(false);
      setModalBusy(false);
    }
  }

  async function submitDeleteAccount() {
    if (!selectedAccountId) return;
    setDeletingAccount(true);
    setModalBusy(true);
    setModalError('');
    try {
      await deleteAccount(selectedAccountId);
      closeModal();
    } catch (err) {
      setModalError(err?.message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
      setModalBusy(false);
    }
  }

  return (
    <div className="paper-page odin-content-page">
      <header className="paper-header">
        <div>
          <div className="paper-header__title-row">
            <h1 className="paper-header__title">Your Portfolio</h1>
            {strategy ? (
              <button
                type="button"
                className="paper-btn paper-btn--ghost paper-header__tour-btn"
                onClick={() => void startPaperStrategyManageTour()}
              >
                Take tour
              </button>
            ) : null}
          </div>
          <p className="paper-header__sub">
            Simulate trades with $100,000 virtual capital. Market orders fill at the latest Odin daily close
            with realistic slippage
            <DataInfoTip align="end" ariaLabel="What is slippage?">
              <p className="ticker-data-tip__p">
                We simulate real-world conditions where the fill price may be slightly different from the
                reference price you saw — the same way live markets can move between quote and execution.
              </p>
            </DataInfoTip>
            .
          </p>
        </div>
        <div className="paper-header__actions">
          <div data-tour="paper-account-dd">
            <ThemedDropdown
              className="paper-header__account-dd"
              value={selectedAccountId}
              options={accountOptions}
              onChange={setActiveAccountId}
              title="Virtual portfolio account"
              ariaLabelPrefix="Virtual portfolio account"
              labelFallback="Select account"
              wideLabel
              disabled={accountLoading || accountOptions.length === 0}
            />
          </div>
          <div className="paper-header__btn-row">
            <button
              type="button"
              className={
                'paper-btn paper-btn--ghost paper-btn--publish' +
                (isSelectedPublished ? ' paper-btn--publish-on' : '')
              }
              disabled={publishing || accountLoading || !selectedAccountId}
              onClick={openPublishModal}
              title={
                isSelectedPublished
                  ? 'Unpublish this portfolio from the public gallery'
                  : 'Publish this portfolio for others to view'
              }
            >
              {publishing ? (
                <Loader2 className="paper-btn__icon paper-btn__icon--spin" aria-hidden />
              ) : isSelectedPublished ? (
                <Globe className="paper-btn__icon" aria-hidden />
              ) : (
                <GlobeLock className="paper-btn__icon" aria-hidden />
              )}
              <span>{isSelectedPublished ? 'Published' : 'Publish'}</span>
            </button>
            <PaperAccountCreateMenu
              disabled={accountLoading}
              onManualAccount={openCreateModal}
              onStrategyAccount={() => setWizardOpen(true)}
            />
            <button
              type="button"
              className="paper-btn paper-btn--icon paper-btn--ghost paper-btn--danger"
              disabled={resetting || accountLoading}
              onClick={openResetModal}
              aria-label={resetting ? 'Resetting portfolio' : 'Reset portfolio'}
              title="Reset portfolio to $100,000 and clear all positions, orders, and strategy rules"
            >
              {resetting ? (
                <Loader2 className="paper-btn__icon paper-btn__icon--spin" aria-hidden />
              ) : (
                <RotateCcw className="paper-btn__icon" aria-hidden />
              )}
            </button>
            <button
              type="button"
              className="paper-btn paper-btn--icon paper-btn--danger"
              disabled={
                deletingAccount || accountLoading || !selectedAccountId || (accounts?.length ?? 0) <= 1
              }
              aria-label={deletingAccount ? 'Deleting account' : 'Delete account'}
              title={
                (accounts?.length ?? 0) <= 1
                  ? 'Keep at least one virtual portfolio account'
                  : 'Permanently delete this virtual portfolio account'
              }
              onClick={openDeleteModal}
            >
              {deletingAccount ? (
                <Loader2 className="paper-btn__icon paper-btn__icon--spin" aria-hidden />
              ) : (
                <Trash2 className="paper-btn__icon" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>

      <PaperManageModal
        open={modal === 'create'}
        title="New virtual portfolio account"
        titleId="paper-create-account-title"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--ghost"
              onClick={closeModal}
              disabled={modalBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--primary"
              onClick={() => void submitCreateAccount()}
              disabled={modalBusy}
            >
              {modalBusy ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <label className="wl-manage-label" htmlFor="paper-create-account-name">
          Name
        </label>
        <input
          id="paper-create-account-name"
          type="text"
          className="wl-manage-input"
          value={newAccountName}
          onChange={(e) => setNewAccountName(e.target.value)}
          placeholder="e.g. Growth strategy"
          disabled={modalBusy}
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submitCreateAccount();
          }}
        />
        {modalError ? <p className="wl-manage-err">{modalError}</p> : null}
      </PaperManageModal>

      <PaperManageModal
        open={modal === 'reset'}
        title="Reset portfolio"
        titleId="paper-reset-portfolio-title"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--ghost"
              onClick={closeModal}
              disabled={modalBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--danger"
              onClick={() => void submitResetPortfolio()}
              disabled={modalBusy}
            >
              {modalBusy ? 'Resetting…' : 'Reset'}
            </button>
          </>
        }
      >
        <p className="paper-modal-msg">
          Reset <strong>{selectedAccountLabel}</strong> to $100,000 virtual cash and clear all positions,
          orders, trade history, portfolio chart data, strategy rules, and execution log? This cannot be
          undone.
        </p>
        {modalError ? <p className="wl-manage-err">{modalError}</p> : null}
      </PaperManageModal>

      <PaperManageModal
        open={modal === 'publish' || modal === 'edit-publish'}
        title={modal === 'edit-publish' ? 'Published portfolio' : 'Publish portfolio'}
        titleId="paper-publish-portfolio-title"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--ghost"
              onClick={closeModal}
              disabled={modalBusy}
            >
              Cancel
            </button>
            {modal === 'edit-publish' ? (
              <button
                type="button"
                className="wl-manage-btn wl-manage-btn--danger"
                onClick={() => void submitUnpublishPortfolio()}
                disabled={modalBusy}
              >
                {modalBusy ? 'Saving…' : 'Unpublish'}
              </button>
            ) : null}
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--primary"
              onClick={() => void submitPublishPortfolio()}
              disabled={modalBusy}
            >
              {modalBusy ? 'Saving…' : modal === 'edit-publish' ? 'Save changes' : 'Publish'}
            </button>
          </>
        }
      >
        <p className="paper-modal-msg">
          {modal === 'edit-publish' ? (
            <>
              Update the public profile for <strong>{selectedAccountLabel}</strong>. Changes appear on the
              public gallery immediately.
            </>
          ) : (
            <>
              Publish <strong>{selectedAccountLabel}</strong> so anyone can view holdings, performance, and
              trade history in read-only mode.
            </>
          )}
        </p>
        <label className="wl-manage-label" htmlFor="paper-publish-description">
          Description
        </label>
        <textarea
          id="paper-publish-description"
          className="wl-manage-input paper-publish-textarea"
          rows={3}
          maxLength={2000}
          placeholder="Short summary of this portfolio (optional)"
          value={publishDescription}
          onChange={(e) => setPublishDescription(e.target.value)}
          disabled={modalBusy}
        />
        <label className="wl-manage-label" htmlFor="paper-publish-strategy">
          Strategy
        </label>
        <textarea
          id="paper-publish-strategy"
          className="wl-manage-input paper-publish-textarea"
          rows={3}
          maxLength={2000}
          placeholder="How you trade this account — rules, style, automation, etc. (optional)"
          value={publishStrategy}
          onChange={(e) => setPublishStrategy(e.target.value)}
          disabled={modalBusy}
        />
        {modalError ? <p className="wl-manage-err">{modalError}</p> : null}
      </PaperManageModal>

      <PaperManageModal
        open={modal === 'delete'}
        title="Delete account"
        titleId="paper-delete-account-title"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--ghost"
              onClick={closeModal}
              disabled={modalBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--danger"
              onClick={() => void submitDeleteAccount()}
              disabled={modalBusy || !selectedAccountId}
            >
              {modalBusy ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="paper-modal-msg">
          Permanently delete <strong>{selectedAccountLabel}</strong>? All positions, orders, fills, and history for
          this account will be removed.
        </p>
        {modalError ? <p className="wl-manage-err">{modalError}</p> : null}
      </PaperManageModal>

      <StrategyAccountWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        createAccount={createAccount}
        createStrategy={createStrategy}
        addRule={addRule}
        bindStrategy={bindStrategy}
        onComplete={async ({ accountId }) => {
          setActiveAccountId(accountId);
          goToTab('strategy');
          await Promise.all([refetchAccount(accountId), refetchStrategy(accountId)]);
          clearTourProgress(TOUR_IDS.PAPER_STRATEGY_MANAGE);
          void startPaperStrategyManageTour();
        }}
      />

      {accountError ? <div className="paper-alert paper-alert--error">{accountError}</div> : null}

      <AccountSummary account={account} loading={accountLoading} />

      <div className="paper-layout">
        <aside className="paper-layout__ticket">
          <OrderTicket
            onPlaceOrder={handlePlaceOrder}
            positions={positions}
            strategyActive={strategyActive}
            initialTicker={initialTicker}
          />
        </aside>

        <div className="paper-layout__main">
          <PaperPerformanceChart history={history} loading={historyLoading} />
          <PortfolioInsightsPanel
            account={account}
            positions={positions}
            pendingCount={pendingCount}
            closedTradesCount={closedTrades.length}
            strategyActive={strategyActive}
            showStrategyTab={showStrategyTab}
            loading={accountLoading || positionsLoading}
            onSetupStrategy={() => setWizardOpen(true)}
            sectors={sectors}
            sectorEquity={sectorEquity}
            sectorsLoading={analyticsLoading}
          />
        </div>
      </div>

      <section className="paper-card paper-blotter">
        <div className="paper-card__head paper-card__head--tabs">
          <div className="paper-blotter-tabs-row" data-tour="paper-blotter-tabs-row">
            <div className="paper-tabs paper-tabs--scroll" role="tablist" aria-label="Holdings and orders">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'positions'}
                  data-tour="paper-tab-positions"
                  className={'paper-tabs__btn' + (tab === 'positions' ? ' paper-tabs__btn--active' : '')}
                  onClick={() => goToTab('positions')}
                >
                  Positions
                  <span className="paper-tabs__count">{positions.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'orders'}
                  className={'paper-tabs__btn' + (tab === 'orders' ? ' paper-tabs__btn--active' : '')}
                  onClick={() => goToTab('orders')}
                >
                  Orders
                  <span className="paper-tabs__count">{orders.length}</span>
                  {pendingCount > 0 ? (
                    <span className="paper-tabs__count paper-tabs__pending">
                      ({pendingCount} pending)
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'closed'}
                  className={'paper-tabs__btn' + (tab === 'closed' ? ' paper-tabs__btn--active' : '')}
                  onClick={() => goToTab('closed')}
                >
                  Closed trades
                  <span className="paper-tabs__count">{closedTrades.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'insights'}
                  className={'paper-tabs__btn' + (tab === 'insights' ? ' paper-tabs__btn--active' : '')}
                  onClick={() => goToTab('insights')}
                  title="Compare all portfolios and download reports"
                >
                  Insights
                </button>
                {showStrategyTab ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'strategy'}
                    data-tour="paper-tab-strategy"
                    className={'paper-tabs__btn' + (tab === 'strategy' ? ' paper-tabs__btn--active' : '')}
                    onClick={() => goToTab('strategy')}
                  >
                    Strategy
                    {strategyActive ? (
                      <span className="wl-flyout__select-item-tag wl-flyout__select-item-tag--auto paper-tabs__auto-tag">
                        Auto
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className="paper-tabs__btn paper-tabs__btn--setup"
                    onClick={() => setWizardOpen(true)}
                  >
                    Set up automation
                  </button>
                )}
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
                  loading={strategyLoading}
                  error={strategyError}
                  onAddRule={(payload) => addRule(strategy.id, payload)}
                  onUpdateRule={(ruleId, payload) => updateRule(strategy.id, ruleId, payload)}
                  onDeleteRule={(ruleId) => deleteRule(strategy.id, ruleId)}
                  onPatchStrategy={(patch) => patchStrategy(strategy.id, patch)}
                  onToggleActive={async (active) => {
                    await patchBinding(strategy.id, activeAccountId, { is_active: active });
                    await patchStrategy(strategy.id, { is_active: active });
                  }}
                  onRunOnce={() => runOnce(activeAccountId)}
                  onRefetch={(opts) => refetchStrategy(undefined, opts)}
                  onRefetchBlotter={async () => {
                    await Promise.all([refetchStrategy(), refetchAccount(), refetchOrders()]);
                  }}
                />
              ) : tab === 'positions' ? (
                <PositionsTable
                  positions={positions}
                  loading={positionsLoading}
                  onPlaceOrder={handlePlaceOrder}
                />
              ) : tab === 'closed' ? (
                <>
                  <ClosedTradesAnalytics trades={closedTrades} loading={closedLoading} />
                  <div className="paper-closed-export">
                    <button
                      type="button"
                      className="paper-btn paper-btn--ghost"
                      onClick={() => exportClosedTradesCsv(closedTrades, selectedAccountLabel)}
                    >
                      Download closed trades (CSV)
                    </button>
                  </div>
                  <ClosedTradesTable trades={closedTrades} totals={closedTotals} loading={closedLoading} />
                </>
              ) : tab === 'insights' ? (
                <PortfolioInsightsTab
                  summaries={portfolioSummaries}
                  compareHistory={compareHistory}
                  sectors={sectors}
                  sectorEquity={sectorEquity}
                  loading={analyticsLoading}
                  error={analyticsError}
                  activeAccountId={activeAccountId}
                  activeAccountName={selectedAccountLabel}
                  onSelectAccount={setActiveAccountId}
                  onExportPositions={() => exportPositionsCsv(positions, selectedAccountLabel)}
                  onExportClosedTrades={() => exportClosedTradesCsv(closedTrades, selectedAccountLabel)}
                />
              ) : (
                <OrdersTable
                  orders={orders}
                  loading={ordersLoading}
                  onCancel={async (id) => {
                    await cancelOrder(id);
                    await refetchAccount();
                  }}
                  onModify={async (id, patch) => {
                    await modifyOrder(id, patch);
                    await refetchAccount();
                  }}
                />
              )}
            </div>
          </section>
    </div>
  );
}

/** Same login modal as watchlist (`LoginGateProvider` / `LoginRequiredModal`). */
export default function PaperTradingPage() {
  const navigate = useNavigate();
  const loginGate = useLoginGateOptional();
  const loggedIn = useIsLoggedIn();
  const authReady = loginGate?.authReady ?? false;

  useEffect(() => {
    if (!authReady || loggedIn) return;
    loginGate?.showLoginRequired({
      onDismiss: () => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/market', { replace: true });
      }
    });
  }, [authReady, loggedIn, loginGate, navigate]);

  if (!authReady || !loggedIn) {
    return null;
  }

  return <PaperTradingPageContent />;
}
