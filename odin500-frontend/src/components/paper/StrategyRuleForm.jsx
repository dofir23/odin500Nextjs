'use client';
import { useEffect, useMemo, useState } from 'react';
import { TickerSymbolCombobox } from '../TickerSymbolCombobox.jsx';
import { ThemedDropdown } from '../ThemedDropdown.jsx';
import { SignalBucketMultiSelect } from './SignalBucketMultiSelect.jsx';
import { isClosingPaperAction, isOpeningPaperAction } from './paperActionLabels.js';
import { useWatchlistOptions } from '../../hooks/useWatchlistOptions.js';
import { useTickerLatestPrices } from '../../hooks/useTickerLatestPrices.js';
import { formatLatestClosePrice } from '../../utils/marketOhlcLatest.js';
import { watchlistKindTag } from '../../utils/watchlistOptions.js';
import {
  buildActionOptions,
  buildRuleNaturalLanguagePreview,
  buildRulePayload,
  buildRulePayloads,
  buildRuleTypeOptions,
  coalesceActionForRuleType,
  getDisabledSignalBuckets,
  getExitSignalRestrictions,
  RULE_FORM_TEMPLATES,
  ruleToForm,
  validateRuleForm
} from './strategyRuleUtils.js';
import { STRATEGY_SCHEDULE_HELP } from '../../utils/strategySchedule.js';

const EMPTY = {
  uiRuleType: 'signal_side_long',
  tickers: [],
  action: 'BTO',
  qty: '1',
  maxPositionQty: '10',
  maxPositionValue: '',
  closeAll: false,
  threshold_value: '',
  signalBuckets: [],
  bracketEnabled: false,
  bracketStopLoss: '',
  bracketTakeProfit: ''
};

export function StrategyRuleForm({
  onSubmit,
  onFormChange,
  busy = false,
  submitLabel = 'Add rule',
  editingRule = null,
  onCancelEdit,
  tickerSeed = null,
  existingRules = [],
  variant = 'inline',
  formId,
  hideActions = false,
  templatePreset = null,
  showScheduleNote = false
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [tickerSource, setTickerSource] = useState('manual');
  const [selectedWatchlistKey, setSelectedWatchlistKey] = useState('');
  const { options: watchlistOptions, loading: watchlistsLoading } = useWatchlistOptions();
  const isEditing = Boolean(editingRule?.id);
  const excludeRuleId = editingRule?.id ?? editingRule?._localId ?? null;

  useEffect(() => {
    if (editingRule) {
      setForm(ruleToForm(editingRule));
      setTickerSource('manual');
      setSelectedWatchlistKey('');
    } else {
      setForm(EMPTY);
      setTickerSource('manual');
      setSelectedWatchlistKey('');
    }
    setError('');
  }, [editingRule?.id]);

  useEffect(() => {
    onFormChange?.(form);
  }, [form, onFormChange]);

  const showBucket = form.uiRuleType === 'signal_bucket';

  const ruleTypeOptions = useMemo(
    () => buildRuleTypeOptions(existingRules, form.tickers, form.action, excludeRuleId),
    [existingRules, form.tickers, form.action, excludeRuleId]
  );

  const actionOptions = useMemo(
    () => buildActionOptions(form.uiRuleType, form.signalBuckets),
    [form.uiRuleType, form.signalBuckets]
  );

  useEffect(() => {
    setForm((f) => {
      const nextAction = coalesceActionForRuleType(f.uiRuleType, f.signalBuckets, f.action);
      if (nextAction === f.action) return f;
      const next = { ...f, action: nextAction };
      if (isOpeningPaperAction(nextAction)) {
        next.closeAll = false;
        if (!next.maxPositionQty) next.maxPositionQty = '10';
      }
      if (isClosingPaperAction(nextAction)) {
        next.maxPositionQty = '';
        next.maxPositionValue = '';
      }
      return next;
    });
  }, [form.uiRuleType, form.signalBuckets]);

  const disabledBuckets = useMemo(
    () => getDisabledSignalBuckets(existingRules, form.tickers, form.action, excludeRuleId),
    [existingRules, form.tickers, form.action, excludeRuleId]
  );

  const exitRestrictions = useMemo(
    () =>
      isClosingPaperAction(form.action)
        ? getExitSignalRestrictions(existingRules, form.tickers, form.action, excludeRuleId)
        : { blockedRuleTypes: new Set(), blockedBuckets: new Set() },
    [existingRules, form.tickers, form.action, excludeRuleId]
  );

  const {
    prices: tickerPrices,
    loading: tickerPricesLoading,
    error: tickerPricesError,
    symbols: pricedSymbols
  } = useTickerLatestPrices(form.tickers);

  const blockedRuleTypeKey = useMemo(
    () => [...exitRestrictions.blockedRuleTypes].sort().join(','),
    [exitRestrictions]
  );

  useEffect(() => {
    if (!showBucket || !form.signalBuckets?.length) return;
    const pruned = form.signalBuckets.filter((b) => !disabledBuckets.has(b));
    if (pruned.length !== form.signalBuckets.length) {
      setForm((f) => ({ ...f, signalBuckets: pruned }));
    }
  }, [disabledBuckets, form.signalBuckets, showBucket]);

  useEffect(() => {
    if (!blockedRuleTypeKey) return;
    const blocked = new Set(blockedRuleTypeKey.split(',').filter(Boolean));
    if (!blocked.has(form.uiRuleType)) return;
    const fallback = ruleTypeOptions.find((o) => !o.disabled);
    if (!fallback || fallback.id === form.uiRuleType) return;
    setForm((f) => ({
      ...f,
      uiRuleType: fallback.id,
      signalBuckets: fallback.id === 'signal_bucket' ? f.signalBuckets : []
    }));
  }, [blockedRuleTypeKey, form.uiRuleType, ruleTypeOptions]);

  useEffect(() => {
    if (!tickerSeed?.symbols?.length) return;
    setTickerSource('manual');
    setSelectedWatchlistKey('');
    setForm((f) => ({
      ...f,
      tickers: [
        ...new Set([
          ...f.tickers,
          ...tickerSeed.symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
        ])
      ]
    }));
  }, [tickerSeed?.nonce]);

  useEffect(() => {
    if (!templatePreset || templatePreset === 'custom' || isEditing) return;
    const preset = RULE_FORM_TEMPLATES[templatePreset];
    if (!preset) return;
    setForm((f) => ({
      ...EMPTY,
      ...preset,
      tickers: f.tickers.length ? f.tickers : preset.tickers || []
    }));
    setError('');
  }, [templatePreset, isEditing]);

  const naturalPreview = useMemo(() => buildRuleNaturalLanguagePreview(form), [form]);

  const watchlistDropdownOptions = useMemo(
    () =>
      watchlistOptions.map((o) => ({
        id: o.key,
        label: o.name,
        tag: o.kind === 'user' ? 'user' : o.kind === 'default' ? 'default' : undefined,
        disabled: !o.symbols?.length,
        disabledTitle: !o.symbols?.length ? 'This watchlist has no tickers' : undefined
      })),
    [watchlistOptions]
  );

  const selectedWatchlist = watchlistOptions.find((o) => o.key === selectedWatchlistKey);

  function switchTickerSource(next) {
    setTickerSource(next);
    setError('');
    if (next === 'manual') {
      setSelectedWatchlistKey('');
    } else {
      setForm((f) => ({ ...f, tickers: [] }));
      setSelectedWatchlistKey('');
    }
  }

  function pickWatchlist(key) {
    setSelectedWatchlistKey(key);
    const opt = watchlistOptions.find((o) => o.key === key);
    const symbols = opt?.symbols?.length ? [...opt.symbols] : [];
    setForm((f) => ({ ...f, tickers: symbols }));
    setError('');
  }

  const showThreshold =
    form.uiRuleType === 'price_above' || form.uiRuleType === 'price_below';
  const isOpen = isOpeningPaperAction(form.action);
  const isClose = isClosingPaperAction(form.action);
  const editTicker = form.tickers[0] || '';

  function update(patch) {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (patch.uiRuleType !== undefined || patch.signalBuckets !== undefined) {
        next.action = coalesceActionForRuleType(
          next.uiRuleType,
          next.signalBuckets,
          next.action
        );
      }
      const actionChanged =
        patch.action !== undefined ||
        (patch.uiRuleType !== undefined || patch.signalBuckets !== undefined);
      if (actionChanged) {
        if (isOpeningPaperAction(next.action)) {
          next.closeAll = false;
        }
        if (isClosingPaperAction(next.action)) {
          next.maxPositionQty = '';
          next.maxPositionValue = '';
          next.bracketEnabled = false;
          next.bracketStopLoss = '';
          next.bracketTakeProfit = '';
        }
      }
      return next;
    });
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!onSubmit) return;
    const err = validateRuleForm(form, { existingRules, excludeRuleId });
    if (err) {
      setError(err);
      return;
    }
    if (isEditing) {
      onSubmit(buildRulePayload(form));
    } else {
      const payloads = buildRulePayloads(form);
      onSubmit(payloads.length === 1 ? payloads[0] : payloads);
    }
    if (!isEditing) {
      setForm(EMPTY);
      setTickerSource('manual');
      setSelectedWatchlistKey('');
    }
    setError('');
  }

  function handleCancel() {
    setForm(EMPTY);
    setTickerSource('manual');
    setSelectedWatchlistKey('');
    setError('');
    onCancelEdit?.();
  }

  const qtyField = (
    <label className="paper-field paper-strategy-close-qty__qty paper-strategy-rule-form__field--qty">
      <span className="paper-field__label">Shares per trade</span>
      <input
        type="number"
        className="paper-input"
        min="0.000001"
        step="any"
        value={form.qty}
        onChange={(e) => update({ qty: e.target.value })}
      />
    </label>
  );

  const isModal = variant === 'modal';
  const showInlineActions = !hideActions;

  const submitBtnClass =
    'paper-btn' +
    (isEditing
      ? ' paper-btn--submit-entry'
      : isOpeningPaperAction(form.action)
        ? ' paper-btn--submit-entry'
        : ' paper-btn--submit-exit');

  return (
    <form
      id={formId}
      className={'paper-strategy-rule-form' + (isModal ? ' paper-strategy-rule-form--modal' : '')}
      onSubmit={handleSubmit}
    >
      {isEditing && !isModal ? (
        <p className="paper-strategy-muted paper-strategy-rule-form__hint">
          Editing rule for <strong>{editingRule.ticker}</strong>
        </p>
      ) : null}
      {isModal ? (
        <div className="paper-rule-preview" role="status" aria-live="polite">
          <span className="paper-rule-preview__label">Rule preview</span>
          <p className="paper-rule-preview__text">{naturalPreview}</p>
        </div>
      ) : null}
      {showScheduleNote ? (
        <p className="paper-strategy-muted paper-strategy-rule-form__schedule-note">{STRATEGY_SCHEDULE_HELP}</p>
      ) : null}
      <div className="paper-strategy-rule-form__layout">
        <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--tickers">
          <div className="paper-field paper-field--tickers paper-strategy-rule-form__field--tickers">
            <div className="paper-strategy-ticker-source">
              <span className="paper-field__label">Tickers</span>
              {!isEditing ? (
                <div className="paper-strategy-ticker-source__tabs" role="tablist" aria-label="Ticker source">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tickerSource === 'manual'}
                    className={
                      'paper-strategy-ticker-source__tab' +
                      (tickerSource === 'manual' ? ' paper-strategy-ticker-source__tab--active' : '')
                    }
                    disabled={busy}
                    onClick={() => switchTickerSource('manual')}
                  >
                    Pick tickers
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tickerSource === 'watchlist'}
                    className={
                      'paper-strategy-ticker-source__tab' +
                      (tickerSource === 'watchlist' ? ' paper-strategy-ticker-source__tab--active' : '')
                    }
                    disabled={busy}
                    onClick={() => switchTickerSource('watchlist')}
                  >
                    Use watchlist
                  </button>
                </div>
              ) : null}
            </div>
            {isEditing || tickerSource === 'manual' ? (
              <TickerSymbolCombobox
                multiple={!isEditing}
                symbol={editTicker}
                onSymbolChange={(sym) => {
                  setSelectedWatchlistKey('');
                  update({ tickers: sym ? [String(sym).trim().toUpperCase()] : [] });
                }}
                symbols={form.tickers}
                onSymbolsChange={(symbols) => {
                  setSelectedWatchlistKey('');
                  update({ tickers: symbols });
                }}
                inputId="paper-strategy-ticker"
                placeholder="e.g. AAPL, MSFT"
              />
            ) : (
              <>
                <ThemedDropdown
                  className="paper-strategy-rule-form__dd"
                  wideLabel
                  value={selectedWatchlistKey}
                  options={watchlistDropdownOptions}
                  onChange={pickWatchlist}
                  disabled={busy || watchlistsLoading || !watchlistDropdownOptions.length}
                  ariaLabelPrefix="Watchlist"
                  labelFallback={watchlistsLoading ? 'Loading watchlists…' : 'Select watchlist'}
                />
                {selectedWatchlist ? (
                  <p className="paper-strategy-muted paper-strategy-ticker-source__hint">
                    {form.tickers.length
                      ? `${form.tickers.length} ticker${form.tickers.length === 1 ? '' : 's'} from ${selectedWatchlist.name}`
                      : `No tickers in ${selectedWatchlist.name}`}
                    {selectedWatchlist.kind ? (
                      <>
                        {' · '}
                        <span className="paper-strategy-ticker-source__tag">
                          {watchlistKindTag(selectedWatchlist.kind)}
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        {form.tickers.length > 0 ? (
          <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--prices">
            <div className="paper-strategy-ticker-prices" role="status" aria-live="polite">
              <span className="paper-strategy-ticker-prices__label">Last price (daily close)</span>
              {tickerPricesLoading ? (
                <span className="paper-strategy-muted">Loading…</span>
              ) : tickerPricesError ? (
                <span className="paper-strategy-muted">{tickerPricesError}</span>
              ) : (
                <ul className="paper-strategy-ticker-prices__list">
                  {pricedSymbols.map((sym) => (
                    <li key={sym} className="paper-strategy-ticker-prices__item">
                      <span className="paper-strategy-ticker-prices__sym">{sym}</span>
                      <span className="paper-strategy-ticker-prices__px">
                        {formatLatestClosePrice(tickerPrices[sym])}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--primary">
          <label className="paper-field paper-strategy-rule-form__field--rule-type">
            <span className="paper-field__label">Rule type</span>
            <ThemedDropdown
              className="paper-strategy-rule-form__dd"
              wideLabel
              value={form.uiRuleType}
              options={ruleTypeOptions}
              onChange={(id) =>
                update({
                  uiRuleType: id,
                  signalBuckets: id === 'signal_bucket' ? form.signalBuckets : []
                })
              }
              ariaLabelPrefix="Rule type"
              labelFallback="Rule type"
            />
          </label>
        </div>

        <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--secondary">
          <label className="paper-field paper-strategy-rule-form__field--action">
            <span className="paper-field__label">Action</span>
            <ThemedDropdown
              className="paper-strategy-rule-form__dd"
              value={form.action}
              options={actionOptions}
              onChange={(id) => update({ action: id })}
              ariaLabelPrefix="Action"
              labelFallback="Action"
            />
          </label>

          {isClose ? (
            <div className="paper-field paper-strategy-close-qty paper-strategy-rule-form__field--close-qty">
              <div className="paper-strategy-close-qty__row">
                <label
                  className={
                    'paper-field paper-strategy-close-qty__close' +
                    (form.closeAll ? ' paper-strategy-close-qty__close--active' : '')
                  }
                >
                  <span className="paper-field__label">Close all</span>
                  <span className="paper-strategy-close-qty__control">
                    <input
                      type="checkbox"
                      className="paper-strategy-close-qty__check"
                      checked={form.closeAll}
                      onChange={(e) => update({ closeAll: e.target.checked })}
                    />
                    <span className="paper-strategy-close-qty__control-text">Close all (ALL)</span>
                  </span>
                </label>
                {!form.closeAll ? qtyField : null}
              </div>
            </div>
          ) : (
            qtyField
          )}

          {showThreshold ? (
            <label className="paper-field paper-strategy-rule-form__field--threshold">
              <span className="paper-field__label">Threshold ($)</span>
              <input
                type="number"
                className="paper-input"
                min="0"
                step="0.01"
                value={form.threshold_value}
                onChange={(e) => update({ threshold_value: e.target.value })}
              />
            </label>
          ) : null}
        </div>

        {isOpen ? (
          <>
            <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--limits">
              <label className="paper-field paper-strategy-rule-form__field--max">
                <span className="paper-field__label">Max shares owned</span>
                <input
                  type="number"
                  className="paper-input"
                  min="0.000001"
                  step="any"
                  value={form.maxPositionQty}
                  onChange={(e) => update({ maxPositionQty: e.target.value })}
                  placeholder="Stop buying at this size"
                />
              </label>
              <label className="paper-field paper-strategy-rule-form__field--max-value">
                <span className="paper-field__label">Max dollar limit (optional)</span>
                <input
                  type="number"
                  className="paper-input"
                  min="0.01"
                  step="0.01"
                  value={form.maxPositionValue}
                  onChange={(e) => update({ maxPositionValue: e.target.value })}
                  placeholder="e.g. 5000"
                />
              </label>
            </div>
            <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--full">
              <div className="paper-bracket paper-bracket--strategy">
                <label className="paper-bracket__toggle">
                  <input
                    type="checkbox"
                    checked={form.bracketEnabled}
                    onChange={(e) => update({ bracketEnabled: e.target.checked })}
                    disabled={busy}
                  />
                  <span>Set auto-exits (stop-loss / take-profit)</span>
                </label>
                <p className="paper-bracket__hint">
                  After this rule buys or shorts, optional exit orders are placed. Filling one
                  cancels the other.
                </p>
                {form.bracketEnabled ? (
                  <div className="paper-bracket__fields">
                    <label className="paper-field">
                      <span className="paper-field__label">Stop-loss price</span>
                      <input
                        type="number"
                        className="paper-input"
                        min="0"
                        step="0.01"
                        value={form.bracketStopLoss}
                        onChange={(e) => update({ bracketStopLoss: e.target.value })}
                        placeholder="Optional"
                        disabled={busy}
                      />
                    </label>
                    <label className="paper-field">
                      <span className="paper-field__label">Take-profit price</span>
                      <input
                        type="number"
                        className="paper-input"
                        min="0"
                        step="0.01"
                        value={form.bracketTakeProfit}
                        onChange={(e) => update({ bracketTakeProfit: e.target.value })}
                        placeholder="Optional"
                        disabled={busy}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {showBucket ? (
          <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--full">
            <SignalBucketMultiSelect
              selected={form.signalBuckets}
              disabledBuckets={disabledBuckets}
              exitBlockedBuckets={exitRestrictions.blockedBuckets}
              busy={busy}
              onChange={(signalBuckets) => update({ signalBuckets })}
            />
          </div>
        ) : null}
      </div>
      {isOpen ? (
        <p className="paper-strategy-muted paper-strategy-rule-form__hint">
          {hideActions
            ? 'Buys stop when you hit max shares or max dollar limit — whichever comes first.'
            : 'Buys stop when you hit max shares or max dollar limit — whichever comes first. Click Add rule when ready.'}
        </p>
      ) : null}
      {isClose && form.closeAll ? (
        <p className="paper-strategy-muted paper-strategy-rule-form__hint">
          On trigger, closes your full open position for each ticker (all long shares for Sell, all
          short shares for Cover).
        </p>
      ) : null}
      {error ? <p className="paper-strategy-err">{error}</p> : null}
      {showInlineActions ? (
        <div className="paper-strategy-rule-form__actions">
          {isEditing ? (
            <button type="button" className="paper-btn paper-btn--danger" disabled={busy} onClick={handleCancel}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className={submitBtnClass} disabled={busy}>
            {busy ? 'Saving…' : isEditing ? 'Save changes' : submitLabel}
          </button>
        </div>
      ) : null}
    </form>
  );
}
