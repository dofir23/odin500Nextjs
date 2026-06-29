'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TICKER_SEARCH_DEBOUNCE_MS } from '../config/tickerSearch.js';
import { fetchJsonCached } from '../store/apiStore.js';
import { sanitizeTickerPageInput, sanitizeTickerSearchInput } from '../utils/tickerUrlSync.js';
import {
  activeTokenFromMultiselectQuery,
  formatMultiselectTickerInput,
  normalizeTickerSymbolList,
  parseMultiselectTickerInput,
  sanitizeTickerMultiselectInput
} from '../utils/tickerMultiselectInput.js';
import { fetchLatestSignalsForTickers } from '../utils/paperTickerSignal.js';

function IconSearchLeading() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Normalize input for API query (symbol-only vs name/symbol search). */
function queryForSearch(variant, input, multiple) {
  if (multiple && variant !== 'header') {
    return activeTokenFromMultiselectQuery(input);
  }
  if (variant === 'header') return sanitizeTickerSearchInput(input).trim();
  return sanitizeTickerPageInput(input);
}

function symbolsEqual(a, b) {
  const left = normalizeTickerSymbolList(a);
  const right = normalizeTickerSymbolList(b);
  if (left.length !== right.length) return false;
  return left.every((s, i) => s === right[i]);
}

export function TickerSymbolCombobox({
  symbol,
  onSymbolChange,
  /** When true, `symbols` / `onSymbolsChange` drive comma-separated multi pick (checkbox dropdown). */
  multiple = false,
  symbols = [],
  onSymbolsChange,
  inputId = 'ticker-page-symbol-input',
  placeholder = 'Search ticker (e.g. NVDA)',
  variant = 'default',
  /** Paper order ticket: show Long / Short / Neutral from latest Odin signal in dropdown rows. */
  showOdinSignal = false
}) {
  const selectedSymbols = useMemo(() => normalizeTickerSymbolList(symbols), [symbols]);
  const selectedSet = useMemo(() => new Set(selectedSymbols), [selectedSymbols]);

  const [input, setInput] = useState(() =>
    multiple ? formatMultiselectTickerInput(selectedSymbols) : symbol
  );
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [signalBySym, setSignalBySym] = useState(() => new Map());
  const [signalsLoading, setSignalsLoading] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useRef('ticker-search-listbox-' + Math.random().toString(36).slice(2)).current;

  const syncInputFromProps = useCallback(() => {
    if (multiple) {
      setInput(formatMultiselectTickerInput(selectedSymbols));
    } else {
      setInput(symbol);
    }
  }, [multiple, selectedSymbols, symbol]);

  useEffect(() => {
    if (open) return;
    syncInputFromProps();
  }, [open, syncInputFromProps]);

  useEffect(() => {
    setHighlight((h) => (items.length === 0 ? -1 : h >= 0 && h < items.length ? h : 0));
  }, [items]);

  const qActive = queryForSearch(variant, input, multiple);

  useEffect(() => {
    if (!open) return;
    if (!qActive) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await fetchJsonCached({
          path: '/api/tickers/search?q=' + encodeURIComponent(qActive),
          method: 'GET',
          ttlMs: 15 * 60 * 1000
        });
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, TICKER_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [qActive, open, variant, multiple, input]);

  useEffect(() => {
    if (!showOdinSignal || !open || multiple || items.length === 0) {
      setSignalsLoading(false);
      return undefined;
    }
    let cancelled = false;
    const syms = items.map((r) => String(r.symbol || '').toUpperCase().trim()).filter(Boolean);
    (async () => {
      setSignalsLoading(true);
      try {
        const map = await fetchLatestSignalsForTickers(syms);
        if (!cancelled) setSignalBySym(map);
      } catch {
        if (!cancelled) setSignalBySym(new Map());
      } finally {
        if (!cancelled) setSignalsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showOdinSignal, open, multiple, items]);

  function renderSignalBadge(sym) {
    if (!showOdinSignal || multiple) return null;
    const entry = signalBySym.get(sym);
    const label = entry?.label || (signalsLoading ? '…' : '—');
    const side = entry?.side || 'neutral';
    return (
      <span
        className={'ticker-symbol-search__signal ticker-symbol-search__signal--' + side}
        title={entry?.bucket ? `Signal ${entry.bucket}` : 'Odin signal'}
      >
        {label}
      </span>
    );
  }

  const commitMultiselectInput = useCallback(
    (raw) => {
      if (!onSymbolsChange) return;
      const { committed, active } = parseMultiselectTickerInput(raw);
      let next = normalizeTickerSymbolList(committed);
      const activeSym = sanitizeTickerPageInput(active);
      if (activeSym && !next.includes(activeSym)) {
        next = [...next, activeSym];
      }
      if (!symbolsEqual(next, selectedSymbols)) {
        onSymbolsChange(next);
      }
      setInput(formatMultiselectTickerInput(next));
    },
    [onSymbolsChange, selectedSymbols]
  );

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setHighlight(-1);
        if (multiple) {
          commitMultiselectInput(input);
        } else {
          setInput(symbol);
        }
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, symbol, multiple, input, commitMultiselectInput]);

  function pick(row) {
    const sym = String(row.symbol || '')
      .toUpperCase()
      .trim();
    if (!sym) return;
    if (multiple) {
      toggleSymbol(sym);
      return;
    }
    onSymbolChange(sym);
    setInput(sym);
    setOpen(false);
    setHighlight(-1);
    setItems([]);
  }

  function toggleSymbol(sym) {
    if (!onSymbolsChange) return;
    const upper = sanitizeTickerPageInput(sym);
    if (!upper) return;
    let next;
    if (selectedSet.has(upper)) {
      next = selectedSymbols.filter((s) => s !== upper);
    } else {
      next = [...selectedSymbols, upper];
    }
    next = normalizeTickerSymbolList(next);
    onSymbolsChange(next);
    setInput(formatMultiselectTickerInput(next));
    setOpen(true);
  }

  function onKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown') {
        if (multiple || qActive) setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      syncInputFromProps();
      setHighlight(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h < 0 ? 0 : Math.min(items.length - 1, h + 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => Math.max(0, (h < 0 ? 0 : h) - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && items[highlight]) {
        pick(items[highlight]);
        return;
      }
      if (multiple) {
        const activeSym = activeTokenFromMultiselectQuery(input);
        if (!activeSym) return;
        const exact = items.find((it) => String(it.symbol || '').toUpperCase() === activeSym);
        if (exact) pick(exact);
        else if (items.length === 1) pick(items[0]);
        else toggleSymbol(activeSym);
        return;
      }
      const q = queryForSearch(variant, input, false);
      if (!q) return;
      const symToken = sanitizeTickerPageInput(q);
      if (!symToken) return;
      const exact = items.find((it) => String(it.symbol || '').toUpperCase() === symToken);
      if (exact) pick(exact);
      else if (items.length === 1) pick(items[0]);
      else {
        onSymbolChange(symToken);
        setInput(symToken);
        setOpen(false);
        setHighlight(-1);
      }
    }
  }

  const isHeader = variant === 'header';
  const inputClass = isHeader ? 'ticker-symbol-search__input--header' : 'ticker-symbol-search__input';
  const inputAria = multiple
    ? 'Ticker symbols (comma-separated)'
    : isHeader
      ? 'Search tickers by symbol or company name'
      : 'Ticker symbol';

  const onInputChange = (e) => {
    if (multiple && !isHeader) {
      const v = sanitizeTickerMultiselectInput(e.target.value);
      setInput(v);
      setOpen(true);
      const { committed } = parseMultiselectTickerInput(v);
      const next = normalizeTickerSymbolList(committed);
      if (onSymbolsChange && !symbolsEqual(next, selectedSymbols)) {
        onSymbolsChange(next);
      }
      return;
    }
    const v = isHeader ? sanitizeTickerSearchInput(e.target.value) : sanitizeTickerPageInput(e.target.value);
    setInput(v);
    setOpen(true);
  };

  const clearInput = () => {
    setInput('');
    setItems([]);
    setOpen(true);
    setHighlight(-1);
    if (multiple) {
      onSymbolsChange?.([]);
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const showDropdown = open && (multiple ? true : Boolean(qActive));

  const rootClass =
    'ticker-symbol-search' +
    (isHeader ? ' ticker-symbol-search--header' : '') +
    (multiple ? ' ticker-symbol-search--multiselect' : '');

  const inputEl = (
    <input
      ref={inputRef}
      id={inputId}
      className={inputClass}
      type="text"
      autoComplete="off"
      spellCheck={false}
      aria-label={inputAria}
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      value={input}
      onChange={onInputChange}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  );

  return (
    <div className={rootClass + (open ? ' ticker-symbol-search--open' : '')} ref={wrapRef}>
      {isHeader ? (
        <div className="ticker-symbol-search__shell">
          <span className="ticker-symbol-search__leading" aria-hidden>
            <IconSearchLeading />
          </span>
          {inputEl}
          {input ? (
            <button
              type="button"
              className="ticker-symbol-search__clear"
              aria-label="Clear ticker search"
              title="Clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearInput}
            >
              <IconClear />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="ticker-symbol-search__field-wrap">
          {inputEl}
          {input ? (
            <button
              type="button"
              className="ticker-symbol-search__clear ticker-symbol-search__clear--default"
              aria-label="Clear ticker search"
              title="Clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearInput}
            >
              <IconClear />
            </button>
          ) : null}
        </div>
      )}
      {showDropdown ? (
        <div
          id={listId}
          className={
            'ticker-symbol-search__dropdown' +
            (isHeader ? ' ticker-symbol-search__dropdown--header' : '') +
            (multiple ? ' ticker-symbol-search__dropdown--multiselect' : '')
          }
          role="listbox"
          aria-label="Ticker matches"
          aria-multiselectable={multiple || undefined}
        >
          {multiple && !qActive ? (
            <div className="ticker-symbol-search__status">Type a symbol after the comma to search</div>
          ) : loading ? (
            <div className="ticker-symbol-search__status">Searching…</div>
          ) : items.length === 0 ? (
            <div className="ticker-symbol-search__status">{qActive ? 'No matches' : 'Type to search'}</div>
          ) : multiple ? (
            <ul className="ticker-symbol-search__checklist">
              {items.map((row, idx) => {
                const sym = String(row.symbol || '').toUpperCase();
                const co = row.company_name ? String(row.company_name) : '';
                const checked = selectedSet.has(sym);
                return (
                  <li key={sym ? sym + '-' + idx : 'row-' + idx}>
                    <label
                      className={
                        'ticker-symbol-search__check-row' +
                        (idx === highlight ? ' ticker-symbol-search__check-row--active' : '')
                      }
                      onMouseEnter={() => setHighlight(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <input
                        type="checkbox"
                        className="paper-strategy-wl__checkbox"
                        checked={checked}
                        onChange={() => toggleSymbol(sym)}
                      />
                      <span className="ticker-symbol-search__check-text">
                        <span className="ticker-symbol-search__sym">{sym}</span>
                        {co ? <span className="ticker-symbol-search__co">{co}</span> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            items.map((row, idx) => {
              const sym = String(row.symbol || '').toUpperCase();
              const co = row.company_name ? String(row.company_name) : '';
              return (
                <button
                  key={sym ? sym + '-' + idx : 'row-' + idx}
                  type="button"
                  role="option"
                  aria-selected={idx === highlight}
                  className={
                    'ticker-symbol-search__item' +
                    (isHeader ? ' ticker-symbol-search__item--header' : '') +
                    (idx === highlight ? ' ticker-symbol-search__item--active' : '')
                  }
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(row)}
                >
                  {isHeader && (co || showOdinSignal) ? (
                    <span className="ticker-symbol-search__item-text">
                      <span className="ticker-symbol-search__sym">{sym}</span>
                      {co ? <span className="ticker-symbol-search__co">{co}</span> : null}
                      {renderSignalBadge(sym)}
                    </span>
                  ) : (
                    <>
                      {sym}
                      {renderSignalBadge(sym)}
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
