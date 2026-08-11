'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { apiUrl } from '../../utils/apiOrigin.js';
import { fetchWithAuth } from '../../store/apiStore.js';
import { useLoginGate } from '../../context/LoginGateContext.jsx';
import { PaperManageModal } from './PaperManageModal.jsx';
import { paperActionLabel } from './paperActionLabels.js';

function money(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(Number(v));
}

function pct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Number(v).toFixed(2)}%`;
}

/**
 * Copy a published portfolio into a new paper account.
 *
 * Starting capital is inherited from the source portfolio — not chosen here — so the copy and
 * the original stay directly comparable.
 *
 * The preview comes from the public endpoint, so it renders for logged-out visitors too; the
 * login prompt only fires when they commit.
 */
export function CopyPortfolioModal({ open, portfolio, onClose, onCopied }) {
  const navigate = useNavigate();
  const { isLoggedIn, requireLogin } = useLoginGate();
  const accountId = portfolio?.id || '';
  const sourceName = portfolio?.name || 'portfolio';

  const [name, setName] = useState('');
  const [copyAi, setCopyAi] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setCopyAi(false);
    setError('');
    setPreview(null);
  }, [open, accountId]);

  const loadPreview = useCallback(async () => {
    if (!open || !accountId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        apiUrl(`/api/public/paper/portfolios/${encodeURIComponent(accountId)}/copy-preview`)
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        // Surface the status when the body is not JSON — a 404 here means the backend is
        // running a build without the copy endpoints, which is otherwise invisible.
        throw new Error(json?.error || `Copy preview unavailable (HTTP ${res.status})`);
      }
      setPreview(json);
      setName((current) => current || json.suggested_name || '');
    } catch (err) {
      setPreview(null);
      setError(err?.message || 'Could not build a preview for this portfolio');
    } finally {
      setLoading(false);
    }
  }, [open, accountId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function handleSubmit() {
    if (!accountId || submitting) return;
    // Anonymous visitors get the full preview above; the login prompt lands only when they commit.
    if (!isLoggedIn) {
      requireLogin(() => {});
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetchWithAuth(
        apiUrl(`/api/paper/portfolios/${encodeURIComponent(accountId)}/copy`),
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim() || undefined,
            copy_ai_strategy: copyAi
          })
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Copy failed (HTTP ${res.status})`);
      }
      onCopied?.(json);
      onClose();
      navigate(`/paper-trading?account_id=${encodeURIComponent(json.account.id)}`);
    } catch (err) {
      setError(err?.message || 'Copy failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!portfolio) return null;

  const planned = preview?.planned || [];
  const skipped = preview?.skipped || [];
  const capital = preview?.capital;
  const sourceIsAi = Boolean(preview?.source?.ai_managed ?? portfolio?.ai_managed);
  const canSubmit = planned.length > 0 && !loading && !submitting;

  return (
    <PaperManageModal
      open={open}
      title={`Copy ${sourceName}`}
      titleId="paper-copy-portfolio-title"
      modalClassName="paper-rule-edit-modal paper-copy-modal"
      onClose={onClose}
      footer={
        <div className="paper-rule-edit-modal__actions">
          <button
            type="button"
            className="paper-btn paper-btn--danger"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="paper-btn paper-btn--submit-entry"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {submitting
              ? 'Copying…'
              : !isLoggedIn
                ? 'Sign in to copy'
                : planned.length
                  ? `Copy ${planned.length} position${planned.length === 1 ? '' : 's'}`
                  : 'Copy portfolio'}
          </button>
        </div>
      }
    >
      <div className="paper-strategy-rule-form paper-strategy-rule-form--modal">
        <div className="paper-strategy-rule-form__layout">
          <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--primary">
            <label className="paper-field">
              <span className="paper-field__label">New portfolio name</span>
              <input
                type="text"
                className="paper-input"
                value={name}
                maxLength={60}
                placeholder={`Copy of ${sourceName}`}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
            </label>
            <label className="paper-field">
              <span className="paper-field__label">Starting capital</span>
              <input
                type="text"
                className="paper-input"
                readOnly
                value={capital != null ? money(capital) : '—'}
              />
            </label>
          </div>
        </div>

        <p className="paper-strategy-muted paper-strategy-rule-form__hint">
          Your copy starts with the same capital as {sourceName}, so the two books stay directly
          comparable.
        </p>

        {loading ? (
          <p className="paper-strategy-muted">Pricing this portfolio at today&rsquo;s market…</p>
        ) : null}

        {error ? <div className="paper-alert paper-alert--error">{error}</div> : null}

        {preview && !loading ? (
          <>
            <div className="paper-rule-edit-modal__summary-card">
              <span className="paper-rule-edit-modal__summary-label">You will receive</span>
              <p className="paper-rule-edit-modal__summary">
                {planned.length} position{planned.length === 1 ? '' : 's'} ·{' '}
                {money(preview.est_invested)} invested · {money(preview.est_cash_remaining)} left in
                cash
              </p>
            </div>

            <div className="paper-alert paper-alert--warn">
              This copies the <strong>current holdings at today&rsquo;s prices</strong>, not the
              original entry prices. Your copy starts at {money(capital)} with no gain or loss, and
              its performance will differ from the returns shown on {sourceName}.
            </div>

            {preview.exceeds_capital ? (
              <div className="paper-alert paper-alert--warn">
                {sourceName} holds more exposure than its own equity, so matching its weights needs{' '}
                {money(preview.est_invested)} against {money(capital)} of capital. The positions
                that do not fit will be reported as skipped after the copy runs.
              </div>
            ) : null}

            {planned.length ? (
              <div className="paper-table-wrap">
                <table className="paper-table">
                  <thead>
                    <tr>
                      <th scope="col">Ticker</th>
                      <th scope="col">Action</th>
                      <th scope="col">Weight</th>
                      <th scope="col">Shares</th>
                      <th scope="col">Price</th>
                      <th scope="col">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planned.map((p) => (
                      <tr key={`${p.ticker}-${p.action}`}>
                        <td className="paper-table__sym">{p.ticker}</td>
                        <td>{paperActionLabel(p.action)}</td>
                        <td>{pct(p.weight_pct)}</td>
                        <td>{p.qty}</td>
                        <td>{money(p.price)}</td>
                        <td>{money(p.est_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="paper-alert paper-alert--warn">
                None of these positions can be bought with {money(capital)} of starting capital.
              </div>
            )}

            {skipped.length ? (
              <div className="paper-copy-modal__skipped">
                <p className="paper-strategy-muted">
                  <strong>
                    {skipped.length} position{skipped.length === 1 ? '' : 's'} cannot be copied:
                  </strong>
                </p>
                <ul className="paper-strategy-muted">
                  {skipped.map((s) => (
                    <li key={`${s.ticker}-${s.action}`}>
                      {s.ticker} ({pct(s.weight_pct)}) — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {sourceIsAi ? (
              <label className="paper-field paper-copy-modal__ai-optin">
                <input
                  type="checkbox"
                  checked={copyAi}
                  onChange={(e) => setCopyAi(e.target.checked)}
                  disabled={submitting}
                />
                <span>
                  Also run the AI rebalancer on my copy
                  {preview.source?.ai_rebalance_cadence
                    ? ` (${preview.source.ai_rebalance_cadence})`
                    : ''}
                  <span className="paper-strategy-muted">
                    {' '}
                    — the AI will place trades in this account on its own. Leave unchecked to copy
                    the holdings only.
                  </span>
                </span>
              </label>
            ) : null}
          </>
        ) : null}
      </div>
    </PaperManageModal>
  );
}
