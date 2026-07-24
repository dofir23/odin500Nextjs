'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { usePortfolioAssistant } from '../../hooks/usePortfolioAssistant.js';
import { ModalCloseIcon } from '../ModalCloseIcon.jsx';

const SUGGESTIONS = [
  'Summarize my positions',
  'What’s the latest price of AAPL?',
  'What’s AAPL’s signal?',
  'Summarize AAPL monthly report',
  'Any recent news on NVDA?',
  'How is the market today?',
  'Explain my automation rules',
  'Add buy AAPL on L2, max 10 shares, sell on Neutral'
];

const SIZE_STORAGE_KEY = 'odin_paper_assistant_size_v1';
const DEFAULT_SIZE = { width: 420, height: 560 };
const MIN_W = 320;
const MIN_H = 360;

function clampSize(next) {
  if (typeof window === 'undefined') {
    return {
      width: Math.max(MIN_W, Number(next.width) || DEFAULT_SIZE.width),
      height: Math.max(MIN_H, Number(next.height) || DEFAULT_SIZE.height)
    };
  }
  const maxW = Math.max(MIN_W, window.innerWidth - 24);
  const maxH = Math.max(MIN_H, window.innerHeight - 88);
  return {
    width: Math.min(maxW, Math.max(MIN_W, Number(next.width) || DEFAULT_SIZE.width)),
    height: Math.min(maxH, Math.max(MIN_H, Number(next.height) || DEFAULT_SIZE.height))
  };
}

function readStoredSize() {
  try {
    const raw = sessionStorage.getItem(SIZE_STORAGE_KEY);
    if (!raw) return DEFAULT_SIZE;
    return clampSize(JSON.parse(raw));
  } catch {
    return DEFAULT_SIZE;
  }
}

/**
 * Apply a confirmed proposal using existing paper strategy hooks.
 */
export async function applyAssistantProposal(proposal, api) {
  const actions = Array.isArray(proposal?.actions) ? proposal.actions : [];
  if (!actions.length) throw new Error('Nothing to apply');

  let strategyId = null;
  const results = [];

  for (const action of actions) {
    const type = action?.type;
    if (type === 'create_strategy') {
      const created = await api.createStrategy(action.payload || {});
      strategyId = created?.id;
      results.push(created);
      continue;
    }
    if (type === 'bind_strategy') {
      const sid = strategyId || action.strategy_id;
      if (!sid) throw new Error('Missing strategy for bind');
      const bound = await api.bindStrategy(
        sid,
        action.payload?.account_id || api.accountId,
        action.payload?.is_active !== false
      );
      results.push(bound);
      continue;
    }
    if (type === 'add_rule') {
      const sid = action.strategy_id || strategyId || api.strategyId;
      if (!sid) throw new Error('Missing strategy for add_rule');
      const row = await api.addRule(sid, action.payload || {});
      results.push(row);
      continue;
    }
    if (type === 'update_rule') {
      const sid = action.strategy_id || api.strategyId;
      if (!sid || !action.rule_id) throw new Error('Missing strategy/rule for update');
      const row = await api.updateRule(sid, action.rule_id, action.payload || {});
      results.push(row);
      continue;
    }
    if (type === 'delete_rule') {
      const sid = action.strategy_id || api.strategyId;
      if (!sid || !action.rule_id) throw new Error('Missing strategy/rule for delete');
      const row = await api.deleteRule(sid, action.rule_id);
      results.push(row);
      continue;
    }
    if (type === 'set_automation') {
      const sid = action.strategy_id || api.strategyId;
      if (!sid) throw new Error('Missing strategy for automation toggle');
      await api.patchBinding(sid, action.payload?.account_id || api.accountId, {
        is_active: Boolean(action.payload?.is_active)
      });
      await api.patchStrategy(sid, { is_active: Boolean(action.payload?.is_active) });
      results.push({ ok: true, type });
      continue;
    }
    if (type === 'run_once') {
      const out = await api.runOnce(action.payload?.account_id || api.accountId);
      results.push(out);
      continue;
    }
    throw new Error(`Unknown action type: ${type}`);
  }

  await api.refetch?.(api.accountId);
  await api.loadExecutionLog?.(api.accountId);
  return results;
}

function ProposalCard({ proposal, busy, onConfirm, onCancel }) {
  if (!proposal || proposal.dismissed || proposal.applied) {
    if (proposal?.applied) {
      return (
        <div className="paper-assistant__proposal paper-assistant__proposal--done">
          <p className="paper-assistant__proposal-title">Applied: {proposal.title}</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="paper-assistant__proposal">
      <p className="paper-assistant__proposal-title">{proposal.title || 'Proposed change'}</p>
      <p className="paper-assistant__proposal-summary">{proposal.summary}</p>
      <ul className="paper-assistant__proposal-actions">
        {(proposal.actions || []).map((a, i) => (
          <li key={`${a.type}-${i}`}>
            <code>{a.type}</code>
            {a.payload?.ticker ? ` · ${a.payload.ticker}` : ''}
            {a.rule_id ? ` · ${String(a.rule_id).slice(0, 8)}…` : ''}
          </li>
        ))}
      </ul>
      <div className="paper-assistant__proposal-btns">
        <button type="button" className="paper-btn paper-btn--ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="paper-btn paper-btn--submit-entry"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Applying…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   accountId: string,
 *   accountName?: string,
 *   strategyId?: string|null,
 *   createStrategy: Function,
 *   addRule: Function,
 *   updateRule: Function,
 *   deleteRule: Function,
 *   bindStrategy: Function,
 *   patchBinding: Function,
 *   patchStrategy: Function,
 *   runOnce: Function,
 *   refetch: Function,
 *   loadExecutionLog: Function,
 *   onApplied?: Function
 * }} props
 */
export function PortfolioAssistantChat({
  accountId,
  accountName = 'Portfolio',
  strategyId = null,
  createStrategy,
  addRule,
  updateRule,
  deleteRule,
  bindStrategy,
  patchBinding,
  patchStrategy,
  runOnce,
  refetch,
  loadExecutionLog,
  onApplied
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [applyBusyId, setApplyBusyId] = useState('');
  const [applyError, setApplyError] = useState('');
  const [size, setSize] = useState(DEFAULT_SIZE);
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const {
    messages,
    sending,
    error,
    openaiConfigured,
    sendMessage,
    clearThread,
    dismissProposal,
    markProposalApplied
  } = usePortfolioAssistant(accountId);

  function closeAssistant() {
    setOpen(false);
  }

  useEffect(() => {
    setSize(readStoredSize());
  }, []);

  useEffect(() => {
    const onResize = () => setSize((prev) => clampSize(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !open) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeAssistant();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const persistSize = useCallback((next) => {
    const clamped = clampSize(next);
    setSize(clamped);
    try {
      sessionStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const onResizePointerDown = useCallback(
    (edge) => (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = size.width;
      const startH = size.height;
      dragRef.current = { edge, startX, startY, startW, startH };
      document.body.classList.add('paper-assistant--resizing');

      const onMove = (ev) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        let width = drag.startW;
        let height = drag.startH;
        // Anchored bottom-right: drag left/up grows the panel.
        if (drag.edge.includes('w')) width = drag.startW - dx;
        if (drag.edge.includes('n')) height = drag.startH - dy;
        setSize(clampSize({ width, height }));
      };

      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.classList.remove('paper-assistant--resizing');
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        let width = drag.startW;
        let height = drag.startH;
        if (drag.edge.includes('w')) width = drag.startW - dx;
        if (drag.edge.includes('n')) height = drag.startH - dy;
        persistSize({ width, height });
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [persistSize, size.height, size.width]
  );

  async function handleSend(text) {
    const value = String(text ?? draft).trim();
    if (!value || sending) return;
    setDraft('');
    setApplyError('');
    await sendMessage(value);
  }

  async function handleConfirm(messageId, proposal) {
    setApplyBusyId(proposal.id);
    setApplyError('');
    try {
      await applyAssistantProposal(proposal, {
        accountId,
        strategyId,
        createStrategy,
        addRule,
        updateRule,
        deleteRule,
        bindStrategy,
        patchBinding,
        patchStrategy,
        runOnce,
        refetch,
        loadExecutionLog
      });
      markProposalApplied(messageId, proposal.id);
      onApplied?.();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply proposal');
    } finally {
      setApplyBusyId('');
    }
  }

  return (
    <div className={'paper-assistant' + (open ? ' paper-assistant--open' : '')}>
      <div className="paper-assistant__toggle" role="group" aria-label="Ask Odin AI">
        <button
          type="button"
          className={
            'paper-assistant__toggle-btn' + (open ? ' paper-assistant__toggle-btn--active' : '')
          }
          aria-expanded={open}
          aria-controls="paper-assistant-panel"
          title="Ask Odin AI"
          onClick={() => setOpen((v) => !v)}
        >
          <Sparkles className="paper-assistant__toggle-sparkle" strokeWidth={2.25} aria-hidden />
          <span className="paper-assistant__toggle-text">Ask Odin AI</span>
        </button>
      </div>

      {open ? (
        <section
          id="paper-assistant-panel"
          className="paper-assistant__panel wl-manage-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paper-assistant-title"
          style={{ width: size.width, height: size.height }}
        >
          <div
            className="paper-assistant__resize paper-assistant__resize--n"
            onPointerDown={onResizePointerDown('n')}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize chat height"
            title="Drag to resize height"
          />
          <div
            className="paper-assistant__resize paper-assistant__resize--w"
            onPointerDown={onResizePointerDown('w')}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat width"
            title="Drag to resize width"
          />
          <div
            className="paper-assistant__resize paper-assistant__resize--nw"
            onPointerDown={onResizePointerDown('nw')}
            role="separator"
            aria-label="Resize chat"
            title="Drag to resize"
          />

          <header className="paper-assistant__head wl-manage-modal__head">
            <div className="paper-assistant__head-text">
              <h2 id="paper-assistant-title" className="paper-assistant__title wl-manage-modal__title">
                Strategy assistant
              </h2>
              <p className="paper-assistant__sub">Using portfolio: {accountName}</p>
            </div>
            <div className="paper-assistant__head-actions">
              <button
                type="button"
                className="paper-btn paper-btn--ghost paper-assistant__clear"
                onClick={clearThread}
              >
                Clear
              </button>
              <button
                type="button"
                className="wl-manage-modal__close"
                onClick={closeAssistant}
                aria-label="Close assistant"
              >
                <ModalCloseIcon className="wl-manage-modal__close-icon" />
              </button>
            </div>
          </header>

          {!openaiConfigured ? (
            <p className="paper-assistant__banner paper-assistant__banner--warn">
              Assistant is unavailable until the server has <code>OPENAI_API_KEY</code> configured.
            </p>
          ) : (
            <p className="paper-assistant__banner">
              Simulated paper trading only — not investment advice. Strategy changes require Confirm.
            </p>
          )}

          <div className="paper-assistant__chips" aria-label="Suggested prompts">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="paper-assistant__chip"
                disabled={sending || !openaiConfigured}
                onClick={() => void handleSend(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div ref={listRef} className="paper-assistant__messages" role="log" aria-live="polite">
            {!messages.length ? (
              <p className="paper-assistant__empty">
                Ask about equity, positions, rules, or describe a strategy to add. Example: “Buy NVDA on
                L2/L3, max $8,000, sell on Neutral.”
              </p>
            ) : null}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  'paper-assistant__msg' +
                  (m.role === 'user' ? ' paper-assistant__msg--user' : ' paper-assistant__msg--bot') +
                  (m.isError ? ' paper-assistant__msg--err' : '')
                }
              >
                <p className="paper-assistant__msg-text">{m.content}</p>
                {(m.proposals || []).map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    busy={applyBusyId === p.id}
                    onCancel={() => dismissProposal(m.id, p.id)}
                    onConfirm={() => void handleConfirm(m.id, p)}
                  />
                ))}
              </div>
            ))}
            {sending ? <p className="paper-assistant__typing">Thinking…</p> : null}
          </div>

          {error || applyError ? (
            <p className="paper-assistant__error">{applyError || error}</p>
          ) : null}

          <form
            className="paper-assistant__composer"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <label className="sr-only" htmlFor="paper-assistant-input">
              Message
            </label>
            <textarea
              id="paper-assistant-input"
              className="paper-assistant__input"
              rows={2}
              value={draft}
              disabled={sending || !accountId}
              placeholder={
                openaiConfigured
                  ? 'Ask about this portfolio or request a rule change…'
                  : 'Assistant unavailable'
              }
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="submit"
              className="paper-btn paper-btn--submit-entry"
              disabled={sending || !draft.trim() || !openaiConfigured}
            >
              Send
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
