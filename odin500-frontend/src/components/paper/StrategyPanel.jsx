'use client';
import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { PaperManageModal } from './PaperManageModal.jsx';
import { StrategyRuleCreateModal } from './StrategyRuleCreateModal.jsx';
import { StrategyRuleEditModal } from './StrategyRuleEditModal.jsx';
import { StrategyRulesList } from './StrategyRulesList.jsx';
import { StrategyExecutionLog } from './StrategyExecutionLog.jsx';
import { StrategyWatchlistPanel } from './StrategyWatchlistPanel.jsx';
import { AutomatedAccountBanner } from './AutomatedAccountBanner.jsx';
import { StrategyNextRunCountdown } from './StrategyNextRunCountdown.jsx';
import { scrollToStrategyAnchor, scrollToStrategyRules } from './strategyScroll.js';
import { STRATEGY_SCHEDULE_HELP } from '../../utils/strategySchedule.js';

export function StrategyPanel({
  strategy,
  binding,
  rules,
  executionLog,
  strategyActive,
  loading,
  error,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onPatchStrategy,
  onToggleActive,
  onRunOnce,
  onRefetch,
  onRefetchBlotter
}) {
  const [busy, setBusy] = useState(false);
  const [runMsg, setRunMsg] = useState('');
  const [wlSaveError, setWlSaveError] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState('');
  const [tickerSeed, setTickerSeed] = useState(null);
  const [logExpanded, setLogExpanded] = useState(true);

  if (loading) {
    return (
      <div className="paper-strategy-panel paper-strategy-panel--loading" aria-busy="true">
        <section className="paper-strategy-section paper-strategy-section--overview">
          <div className="paper-strategy-panel__head">
            <div data-tour="paper-strategy-panel-intro">
              <p className="paper-strategy-muted">Loading strategy…</p>
            </div>
            <div className="paper-strategy-panel__actions">
              <div className="paper-strategy-run-controls" data-tour="paper-strategy-controls" aria-hidden />
            </div>
          </div>
        </section>
        <section className="paper-strategy-section" data-tour="paper-strategy-watchlist" aria-hidden />
        <section className="paper-strategy-section" data-tour="paper-strategy-rules" aria-hidden />
        <section className="paper-strategy-section" data-tour="paper-strategy-log" aria-hidden />
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="paper-strategy-empty">
        <p>No strategy linked to this portfolio yet.</p>
        <p className="paper-strategy-muted">
          Use <strong>New strategy account</strong> in the header to create an automated portfolio, or bind a
          strategy from the API.
        </p>
      </div>
    );
  }

  const paused = !strategyActive;

  async function wrap(fn, { refetch = onRefetch, silent = true } = {}) {
    setBusy(true);
    setRunMsg('');
    try {
      await fn();
      if (refetch) {
        if (silent) await refetch({ silent: true });
        else await refetch();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleWatchlistKeyChange(key) {
    setWlSaveError('');
    try {
      await onPatchStrategy?.({ watchlist_key: key });
    } catch (err) {
      setWlSaveError(err?.message || 'Failed to save watchlist');
    }
  }

  function closeCreateRuleModal() {
    setCreateRuleOpen(false);
    setTickerSeed(null);
  }

  function openCreateRuleModal(symbols) {
    if (symbols?.length) {
      setTickerSeed({ symbols, nonce: Date.now() });
    } else {
      setTickerSeed(null);
    }
    setCreateRuleOpen(true);
  }

  function openDeleteAllModal() {
    if (!rules.length) return;
    setDeleteAllError('');
    setDeleteAllOpen(true);
  }

  function closeDeleteAllModal() {
    if (busy) return;
    setDeleteAllOpen(false);
    setDeleteAllError('');
  }

  async function confirmDeleteAllRules() {
    if (!rules.length) return;
    setDeleteAllError('');
    try {
      await wrap(async () => {
        setEditingRule(null);
        const ids = rules.map((r) => r.id);
        for (const id of ids) {
          await onDeleteRule(id);
        }
        setDeleteAllOpen(false);
      });
    } catch (err) {
      setDeleteAllError(err?.message || 'Failed to remove rules');
    }
  }

  return (
    <div className="paper-strategy-panel">
      <AutomatedAccountBanner />

      {error ? <p className="paper-strategy-err">{error}</p> : null}

      <section className="paper-strategy-section paper-strategy-section--overview">
        <div className="paper-strategy-panel__head">
          <div data-tour="paper-strategy-panel-intro">
            <h3 className="paper-strategy-panel__title">
              {strategy.name}
              {strategyActive ? (
                <span className="wl-flyout__select-item-tag wl-flyout__select-item-tag--auto paper-strategy-panel__auto-tag">
                  Auto
                </span>
              ) : null}
            </h3>
            <p className="paper-strategy-muted">
              Status:{' '}
              <span className={paused ? 'paper-strategy-paused' : 'paper-strategy-live'}>
                {paused ? 'Paused' : 'Active'}
              </span>
              {!paused ? (
                <StrategyNextRunCountdown lastRunAt={binding?.last_run_at} active={strategyActive} />
              ) : null}
              {binding?.last_run_at ? (
                <span className="paper-strategy-panel__last-run">
                  {' · Last check '}
                  {new Date(binding.last_run_at).toLocaleString()}
                </span>
              ) : null}
              {binding?.last_error ? (
                <span className="paper-strategy-err"> · {binding.last_error}</span>
              ) : null}
            </p>
          </div>

          <div className="paper-strategy-panel__actions">
            <div className="paper-strategy-run-controls" data-tour="paper-strategy-controls">
              <button
                type="button"
                className="paper-btn paper-btn--ghost"
                disabled={busy}
                onClick={() => void wrap(() => onToggleActive(!strategyActive))}
              >
                {strategyActive ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                className="paper-btn paper-btn--primary"
                disabled={busy || paused}
                onClick={() =>
                  void wrap(
                    async () => {
                      const out = await onRunOnce();
                      setRunMsg(
                        `Run complete — triggered: ${out?.triggered ?? 0}, failed: ${out?.failed ?? 0}`
                      );
                    },
                    { refetch: onRefetchBlotter, silent: false }
                  )
                }
              >
                {busy ? 'Running…' : 'Run now'}
              </button>
            </div>
          </div>
        </div>

        {runMsg ? <p className="paper-strategy-run-msg">{runMsg}</p> : null}
      </section>

      <StrategyWatchlistPanel
        savedWatchlistKey={strategy.watchlist_key || ''}
        rules={rules}
        busy={busy}
        saveError={wlSaveError}
        onWatchlistKeyChange={(key) => void handleWatchlistKeyChange(key)}
        onAddRule={(payload) => void wrap(() => onAddRule(payload))}
        onAddTickersToForm={(symbols) => openCreateRuleModal(symbols)}
        onScrollToRules={() => scrollToStrategyAnchor('rules-list')}
        onScrollToRule={(ruleIds) => scrollToStrategyRules(ruleIds)}
      />

      <section className="paper-strategy-section" data-tour="paper-strategy-rules">
        <div className="paper-strategy-section__head">
          <h4 className="paper-strategy-section__title">Rules</h4>
          <p className="paper-strategy-section__desc">
            Define when to buy, short, sell, or cover. {STRATEGY_SCHEDULE_HELP}
          </p>
        </div>

        <div className="paper-strategy-subsection" data-strategy-anchor="rules-list">
          <div className="paper-strategy-subsection__head">
            <h5 className="paper-strategy-subsection__title">Active rules</h5>
            <div className="paper-strategy-subsection__actions">
              <button
                type="button"
                className="paper-btn paper-btn--submit-entry paper-btn--sm"
                disabled={busy}
                data-tour="paper-create-rule"
                onClick={() => openCreateRuleModal()}
              >
                + Create rule
              </button>
              <button
                type="button"
                className="paper-btn paper-btn--icon paper-btn--ghost paper-btn--danger"
                disabled={busy || !rules.length}
                onClick={openDeleteAllModal}
                aria-label="Remove all rules"
                title={rules.length ? 'Remove all rules' : 'No rules to remove'}
              >
                <Trash2 className="paper-btn__icon" aria-hidden />
              </button>
            </div>
          </div>
          <StrategyRulesList
            rules={rules}
            busy={busy}
            editingRuleId={editingRule?.id}
            onEdit={(rule) => {
              setEditingRule(rule);
              setTickerSeed(null);
            }}
            onDelete={(ruleId) =>
              void wrap(async () => {
                if (editingRule?.id === ruleId) setEditingRule(null);
                await onDeleteRule(ruleId);
              })
            }
          />
        </div>
      </section>

      <StrategyRuleCreateModal
        open={createRuleOpen}
        busy={busy}
        existingRules={rules}
        tickerSeed={tickerSeed}
        onClose={closeCreateRuleModal}
        onSubmit={(payload) =>
          void wrap(async () => {
            const list = Array.isArray(payload) ? payload : [payload];
            for (const item of list) {
              await onAddRule(item);
            }
            closeCreateRuleModal();
          })
        }
      />

      <StrategyRuleEditModal
        open={Boolean(editingRule)}
        rule={editingRule}
        busy={busy}
        existingRules={rules}
        onClose={() => setEditingRule(null)}
        onSubmit={(payload) =>
          void wrap(async () => {
            if (!editingRule?.id) return;
            await onUpdateRule(editingRule.id, payload);
            setEditingRule(null);
          })
        }
      />

      <PaperManageModal
        open={deleteAllOpen}
        title="Remove all rules"
        titleId="paper-delete-all-rules-title"
        onClose={closeDeleteAllModal}
        footer={
          <>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--ghost"
              onClick={closeDeleteAllModal}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="wl-manage-btn wl-manage-btn--danger"
              onClick={() => void confirmDeleteAllRules()}
              disabled={busy || !rules.length}
            >
              {busy ? 'Removing…' : 'Remove all'}
            </button>
          </>
        }
      >
        <p className="paper-modal-msg">
          Remove all <strong>{rules.length}</strong> rule{rules.length === 1 ? '' : 's'} from{' '}
          <strong>{strategy.name}</strong>? This cannot be undone.
        </p>
        {deleteAllError ? <p className="wl-manage-err">{deleteAllError}</p> : null}
      </PaperManageModal>

      <section
        className={
          'paper-strategy-section paper-strategy-section--collapsible' +
          (logExpanded ? ' paper-strategy-section--open' : '')
        }
        data-tour="paper-strategy-log"
      >
        <button
          type="button"
          className="paper-strategy-section__head paper-strategy-section__toggle"
          aria-expanded={logExpanded}
          aria-controls="paper-strategy-execution-log"
          onClick={() => setLogExpanded((open) => !open)}
        >
          <span className="paper-strategy-section__toggle-text">
            <span className="paper-strategy-section__title">Execution log</span>
            <span className="paper-strategy-section__desc">
              Recent strategy runs, including triggered orders, skips, and errors.
            </span>
          </span>
          <ChevronDown className="paper-strategy-section__chev" aria-hidden />
        </button>
        {logExpanded ? (
          <div id="paper-strategy-execution-log">
            <StrategyExecutionLog log={executionLog} />
          </div>
        ) : null}
      </section>

      <section className="paper-strategy-section paper-strategy-section--footnote" aria-label="Strategy help">
        <p className="paper-strategy-docs">
          {STRATEGY_SCHEDULE_HELP} Odin signal rules use L1–S3 / N buckets. Buy/Short rules add shares
          each check until your <strong>max shares owned</strong> and/or <strong>max dollar limit</strong> —
          whichever cap is hit first stops further entries. Sell/Cover rules can use a fixed amount or{' '}
          <strong>ALL</strong> to close the full open position.
        </p>
      </section>
    </div>
  );
}
