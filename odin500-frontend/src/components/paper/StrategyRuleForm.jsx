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
  buildEntryRules,
  buildRuleNaturalLanguagePreview,
  buildRulePayload,
  buildRulePayloads,
  buildRuleTypeOptions,
  coalesceActionForRuleType,
  deriveExitAction,
  getAllowedActionsForRuleType,
  getDisabledSignalBuckets,
  getExitSignalRestrictions,
  RULE_FORM_TEMPLATES,
  deriveLimitModeFromForm,
  deriveTradeSideFromAction,
  signalBucketsForTradeSide,
  ruleToForm,
  validateRuleForm
} from './strategyRuleUtils.js';
import { paperActionLabel } from './paperActionLabels.js';
import { STRATEGY_SCHEDULE_HELP } from '../../utils/strategySchedule.js';

const EMPTY = {
  uiRuleType: 'signal_bucket',
  tradeSide: 'long',
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
  bracketTakeProfit: '',
  exitEnabled: true,
  exitUiRuleType: 'signal_bucket',
  exitCloseAll: true,
  exitQty: '1',
  exitThreshold: '',
  allotFullCap: true,
  exitSignalBuckets: []
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
  const [limitMode, setLimitMode] = useState('shares');
  const [selectedWatchlistKey, setSelectedWatchlistKey] = useState('');
  const { options: watchlistOptions, loading: watchlistsLoading } = useWatchlistOptions();
  const isEditing = Boolean(editingRule?.id);
  const excludeRuleId = editingRule?.id ?? editingRule?._localId ?? null;
  const simplifiedLayout = variant === 'modal' && !isEditing;
  const tradeSide = form.tradeSide || deriveTradeSideFromAction(form.action);

  useEffect(() => {
    if (editingRule) {
      const loaded = ruleToForm(editingRule);
      const mode = deriveLimitModeFromForm(loaded);
      if (mode === 'dollars') {
        loaded.maxPositionQty = '';
      } else {
        loaded.maxPositionValue = '';
      }
      setForm(loaded);
      setLimitMode(mode);
      setTickerSource('manual');
      setSelectedWatchlistKey('');
    } else {
      setForm({
        ...EMPTY,
        allotFullCap: variant === 'modal'
      });
      setLimitMode('shares');
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
        const hasDollarCap =
          next.maxPositionValue !== '' &&
          Number.isFinite(Number(next.maxPositionValue)) &&
          Number(next.maxPositionValue) > 0;
        if (!hasDollarCap && !next.maxPositionQty) next.maxPositionQty = '10';
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

  function switchTradeSide(next) {
    if (next === tradeSide) return;
    setError('');
    setForm((f) => ({
      ...f,
      tradeSide: next,
      action: next === 'long' ? 'BTO' : 'STO',
      uiRuleType: 'signal_bucket',
      exitUiRuleType: 'signal_bucket',
      exitEnabled: true,
      exitCloseAll: true,
      signalBuckets: [],
      exitSignalBuckets: []
    }));
  }

  const entrySignalBuckets = useMemo(
    () => signalBucketsForTradeSide(tradeSide, 'entry'),
    [tradeSide]
  );

  const entrySignalLabel = tradeSide === 'long' ? 'Entry long signals' : 'Entry short signals';
  const exitSignalLabel = tradeSide === 'long' ? 'Exit long signals' : 'Exit short signals';

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

  function switchLimitMode(next) {
    if (next === limitMode) return;
    setLimitMode(next);
    setError('');
    if (next === 'shares') {
      setForm((f) => ({
        ...f,
        maxPositionValue: '',
        maxPositionQty: f.maxPositionQty || '10'
      }));
    } else {
      setForm((f) => ({
        ...f,
        maxPositionQty: '',
        maxPositionValue: f.maxPositionValue || ''
      }));
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

  const showExitSection = isOpen && !isEditing && !simplifiedLayout;
  const exitAction = deriveExitAction(form.action);
  const exitActionLabel = exitAction ? paperActionLabel(exitAction) : '';

  const entryPseudoRules = useMemo(
    () => (showExitSection || simplifiedLayout ? buildEntryRules(form) : []),
    [showExitSection, simplifiedLayout, form]
  );

  const exitRuleTypeOptions = useMemo(() => {
    if (!showExitSection && !simplifiedLayout) return [];
    return buildRuleTypeOptions(entryPseudoRules, form.tickers, exitAction, null).filter((opt) =>
      getAllowedActionsForRuleType(
        opt.id,
        opt.id === 'signal_bucket' ? form.exitSignalBuckets : [],
        exitAction
      ).includes(exitAction)
    );
  }, [showExitSection, simplifiedLayout, entryPseudoRules, form.tickers, form.exitSignalBuckets, exitAction]);

  const exitDisabledBuckets = useMemo(
    () =>
      showExitSection || simplifiedLayout
        ? getDisabledSignalBuckets(entryPseudoRules, form.tickers, exitAction, null)
        : new Set(),
    [showExitSection, simplifiedLayout, entryPseudoRules, form.tickers, exitAction]
  );

  const exitBlockedBuckets = useMemo(
    () =>
      showExitSection || simplifiedLayout
        ? getExitSignalRestrictions(entryPseudoRules, form.tickers, exitAction, null).blockedBuckets
        : new Set(),
    [showExitSection, simplifiedLayout, entryPseudoRules, form.tickers, exitAction]
  );

  const exitEntryBlockedBuckets = useMemo(
    () => new Set(form.signalBuckets),
    [form.signalBuckets]
  );

  const exitSelectDisabledBuckets = useMemo(() => {
    const combined = new Set(exitDisabledBuckets);
    for (const b of exitEntryBlockedBuckets) combined.add(b);
    return combined;
  }, [exitDisabledBuckets, exitEntryBlockedBuckets]);

  useEffect(() => {
    if (!simplifiedLayout) return;
    const blocked = new Set(form.signalBuckets);
    const pruned = form.exitSignalBuckets.filter((b) => !blocked.has(b));
    if (pruned.length !== form.exitSignalBuckets.length) {
      setForm((f) => ({ ...f, exitSignalBuckets: pruned }));
    }
  }, [form.signalBuckets, simplifiedLayout]);

  const exitShowThreshold =
    form.exitUiRuleType === 'price_above' || form.exitUiRuleType === 'price_below';
  const exitShowBucket = form.exitUiRuleType === 'signal_bucket';

  useEffect(() => {
    if (!showExitSection || !form.exitEnabled) return;
    const current = exitRuleTypeOptions.find((o) => o.id === form.exitUiRuleType);
    if (current && !current.disabled) return;
    const fallback = exitRuleTypeOptions.find((o) => !o.disabled);
    if (!fallback || fallback.id === form.exitUiRuleType) return;
    setForm((f) => ({
      ...f,
      exitUiRuleType: fallback.id,
      exitSignalBuckets: fallback.id === 'signal_bucket' ? f.exitSignalBuckets : []
    }));
  }, [showExitSection, form.exitEnabled, form.exitUiRuleType, exitRuleTypeOptions]);

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
          const hasDollarCap =
            next.maxPositionValue !== '' &&
            Number.isFinite(Number(next.maxPositionValue)) &&
            Number(next.maxPositionValue) > 0;
          if (!hasDollarCap && !next.maxPositionQty) next.maxPositionQty = '10';
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
      setLimitMode('shares');
      setTickerSource('manual');
      setSelectedWatchlistKey('');
    }
    setError('');
  }

  function handleCancel() {
    setForm(EMPTY);
    setLimitMode('shares');
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

        {simplifiedLayout ? (
          <>
            <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--side">
              <div className="paper-field paper-strategy-rule-form__field--side">
                <span className="paper-field__label">Position side</span>
                <div className="paper-strategy-ticker-source__tabs" role="tablist" aria-label="Position side">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tradeSide === 'long'}
                    className={
                      'paper-strategy-ticker-source__tab' +
                      (tradeSide === 'long' ? ' paper-strategy-ticker-source__tab--active' : '')
                    }
                    disabled={busy}
                    onClick={() => switchTradeSide('long')}
                  >
                    Long
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tradeSide === 'short'}
                    className={
                      'paper-strategy-ticker-source__tab' +
                      (tradeSide === 'short' ? ' paper-strategy-ticker-source__tab--active' : '')
                    }
                    disabled={busy}
                    onClick={() => switchTradeSide('short')}
                  >
                    Short
                  </button>
                </div>
              </div>
            </div>

            <div className="paper-strategy-signal-grid">
              <SignalBucketMultiSelect
                label={entrySignalLabel}
                selected={form.signalBuckets}
                allowedBuckets={entrySignalBuckets}
                disabledBuckets={disabledBuckets}
                exitBlockedBuckets={exitRestrictions.blockedBuckets}
                busy={busy}
                showPills
                onChange={(signalBuckets) =>
                  update({
                    uiRuleType: 'signal_bucket',
                    signalBuckets,
                    exitEnabled: true,
                    exitCloseAll: true
                  })
                }
              />
              <SignalBucketMultiSelect
                label={exitSignalLabel}
                selected={form.exitSignalBuckets}
                disabledBuckets={exitSelectDisabledBuckets}
                entryBlockedBuckets={exitEntryBlockedBuckets}
                exitBlockedBuckets={exitBlockedBuckets}
                busy={busy}
                showPills
                onChange={(exitSignalBuckets) =>
                  update({
                    exitUiRuleType: 'signal_bucket',
                    exitEnabled: true,
                    exitCloseAll: true,
                    exitSignalBuckets
                  })
                }
              />
            </div>

            <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--limits">
              <div className="paper-field paper-strategy-rule-form__field--position-limit">
                <div className="paper-strategy-ticker-source">
                  <span className="paper-field__label">Position limit</span>
                  <div
                    className="paper-strategy-ticker-source__tabs"
                    role="tablist"
                    aria-label="Position limit type"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={limitMode === 'shares'}
                      className={
                        'paper-strategy-ticker-source__tab' +
                        (limitMode === 'shares' ? ' paper-strategy-ticker-source__tab--active' : '')
                      }
                      disabled={busy}
                      onClick={() => switchLimitMode('shares')}
                    >
                      Max shares
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={limitMode === 'dollars'}
                      className={
                        'paper-strategy-ticker-source__tab' +
                        (limitMode === 'dollars' ? ' paper-strategy-ticker-source__tab--active' : '')
                      }
                      disabled={busy}
                      onClick={() => switchLimitMode('dollars')}
                    >
                      Max amount
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  className="paper-input"
                  min={limitMode === 'shares' ? '0.000001' : '0.01'}
                  step={limitMode === 'shares' ? 'any' : '0.01'}
                  value={limitMode === 'shares' ? form.maxPositionQty : form.maxPositionValue}
                  onChange={(e) =>
                    limitMode === 'shares'
                      ? update({ maxPositionQty: e.target.value })
                      : update({ maxPositionValue: e.target.value })
                  }
                  placeholder={
                    limitMode === 'shares' ? 'Stop buying at this size' : 'e.g. 5000'
                  }
                  disabled={busy}
                  aria-label={
                    limitMode === 'shares' ? 'Max shares owned' : 'Max position amount in dollars'
                  }
                />
                {limitMode === 'dollars' ? (
                  <p className="paper-strategy-muted paper-strategy-rule-form__limit-note">
                    This amount is allotted to every symbol you selected (not split across tickers).
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
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
              <div className="paper-field paper-strategy-rule-form__field--position-limit">
                <div className="paper-strategy-ticker-source">
                  <span className="paper-field__label">Position limit</span>
                  <div
                    className="paper-strategy-ticker-source__tabs"
                    role="tablist"
                    aria-label="Position limit type"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={limitMode === 'shares'}
                      className={
                        'paper-strategy-ticker-source__tab' +
                        (limitMode === 'shares' ? ' paper-strategy-ticker-source__tab--active' : '')
                      }
                      disabled={busy}
                      onClick={() => switchLimitMode('shares')}
                    >
                      Max shares
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={limitMode === 'dollars'}
                      className={
                        'paper-strategy-ticker-source__tab' +
                        (limitMode === 'dollars' ? ' paper-strategy-ticker-source__tab--active' : '')
                      }
                      disabled={busy}
                      onClick={() => switchLimitMode('dollars')}
                    >
                      Max amount
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  className="paper-input"
                  min={limitMode === 'shares' ? '0.000001' : '0.01'}
                  step={limitMode === 'shares' ? 'any' : '0.01'}
                  value={limitMode === 'shares' ? form.maxPositionQty : form.maxPositionValue}
                  onChange={(e) =>
                    limitMode === 'shares'
                      ? update({ maxPositionQty: e.target.value })
                      : update({ maxPositionValue: e.target.value })
                  }
                  placeholder={
                    limitMode === 'shares' ? 'Stop buying at this size' : 'e.g. 5000'
                  }
                  disabled={busy}
                  aria-label={
                    limitMode === 'shares' ? 'Max shares owned' : 'Max position amount in dollars'
                  }
                />
              </div>
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

        {showExitSection ? (
          <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--full">
            <div className="paper-bracket paper-bracket--strategy paper-exit-rule">
              <label className="paper-bracket__toggle">
                <input
                  type="checkbox"
                  checked={form.exitEnabled}
                  onChange={(e) => update({ exitEnabled: e.target.checked })}
                  disabled={busy}
                />
                <span>
                  Also add a {exitActionLabel} rule for the same ticker{form.tickers.length > 1 ? 's' : ''}
                </span>
              </label>
              <p className="paper-bracket__hint">
                Define the exit in the same step — no need to create a separate {exitActionLabel} rule.
                It triggers on its own condition (not just a fixed price like auto-exits).
              </p>
              {form.exitEnabled ? (
                <div className="paper-exit-rule__fields">
                  <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--secondary">
                    <label className="paper-field paper-strategy-rule-form__field--rule-type">
                      <span className="paper-field__label">
                        {exitAction === 'BTC' ? 'Cover when…' : 'Sell when…'}
                      </span>
                      <ThemedDropdown
                        className="paper-strategy-rule-form__dd"
                        wideLabel
                        value={form.exitUiRuleType}
                        options={exitRuleTypeOptions}
                        onChange={(id) =>
                          update({
                            exitUiRuleType: id,
                            exitSignalBuckets: id === 'signal_bucket' ? form.exitSignalBuckets : []
                          })
                        }
                        ariaLabelPrefix="Sell rule type"
                        labelFallback="Sell condition"
                      />
                    </label>
                    <div className="paper-field paper-exit-rule__action">
                      <span className="paper-field__label">Action</span>
                      <span className="paper-exit-rule__action-value">{exitActionLabel}</span>
                    </div>
                  </div>

                  <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--secondary">
                    <div className="paper-field paper-strategy-close-qty paper-strategy-rule-form__field--close-qty">
                      <div className="paper-strategy-close-qty__row">
                        <label
                          className={
                            'paper-field paper-strategy-close-qty__close' +
                            (form.exitCloseAll ? ' paper-strategy-close-qty__close--active' : '')
                          }
                        >
                          <span className="paper-field__label">Close all</span>
                          <span className="paper-strategy-close-qty__control">
                            <input
                              type="checkbox"
                              className="paper-strategy-close-qty__check"
                              checked={form.exitCloseAll}
                              onChange={(e) => update({ exitCloseAll: e.target.checked })}
                              disabled={busy}
                            />
                            <span className="paper-strategy-close-qty__control-text">
                              Close all ({exitAction})
                            </span>
                          </span>
                        </label>
                        {!form.exitCloseAll ? (
                          <label className="paper-field paper-strategy-close-qty__qty paper-strategy-rule-form__field--qty">
                            <span className="paper-field__label">Shares per exit</span>
                            <input
                              type="number"
                              className="paper-input"
                              min="0.000001"
                              step="any"
                              value={form.exitQty}
                              onChange={(e) => update({ exitQty: e.target.value })}
                              disabled={busy}
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>

                    {exitShowThreshold ? (
                      <label className="paper-field paper-strategy-rule-form__field--threshold">
                        <span className="paper-field__label">Threshold ($)</span>
                        <input
                          type="number"
                          className="paper-input"
                          min="0"
                          step="0.01"
                          value={form.exitThreshold}
                          onChange={(e) => update({ exitThreshold: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                    ) : null}
                  </div>

                  {exitShowBucket ? (
                    <div className="paper-strategy-rule-form__row paper-strategy-rule-form__row--full">
                      <SignalBucketMultiSelect
                        selected={form.exitSignalBuckets}
                        disabledBuckets={exitDisabledBuckets}
                        exitBlockedBuckets={exitBlockedBuckets}
                        busy={busy}
                        onChange={(exitSignalBuckets) => update({ exitSignalBuckets })}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
          </>
        )}
      </div>
      {simplifiedLayout ? (
        <p className="paper-strategy-muted paper-strategy-rule-form__hint">
          {tradeSide === 'long' ? 'Buys' : 'Shorts'} when entry signals fire, up to your max position limit.
          {' '}
          {tradeSide === 'long' ? 'Sells' : 'Covers'} the full position when exit signals fire.
        </p>
      ) : null}
      {isOpen && !simplifiedLayout ? (
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
