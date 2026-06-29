'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import {
  applyDateEndChange,
  applyDateStartChange,
  applyYearEndChange,
  applyYearStartChange,
  coerceDateRange,
  coerceYearRange,
  dateInputBounds,
  buildYearDropdownOptions,
  yearOptionsForEnd,
  yearOptionsForStart
} from '../utils/dateRangeConstraints.js';

/**
 * Start / end date inputs + Submit (+ Clear) for client-side chart filtering.
 * @param {{
 *   idPrefix: string,
 *   maxDate?: string,
 *   onApply: (r: { start: string, end: string }) => void,
 *   mode?: 'date' | 'year',
 *   minYear?: number,
 *   maxYear?: number,
 *   initialStart?: string,
 *   initialEnd?: string
 * }} props
 */
export function ChartDateApplyRow({
  idPrefix,
  maxDate,
  onApply,
  mode = 'date',
  minYear = 1980,
  maxYear = 2026,
  initialStart = '',
  initialEnd = ''
}) {
  const [start, setStart] = useState(String(initialStart || ''));
  const [end, setEnd] = useState(String(initialEnd || ''));
  const lastAppliedRef = useRef({ start: null, end: null });

  const normalizedMinYear = Number.isFinite(Number(minYear)) ? Math.floor(Number(minYear)) : 1980;
  const normalizedMaxYear = Number.isFinite(Number(maxYear)) ? Math.floor(Number(maxYear)) : 2026;
  const yearLo = Math.min(normalizedMinYear, normalizedMaxYear);
  const yearHi = Math.max(normalizedMinYear, normalizedMaxYear);

  const allYearDropdownOptions = useMemo(() => {
    const ys = [];
    for (let y = yearHi; y >= yearLo; y -= 1) ys.push(y);
    return buildYearDropdownOptions(ys, { includeAll: true });
  }, [yearLo, yearHi]);

  const startYearDropdownOptions = useMemo(
    () => yearOptionsForStart(allYearDropdownOptions, end),
    [allYearDropdownOptions, end]
  );
  const endYearDropdownOptions = useMemo(
    () => yearOptionsForEnd(allYearDropdownOptions, start),
    [allYearDropdownOptions, start]
  );

  const applyRange = useCallback(
    (startVal, endVal) => {
      const startRaw = String(startVal || '').trim();
      const endRaw = String(endVal || '').trim();
      let s = startRaw
        ? mode === 'year'
          ? `${startRaw.slice(0, 4)}-01-01`
          : startRaw.slice(0, 10)
        : '';
      let e = endRaw ? (mode === 'year' ? `${endRaw.slice(0, 4)}-12-31` : endRaw.slice(0, 10)) : '';
      const cap = maxDate ? String(maxDate).slice(0, 10) : '';
      if (s && cap && s > cap) s = cap;
      if (e && cap && e > cap) e = cap;

      if (mode === 'year') {
        const y = coerceYearRange(s.slice(0, 4), e.slice(0, 4));
        s = y.start ? `${y.start}-01-01` : '';
        e = y.end ? `${y.end}-12-31` : '';
      } else {
        const d = coerceDateRange(s, e);
        s = d.start;
        e = d.end;
      }

      if (lastAppliedRef.current.start === s && lastAppliedRef.current.end === e) return;
      lastAppliedRef.current = { start: s, end: e };
      onApply({ start: s, end: e });
    },
    [maxDate, mode, onApply]
  );

  const submit = useCallback(() => {
    applyRange(start, end);
  }, [applyRange, start, end]);

  const clear = useCallback(() => {
    setStart('');
    setEnd('');
    lastAppliedRef.current = { start: '', end: '' };
    onApply({ start: '', end: '' });
  }, [onApply]);

  useEffect(() => {
    setStart(String(initialStart || ''));
    setEnd(String(initialEnd || ''));
  }, [idPrefix, initialStart, initialEnd]);

  useEffect(() => {
    if (mode !== 'year') return;
    applyRange(start, end);
  }, [mode, start, end, applyRange]);

  const dateBounds = dateInputBounds(start, end, { globalMax: maxDate ? String(maxDate).slice(0, 10) : '' });

  const onStartDateChange = useCallback(
    (ev) => {
      const next = applyDateStartChange(start, end, ev.target.value);
      setStart(next.start);
      setEnd(next.end);
    },
    [start, end]
  );

  const onEndDateChange = useCallback(
    (ev) => {
      const next = applyDateEndChange(start, end, ev.target.value);
      setStart(next.start);
      setEnd(next.end);
    },
    [start, end]
  );

  const onStartYearChange = useCallback(
    (v) => {
      const next = applyYearStartChange(start, end, v);
      setStart(next.start);
      setEnd(next.end);
    },
    [start, end]
  );

  const onEndYearChange = useCallback(
    (v) => {
      const next = applyYearEndChange(start, end, v);
      setStart(next.start);
      setEnd(next.end);
    },
    [start, end]
  );

  return (
    <div className="chart-date-apply">
      <span className="ticker-page__label ticker-page__label--inline">{mode === 'year' ? 'Start year' : 'Start date'}</span>
      {mode === 'year' ? (
        <ThemedDropdown
          buttonId={idPrefix + '-start-year'}
          className="chart-date-apply__year-dd"
          size="sm"
          style={{ minWidth: 88 }}
          value={start}
          options={startYearDropdownOptions}
          onChange={onStartYearChange}
          title="Start year"
          ariaLabelPrefix="Start year"
          labelFallback={start ? start : 'All'}
        />
      ) : (
        <input
          id={idPrefix + '-start'}
          type="date"
          className="ticker-page__date-inp"
          value={start}
          onChange={onStartDateChange}
          min={dateBounds.startMin}
          max={dateBounds.startMax}
        />
      )}
      <span className="ticker-page__label ticker-page__label--inline">{mode === 'year' ? 'End year' : 'End date'}</span>
      {mode === 'year' ? (
        <ThemedDropdown
          buttonId={idPrefix + '-end-year'}
          className="chart-date-apply__year-dd"
          size="sm"
          style={{ minWidth: 88 }}
          value={end}
          options={endYearDropdownOptions}
          onChange={onEndYearChange}
          title="End year"
          ariaLabelPrefix="End year"
          labelFallback={end ? end : 'All'}
        />
      ) : (
        <input
          id={idPrefix + '-end'}
          type="date"
          className="ticker-page__date-inp"
          value={end}
          onChange={onEndDateChange}
          min={dateBounds.endMin}
          max={dateBounds.endMax}
        />
      )}
      <button type="button" className="ticker-outline-btn ticker-outline-btn--sm" onClick={submit}>
        Submit
      </button>
      <button type="button" className="ticker-outline-btn ticker-outline-btn--sm" onClick={clear}>
        Clear
      </button>
    </div>
  );
}
