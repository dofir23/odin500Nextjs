'use client';
import { PaperManageModal } from './PaperManageModal.jsx';
import { StrategyRuleForm } from './StrategyRuleForm.jsx';
import { buildRuleNaturalLanguagePreview } from './strategyRuleUtils.js';

const EDIT_FORM_ID = 'paper-strategy-rule-edit-form';

export function StrategyRuleEditModal({
  open,
  rule,
  busy = false,
  existingRules = [],
  onClose,
  onSubmit
}) {
  if (!rule) return null;

  return (
    <PaperManageModal
      open={open}
      title="Edit rule"
      titleId="paper-strategy-rule-edit-title"
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
            form={EDIT_FORM_ID}
            className="paper-btn paper-btn--submit-entry"
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      }
    >
      <div className="paper-rule-edit-modal__summary-card">
        <span className="paper-rule-edit-modal__summary-label">Current rule</span>
        <p className="paper-rule-edit-modal__summary">{buildRuleNaturalLanguagePreview(rule)}</p>
      </div>
      <StrategyRuleForm
        formId={EDIT_FORM_ID}
        variant="modal"
        hideActions
        busy={busy}
        editingRule={rule}
        existingRules={existingRules}
        onCancelEdit={onClose}
        onSubmit={onSubmit}
        submitLabel="Save changes"
      />
    </PaperManageModal>
  );
}
