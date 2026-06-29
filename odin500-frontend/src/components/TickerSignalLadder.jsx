'use client';
import {
  SIGNAL_LADDER_BUCKETS,
  signalSideFromBucket,
  signalSideLabel
} from '../utils/odinSignalTreemap.js';

/**
 * Indicative Odin signal ladder (L1–L3 long, S1–S3 short, N neutral).
 * Data comes from TickerPage chart rows via readRowSignal / toSignalBucket.
 */
export function TickerSignalLadder({
  activeBucket = 'N',
  lastSignal = 'N',
  lastUpdatedFmt = '—',
  loading = false,
  hasChartData = false
}) {
  const side = signalSideFromBucket(activeBucket);
  const sideLabel = signalSideLabel(side);
  const sideClass =
    side === 'long'
      ? 'ticker-signal-side--long'
      : side === 'short'
        ? 'ticker-signal-side--short'
        : 'ticker-signal-side--neutral';

  if (loading) {
    return (
      <div className="ticker-aside-mini__body">
        <p className="ticker-signal-asof">Loading signal…</p>
      </div>
    );
  }

  if (!hasChartData) {
    return (
      <div className="ticker-aside-mini__body">
        <p className="ticker-signal-asof">No signal data for this symbol</p>
      </div>
    );
  }

  return (
    <div className="ticker-aside-mini__body">
      <p className="ticker-signal-asof">As of {lastUpdatedFmt}</p>
      <p className={`ticker-signal-side ${sideClass}`}>
        <span className="ticker-signal-side__label">{sideLabel}</span>
        <span className="ticker-signal-side__detail">
          Active: <strong>{activeBucket}</strong>
          {lastSignal && String(lastSignal).toUpperCase() !== activeBucket ? (
            <> · Raw: {String(lastSignal).toUpperCase()}</>
          ) : null}
        </span>
      </p>
      <div className="ticker-signal-lanes" role="list" aria-label="Indicative signal ladder">
        {SIGNAL_LADDER_BUCKETS.map((s) => (
          <div
            key={s.k}
            className={
              'ticker-signal-cell ticker-signal-cell--' +
              s.tone +
              (activeBucket === s.k ? ' ticker-signal-cell--active' : '')
            }
            role="listitem"
            aria-current={activeBucket === s.k ? 'true' : undefined}
            title={s.k === activeBucket ? `Current signal: ${s.k}` : s.k}
          >
            {s.k}
          </div>
        ))}
      </div>
    </div>
  );
}
