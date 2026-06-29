'use client';
import { useEffect, useRef, useState } from 'react';
import { SIGNAL_BUCKETS } from './strategyRuleUtils.js';

function IcoChevronDown({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatSelectedLabel(selected) {
  if (!selected?.length) return 'Select buckets';
  if (selected.length <= 4) return selected.join(', ');
  return `${selected.slice(0, 3).join(', ')} +${selected.length - 3}`;
}

export function SignalBucketMultiSelect({
  selected = [],
  disabledBuckets = new Set(),
  exitBlockedBuckets = new Set(),
  onChange,
  busy = false
}) {
  const [open, setOpen] = useState(false);
  const ddRef = useRef(null);
  const selectedSet = new Set(selected);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function toggle(bucket) {
    if (busy || disabledBuckets.has(bucket)) return;
    const next = selectedSet.has(bucket)
      ? selected.filter((b) => b !== bucket)
      : [...selected, bucket].sort((a, b) => SIGNAL_BUCKETS.indexOf(a) - SIGNAL_BUCKETS.indexOf(b));
    onChange?.(next);
  }

  return (
    <div className="paper-field paper-field--span2 paper-signal-buckets" ref={ddRef}>
      <span className="paper-field__label">Signal bucket</span>
      <div className="wl-flyout__select-wrap paper-checkbox-dropdown">
        <button
          type="button"
          className="wl-flyout__select paper-checkbox-dropdown__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="wl-flyout__select-label paper-checkbox-dropdown__trigger-label">
            {formatSelectedLabel(selected)}
          </span>
          <IcoChevronDown className="wl-flyout__select-chev" />
        </button>
        {open ? (
          <ul className="wl-flyout__select-menu paper-checkbox-dropdown__menu" role="listbox" aria-multiselectable>
            {SIGNAL_BUCKETS.map((bucket) => {
              const checked = selectedSet.has(bucket);
              const disabled = disabledBuckets.has(bucket);
              const longBucket = bucket.startsWith('L');
              const shortBucket = bucket.startsWith('S');
              return (
                <li key={bucket} role="option" aria-selected={checked} aria-disabled={disabled || undefined}>
                  <label
                    className={
                      'paper-checkbox-dropdown__row' +
                      (checked ? ' paper-checkbox-dropdown__row--checked' : '') +
                      (disabled ? ' paper-checkbox-dropdown__row--disabled' : '') +
                      (longBucket ? ' paper-checkbox-dropdown__row--long' : '') +
                      (shortBucket ? ' paper-checkbox-dropdown__row--short' : '')
                    }
                    title={
                      disabled
                        ? exitBlockedBuckets.has(bucket)
                          ? `${bucket} matches your entry rule for this ticker`
                          : `${bucket} is already used by another exact-signal rule for this ticker`
                        : undefined
                    }
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <input
                      type="checkbox"
                      className="paper-strategy-wl__checkbox"
                      checked={checked}
                      disabled={busy || disabled}
                      onChange={() => toggle(bucket)}
                      aria-label={bucket}
                    />
                    <span className="paper-checkbox-dropdown__label">{bucket}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {disabledBuckets.size > 0 ? (
        <p className="paper-strategy-muted paper-signal-buckets__hint">
          Greyed buckets are used by an entry rule or another exact-signal rule for the selected
          ticker(s).
        </p>
      ) : null}
    </div>
  );
}
