'use client';
import { PaperManageModal } from './PaperManageModal.jsx';
import { StrategyRuleForm } from './StrategyRuleForm.jsx';

const CREATE_FORM_ID = 'paper-strategy-rule-create-form';

export function StrategyRuleCreateModal({
  open,
  busy = false,
  existingRules = [],
  tickerSeed = null,
  onClose,
  onSubmit
}) {
  if (!open) return null;

  const prefilledTickers = tickerSeed?.symbols?.length
    ? tickerSeed.symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean).join(', ')
    : '';

  return (
    <PaperManageModal
      open={open}
      title="Create rule"
      titleId="paper-strategy-rule-create-title"
      modalClassName="paper-rule-edit-modal"
      onClose={onClose}
      footer={
        <div className="paper-rule-edit-modal__actions">
          <button
            type="button"
            className="paper-btn paper-btn--danger"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={CREATE_FORM_ID}
            className="paper-btn paper-btn--submit-entry"
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create rule'}
          </button>
        </div>
      }
    >
      {prefilledTickers ? (
        <p className="paper-strategy-muted paper-rule-edit-modal__summary">
          Adding rule for watchlist tickers: <strong>{prefilledTickers}</strong>
        </p>
      ) : (
        <p className="paper-strategy-muted paper-rule-edit-modal__summary">
          Configure when this strategy should buy, short, sell, or cover. The preview updates as you type.
        </p>
      )}
      <StrategyRuleForm
        key={tickerSeed?.nonce ?? 'create-rule'}
        formId={CREATE_FORM_ID}
        variant="modal"
        hideActions
        busy={busy}
        existingRules={existingRules}
        tickerSeed={tickerSeed}
        showScheduleNote
        onSubmit={onSubmit}
        submitLabel="Create rule"
      />
    </PaperManageModal>
  );
}
