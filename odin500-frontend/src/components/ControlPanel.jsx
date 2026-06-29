'use client';
import { TickerSearch } from './TickerSearch.jsx';
import { MultiSignalSelect } from './MultiSignalSelect.jsx';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { computeDefaultApiOrigin } from '../utils/apiOrigin.js';
import {
  applyDateEndChange,
  applyDateStartChange,
  dateInputBounds
} from '../utils/dateRangeConstraints.js';

export function ControlPanel({
  ticker,
  onTickerChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  executionMode,
  onExecutionModeChange,
  onLoad,
  loadDisabled,
  entryLong,
  exitLong,
  entryShort,
  exitShort,
  onEntryLongChange,
  onExitLongChange,
  onEntryShortChange,
  onExitShortChange,
  statusMessage,
  statusType,
  onInvalidateOdin,
  allTickers
}) {
  const dateBounds = dateInputBounds(startDate, endDate);

  return (
    <div className="panel">
      <div className="filters">
        <TickerSearch
          value={ticker}
          onChange={onTickerChange}
          allTickers={allTickers}
          onInvalidateOdin={onInvalidateOdin}
        />
        <div className="field">
          <label htmlFor="startDate">Start Date</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            min={dateBounds.startMin}
            max={dateBounds.startMax}
            onChange={(e) => {
              const next = applyDateStartChange(startDate, endDate, e.target.value);
              onStartDateChange(next.start);
              onEndDateChange(next.end);
              onInvalidateOdin();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="endDate">End Date</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            min={dateBounds.endMin}
            max={dateBounds.endMax}
            onChange={(e) => {
              const next = applyDateEndChange(startDate, endDate, e.target.value);
              onStartDateChange(next.start);
              onEndDateChange(next.end);
              onInvalidateOdin();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="executionModeSelect">Execution Mode</label>
          <ThemedDropdown
            buttonId="executionModeSelect"
            className="control-panel__exec-dd"
            style={{ width: '100%' }}
            value={executionMode}
            options={[
              { id: 'T+1', label: 'T+1 (Next-Day Open)' },
              { id: 'T', label: 'T (Signal-Day Close)' }
            ]}
            onChange={(v) => {
              onExecutionModeChange(v);
              onInvalidateOdin();
            }}
            title="Execution mode"
            ariaLabelPrefix="Execution mode"
            wideLabel
          />
        </div>
        <div className="field">
          <label htmlFor="loadBtn">&nbsp;</label>
          <button type="button" id="loadBtn" onClick={onLoad} disabled={loadDisabled}>
            Load Chart
          </button>
        </div>
      </div>

      <div className="filters odin-row">
        <MultiSignalSelect
          label="Entry Long Signals"
          value={entryLong}
          onChange={(v) => {
            onEntryLongChange(v);
            onInvalidateOdin();
          }}
        />
        <MultiSignalSelect
          label="Exit Long Signals"
          value={exitLong}
          onChange={(v) => {
            onExitLongChange(v);
            onInvalidateOdin();
          }}
        />
        <MultiSignalSelect
          label="Entry Short Signals"
          value={entryShort}
          onChange={(v) => {
            onEntryShortChange(v);
            onInvalidateOdin();
          }}
        />
        <MultiSignalSelect
          label="Exit Short Signals"
          value={exitShort}
          onChange={(v) => {
            onExitShortChange(v);
            onInvalidateOdin();
          }}
        />
      </div>

      <div className="hint">
        Auth: backend token from /api/auth/login. API base:{' '}
        <code>{computeDefaultApiOrigin() || window.location.origin}</code>
        {' — '}
        chart markers come from <code>POST /api/analytics/odin-index</code> trades
      </div>

      <div className={'status' + (statusType ? ' ' + statusType : '')}>{statusMessage}</div>
    </div>
  );
}
