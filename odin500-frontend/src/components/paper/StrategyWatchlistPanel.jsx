'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../../utils/apiOrigin.js';
import { fetchWithAuth } from '../../store/apiStore.js';
import { useWatchlistOptions } from '../../hooks/useWatchlistOptions.js';
import { pickWatchlistKeyForMerged, watchlistKindTag } from '../../utils/watchlistOptions.js';
import { buildWatchlistQuickRule, ruleSummaryInline, ruleTickerKey } from './strategyRuleUtils.js';

function IcoChevronDown({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WatchlistKindTag({ kind }) {
  const label = watchlistKindTag(kind);
  if (!label) return null;
  return (
    <span
      className={
        'wl-flyout__select-item-tag' +
        (kind === 'user' ? ' wl-flyout__select-item-tag--user' : ' wl-flyout__select-item-tag--default')
      }
    >
      {label}
    </span>
  );
}

function IcoRuleExists() {
  return (
    <svg
      className="paper-strategy-wl__rule-tick"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.18" />
      <path
        d="M8 12.5l2.5 2.5 5.5-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function bucketToneClass(bucket) {
  const b = String(bucket || 'N').toUpperCase();
  if (b.startsWith('L')) return 'paper-strategy-wl__bucket--long';
  if (b.startsWith('S')) return 'paper-strategy-wl__bucket--short';
  return 'paper-strategy-wl__bucket--neutral';
}

function sideFromBucket(bucket) {
  const b = String(bucket || 'N').toUpperCase();
  if (b.startsWith('L')) return 'long';
  if (b.startsWith('S')) return 'short';
  return 'long';
}

function WatchlistTickerList({ rows, rules, busy, onAddRule, onAddToForm, onScrollToRules, onScrollToRule }) {
  const [selected, setSelected] = useState(() => new Set());
  const checkAllRef = useRef(null);

  const rulesByTicker = useMemo(() => {
    const map = new Map();
    for (const rule of rules || []) {
      const key = ruleTickerKey(rule);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(rule);
    }
    return map;
  }, [rules]);

  useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.symbol));
  const someSelected = rows.some((r) => selected.has(r.symbol));
  const checkedCount = rows.filter((r) => selected.has(r.symbol)).length;

  useEffect(() => {
    const el = checkAllRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  function toggleAll(checked) {
    if (checked) {
      setSelected(new Set(rows.map((r) => r.symbol)));
    } else {
      setSelected(new Set());
    }
  }

  function toggleOne(symbol, checked) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(symbol);
      else next.delete(symbol);
      return next;
    });
  }

  async function addRulesForChecked() {
    const checked = rows.filter((r) => selected.has(r.symbol));
    if (!checked.length) return;
    await onAddRule(checked);
    onScrollToRules?.();
  }

  function addFormForChecked() {
    const syms = rows.filter((r) => selected.has(r.symbol)).map((r) => r.symbol);
    if (!syms.length) return;
    onAddToForm(syms);
  }

  return (
    <div className="paper-strategy-wl__panel">
      <div className="paper-strategy-wl__toolbar">
        <div className="paper-strategy-wl__col-actions">
          <button
            type="button"
            className="paper-btn paper-btn--ghost paper-btn--sm"
            disabled={busy || checkedCount === 0}
            onClick={() => void addRulesForChecked()}
            title="Add checked tickers as strategy rules"
          >
            + Add rule
          </button>
          <button
            type="button"
            className="paper-btn paper-btn--ghost paper-btn--sm"
            disabled={busy || checkedCount === 0}
            onClick={addFormForChecked}
            title="Add checked tickers to the rule form"
          >
            + Form
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="paper-strategy-muted">No tickers in this watchlist.</p>
      ) : (
        <div className="paper-strategy-wl__table">
          <div className="paper-strategy-wl__table-scroll">
            <div className="paper-strategy-wl__table-head" role="row">
              <div className="paper-strategy-wl__th paper-strategy-wl__th--ticker" role="columnheader">
                <label className="paper-strategy-wl__check-all" title="Select all">
                  <input
                    ref={checkAllRef}
                    type="checkbox"
                    className="paper-strategy-wl__checkbox"
                    checked={allSelected}
                    disabled={busy || rows.length === 0}
                    onChange={(e) => toggleAll(e.target.checked)}
                    aria-label="Select all tickers"
                  />
                </label>
                <span>Ticker</span>
              </div>
              <div className="paper-strategy-wl__th paper-strategy-wl__th--signal" role="columnheader">
                Signal
              </div>
              <div className="paper-strategy-wl__th paper-strategy-wl__th--rule" role="columnheader">
                Rule
              </div>
            </div>
            <ul className="paper-strategy-wl__list">
              {rows.map((row) => {
                const tickerRules = rulesByTicker.get(row.symbol) || [];
                const firstRule = tickerRules[0];
                const extraCount = tickerRules.length > 1 ? tickerRules.length - 1 : 0;
                const isChecked = selected.has(row.symbol);
                const bucket = String(row.bucket || 'N').toUpperCase();
                return (
                  <li key={row.symbol} className="paper-strategy-wl__row">
                    <div className="paper-strategy-wl__cell paper-strategy-wl__cell--ticker">
                      <label className="paper-strategy-wl__row-check">
                        <input
                          type="checkbox"
                          className="paper-strategy-wl__checkbox"
                          checked={isChecked}
                          disabled={busy}
                          onChange={(e) => toggleOne(row.symbol, e.target.checked)}
                          aria-label={`Select ${row.symbol}`}
                        />
                      </label>
                      <span className="paper-strategy-wl__sym">{row.symbol}</span>
                    </div>
                    <div className="paper-strategy-wl__cell paper-strategy-wl__cell--signal">
                      <span className={'paper-strategy-wl__bucket ' + bucketToneClass(bucket)}>{bucket}</span>
                    </div>
                    <div className="paper-strategy-wl__cell paper-strategy-wl__cell--rule">
                      {firstRule ? (
                        <button
                          type="button"
                          className="paper-strategy-wl__rule-link"
                          disabled={busy}
                          onClick={() => onScrollToRule?.(tickerRules.map((r) => r.id))}
                          title={
                            extraCount > 0
                              ? `View all ${tickerRules.length} rules in Active rules`
                              : 'View rule in Active rules'
                          }
                          aria-label={`View ${tickerRules.length} rule${
                            tickerRules.length === 1 ? '' : 's'
                          } for ${row.symbol}: ${ruleSummaryInline(firstRule)}${
                            extraCount > 0 ? `, plus ${extraCount} more` : ''
                          }`}
                        >
                          <IcoRuleExists />
                          <span className="paper-strategy-wl__rule-link-text">
                            {ruleSummaryInline(firstRule)}
                          </span>
                          {extraCount > 0 ? (
                            <span className="paper-strategy-wl__rule-more" aria-hidden>
                              +{extraCount}
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        <span className="paper-strategy-wl__rule-empty" aria-hidden>
                          —
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function StrategyWatchlistPanel({
  savedWatchlistKey = '',
  rules = [],
  busy = false,
  saveError = '',
  onWatchlistKeyChange,
  onAddRule,
  onAddTickersToForm,
  onScrollToRules,
  onScrollToRule
}) {
  const { options, loading: optionsLoading, error: optionsError } = useWatchlistOptions();
  const [selectedKey, setSelectedKey] = useState('');
  const [ddOpen, setDdOpen] = useState(false);
  const [leaders, setLeaders] = useState({ tickers: [], watchlist: null });
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalsError, setSignalsError] = useState('');
  const ddRef = useRef(null);

  useEffect(() => {
    if (!options.length) return;
    setSelectedKey((prev) => pickWatchlistKeyForMerged(options, savedWatchlistKey || prev));
  }, [options, savedWatchlistKey]);

  const selected = options.find((o) => o.key === selectedKey) || options[0];

  const loadSignals = useCallback(async (key) => {
    if (!key) {
      setLeaders({ tickers: [], watchlist: null });
      return;
    }
    setSignalsLoading(true);
    setSignalsError('');
    try {
      const res = await fetchWithAuth(
        apiUrl(
          `/api/paper/strategies/watchlist-signals?watchlist_key=${encodeURIComponent(key)}&limit=all`
        ),
        { method: 'GET' }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to load signals');
      setLeaders({
        tickers: payload.tickers || [],
        watchlist: payload.watchlist || null
      });
    } catch (err) {
      setSignalsError(err?.message || 'Failed to load watchlist signals');
      setLeaders({ tickers: [], watchlist: null });
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedKey) return;
    void loadSignals(selectedKey);
  }, [selectedKey, loadSignals]);

  const tickerRows = useMemo(() => {
    if (leaders.tickers?.length) {
      return leaders.tickers.map((r) => ({
        symbol: String(r.symbol || '').trim().toUpperCase(),
        bucket: String(r.bucket || 'N').toUpperCase()
      }));
    }
    const signalMap = new Map();
    const symbols = selected?.symbols?.length ? selected.symbols : [];
    return symbols
      .map((symbol) => ({
        symbol: String(symbol || '').trim().toUpperCase(),
        bucket: signalMap.get(symbol) || 'N'
      }))
      .filter((r) => r.symbol)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [leaders.tickers, selected?.symbols]);

  useEffect(() => {
    if (!ddOpen) return;
    const onDoc = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [ddOpen]);

  function pickWatchlist(key) {
    setSelectedKey(key);
    setDdOpen(false);
    if (key !== savedWatchlistKey) {
      onWatchlistKeyChange?.(key);
    }
  }

  async function handleAddRules(rows) {
    const existing = new Set((rules || []).map(ruleTickerKey));
    for (const row of rows) {
      const sym = String(row.symbol || row).trim().toUpperCase();
      if (!sym || existing.has(sym)) continue;
      await onAddRule?.(buildWatchlistQuickRule(sym, sideFromBucket(row.bucket)));
      existing.add(sym);
    }
  }

  return (
    <section className="paper-strategy-section paper-strategy-wl" data-tour="paper-strategy-watchlist">
      <div className="paper-strategy-section__head">
        <h4 className="paper-strategy-section__title">Watchlist signals</h4>
        <p className="paper-strategy-section__desc">
          Pick a watchlist to see each ticker&apos;s Odin signal (L1–L3, S1–S3, or N). Tickers with rules show a
          summary on the right — tap to jump to Active rules.
        </p>
      </div>

      <div className="paper-strategy-wl__picker" ref={ddRef}>
        <span className="paper-field__label">Watchlist</span>
        <div className="wl-flyout__select-wrap">
          <button
            type="button"
            className="wl-flyout__select paper-strategy-wl__select"
            aria-haspopup="listbox"
            aria-expanded={ddOpen}
            disabled={optionsLoading || !options.length}
            onClick={() => setDdOpen((v) => !v)}
          >
            {selected ? (
              <span className="paper-strategy-wl__select-label">
                <WatchlistKindTag kind={selected.kind} />
                <span className="wl-flyout__select-item-name">{selected.name}</span>
              </span>
            ) : (
              <span className="paper-strategy-wl__select-label">{optionsLoading ? 'Loading…' : '—'}</span>
            )}
            <IcoChevronDown className="wl-flyout__select-chev" />
          </button>
          {ddOpen && options.length > 0 ? (
            <ul className="wl-flyout__select-menu paper-strategy-wl__menu" role="listbox">
              {options.map((o) => (
                <li key={o.key} role="option" aria-selected={o.key === selectedKey}>
                  <button
                    type="button"
                    className={
                      'wl-flyout__select-item' + (o.key === selectedKey ? ' wl-flyout__select-item--active' : '')
                    }
                    onClick={() => pickWatchlist(o.key)}
                  >
                    <span className="wl-flyout__select-item-row">
                      <WatchlistKindTag kind={o.kind} />
                      <span className="wl-flyout__select-item-name">{o.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {optionsError ? <p className="paper-strategy-err">{optionsError}</p> : null}
      {saveError ? <p className="paper-strategy-err">{saveError}</p> : null}
      {signalsError ? <p className="paper-strategy-err">{signalsError}</p> : null}

      {signalsLoading ? (
        <p className="paper-strategy-muted">Loading watchlist signals…</p>
      ) : (
        <WatchlistTickerList
          rows={tickerRows}
          rules={rules}
          busy={busy}
          onAddRule={handleAddRules}
          onAddToForm={(syms) => onAddTickersToForm?.(syms)}
          onScrollToRules={onScrollToRules}
          onScrollToRule={onScrollToRule}
        />
      )}

      {leaders.watchlist?.symbolCount != null ? (
        <p className="paper-strategy-muted paper-strategy-wl__meta">
          {leaders.watchlist.symbolCount} ticker{leaders.watchlist.symbolCount === 1 ? '' : 's'} in watchlist
        </p>
      ) : null}
    </section>
  );
}
