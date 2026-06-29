'use client';
import { useMemo, useState } from 'react';
import { PaperManageModal } from './PaperManageModal.jsx';
import { StrategyRuleForm } from './StrategyRuleForm.jsx';
import { buildRulePayloads, validateRuleForm } from './strategyRuleUtils.js';
import { STRATEGY_SCHEDULE_HELP } from '../../utils/strategySchedule.js';

const WIZARD_TEMPLATES = [
  { id: 'dip', label: 'Buy the Dip', hint: 'Enter on L1 (deepest pullback)' },
  { id: 'trend', label: 'Ride the Trend', hint: 'Enter on L2–L3 (stronger trend)' },
  { id: 'custom', label: 'Custom', hint: 'Build your own rule' }
];

const WIZARD_STEPS = [
  { key: 'account', label: 'Portfolio' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'rules', label: 'Rules' }
];

export function StrategyAccountWizard({
  open,
  onClose,
  onComplete,
  createAccount,
  createStrategy,
  addRule,
  bindStrategy
}) {
  const [step, setStep] = useState(0);
  const [accountName, setAccountName] = useState('');
  const [strategyName, setStrategyName] = useState('');
  const [draftRuleForm, setDraftRuleForm] = useState(null);
  const [ruleTemplate, setRuleTemplate] = useState('custom');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canCreate = useMemo(() => {
    if (!draftRuleForm) return false;
    return !validateRuleForm(draftRuleForm, { existingRules: [] });
  }, [draftRuleForm]);

  function reset() {
    setStep(0);
    setAccountName('');
    setStrategyName('');
    setDraftRuleForm(null);
    setRuleTemplate('custom');
    setError('');
    setBusy(false);
  }

  function handleClose() {
    reset();
    onClose?.();
  }

  function validateStep(targetStep) {
    if (targetStep >= 1 && !accountName.trim()) {
      setError('Portfolio name is required');
      return false;
    }
    if (targetStep >= 2 && !strategyName.trim()) {
      setError('Strategy name is required');
      return false;
    }
    return true;
  }

  function goNext() {
    if (step === 0) {
      if (!validateStep(1)) return;
      setError('');
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!validateStep(2)) return;
      setError('');
      setStep(2);
    }
  }

  function goBack() {
    setError('');
    setStep((s) => Math.max(0, s - 1));
  }

  async function finish() {
    const accName = accountName.trim();
    const stratName = strategyName.trim();
    if (!accName) {
      setError('Enter a portfolio name');
      setStep(0);
      return;
    }
    if (!stratName) {
      setError('Enter a strategy name');
      setStep(1);
      return;
    }
    const formErr = validateRuleForm(draftRuleForm, { existingRules: [] });
    if (formErr) {
      setError(formErr);
      return;
    }
    const rulesToCreate = buildRulePayloads(draftRuleForm);
    if (!rulesToCreate.length) {
      setError('Complete the rule form before creating the account');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const account = await createAccount({ name: accName, activate: false });
      const strategy = await createStrategy({ name: stratName, description: null });
      for (const payload of rulesToCreate) {
        await addRule(strategy.id, payload);
      }
      await bindStrategy(strategy.id, account.id, true);
      handleClose();
      await onComplete?.({ accountId: account.id, strategyId: strategy.id });
    } catch (err) {
      setError(err?.message || 'Failed to create strategy account');
    } finally {
      setBusy(false);
    }
  }

  const accountFormId = 'paper-wizard-step-account-form';
  const strategyFormId = 'paper-wizard-step-strategy-form';

  const footer = (
    <div className="paper-strategy-wizard__actions">
      <button type="button" className="paper-btn paper-btn--danger" onClick={handleClose} disabled={busy}>
        Cancel
      </button>
      {step > 0 ? (
        <button type="button" className="paper-btn paper-btn--ghost" onClick={goBack} disabled={busy}>
          Back
        </button>
      ) : null}
      {step < 2 ? (
        <button
          type="submit"
          form={step === 0 ? accountFormId : strategyFormId}
          className="paper-btn paper-btn--submit-entry"
          disabled={busy}
        >
          Next
        </button>
      ) : (
        <button
          type="button"
          className="paper-btn paper-btn--submit-entry"
          disabled={busy || !canCreate}
          title={!canCreate ? 'Complete the rule form first' : undefined}
          onClick={() => void finish()}
        >
          {busy ? 'Creating…' : 'Create strategy account'}
        </button>
      )}
    </div>
  );

  return (
    <PaperManageModal
      open={open}
      title="New strategy account"
      titleId="paper-strategy-wizard-title"
      modalClassName={'paper-strategy-wizard' + (step === 2 ? ' paper-strategy-wizard--rules' : '')}
      onClose={handleClose}
      footer={footer}
    >
      <nav className="paper-strategy-wizard__steps" aria-label="Setup progress">
        {WIZARD_STEPS.map((s, i) => (
          <div
            key={s.key}
            className={
              'paper-strategy-wizard__step-indicator' +
              (i === step ? ' paper-strategy-wizard__step-indicator--active' : '') +
              (i < step ? ' paper-strategy-wizard__step-indicator--done' : '')
            }
          >
            <span className="paper-strategy-wizard__step-num">{i + 1}</span>
            <span className="paper-strategy-wizard__step-label">{s.label}</span>
          </div>
        ))}
      </nav>

      {step === 0 ? (
        <form
          id={accountFormId}
          className="paper-strategy-wizard__panel"
          data-tour="paper-wizard-step-account"
          onSubmit={(e) => {
            e.preventDefault();
            goNext();
          }}
        >
          <p className="paper-strategy-wizard__intro">
            Create a dedicated paper portfolio with automated rules. {STRATEGY_SCHEDULE_HELP}
          </p>
          <label className="paper-field" htmlFor="paper-wizard-account-name">
            <span className="paper-field__label">Portfolio name</span>
            <input
              id="paper-wizard-account-name"
              type="text"
              className="paper-input paper-strategy-wizard__input"
              value={accountName}
              onChange={(e) => {
                setAccountName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Tech momentum"
              disabled={busy}
              autoFocus
            />
          </label>

        </form>
      ) : null}

      {step === 1 ? (
        <form
          id={strategyFormId}
          className="paper-strategy-wizard__panel"
          data-tour="paper-wizard-step-strategy"
          onSubmit={(e) => {
            e.preventDefault();
            goNext();
          }}
        >
          <p className="paper-strategy-wizard__intro">
            Name the strategy that will control trades for{' '}
            <strong>{accountName.trim() || 'this portfolio'}</strong>.
          </p>
          <label className="paper-field" htmlFor="paper-wizard-strategy-name">
            <span className="paper-field__label">Strategy name</span>
            <input
              id="paper-wizard-strategy-name"
              type="text"
              className="paper-input paper-strategy-wizard__input"
              value={strategyName}
              onChange={(e) => {
                setStrategyName(e.target.value);
                setError('');
              }}
              placeholder="e.g. AAPL long on L2"
              disabled={busy}
              autoFocus
            />
          </label>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="paper-strategy-wizard__panel" data-tour="paper-wizard-step-rules">
          <div className="paper-strategy-wizard__summary-card">
            <span className="paper-strategy-wizard__summary-label">Setup summary</span>
            <p className="paper-strategy-wizard__summary-text">
              <strong>{accountName.trim()}</strong> · {strategyName.trim()}
            </p>
          </div>

          <section className="paper-strategy-wizard__section">
            <h4 className="paper-strategy-wizard__section-title">Add rule</h4>
            <div className="paper-rule-templates" role="group" aria-label="Rule templates">
              {WIZARD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={
                    'paper-rule-templates__btn' +
                    (ruleTemplate === t.id ? ' paper-rule-templates__btn--active' : '')
                  }
                  disabled={busy}
                  onClick={() => setRuleTemplate(t.id)}
                >
                  <span className="paper-rule-templates__label">{t.label}</span>
                  <span className="paper-rule-templates__hint">{t.hint}</span>
                </button>
              ))}
            </div>
            <StrategyRuleForm
              key={`wizard-rule-${ruleTemplate}`}
              formId="paper-wizard-add-rule-form"
              variant="modal"
              busy={busy}
              hideActions
              existingRules={[]}
              templatePreset={ruleTemplate}
              showScheduleNote
              onFormChange={setDraftRuleForm}
            />
          </section>
        </div>
      ) : null}

      {error ? <p className="paper-strategy-err paper-strategy-wizard__err">{error}</p> : null}
    </PaperManageModal>
  );
}
