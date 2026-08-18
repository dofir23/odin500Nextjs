'use client';
import { useState } from 'react';

const ENGINE_LABELS = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini' };

function fmtRunAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/** One run's headline: what actually changed, before you open it. */
function ChangeSummary({ run }) {
  if (run.status === 'error') {
    return <span className="paper-rebalance__summary paper-rebalance__summary--error">Failed</span>;
  }
  if (run.unchanged) {
    return <span className="paper-rebalance__summary paper-rebalance__summary--flat">No change</span>;
  }
  return (
    <span className="paper-rebalance__summary">
      {run.added_count > 0 ? (
        <span className="paper-rebalance__delta paper-rebalance__delta--add">+{run.added_count}</span>
      ) : null}
      {run.dropped_count > 0 ? (
        <span className="paper-rebalance__delta paper-rebalance__delta--drop">−{run.dropped_count}</span>
      ) : null}
    </span>
  );
}

function TickerGroup({ label, tickers, tone }) {
  if (!tickers?.length) return null;
  return (
    <div className="paper-rebalance__group">
      <p className="paper-rebalance__group-k">{label}</p>
      <div className="paper-rebalance__tickers">
        {tickers.map((t) => (
          <span key={t} className={`paper-rebalance__ticker paper-rebalance__ticker--${tone}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function RebalanceRow({ run }) {
  const [open, setOpen] = useState(false);
  // Nothing to reveal on a clean no-change run with no reasoning — don't offer a dead toggle.
  const expandable = Boolean(run.added_count || run.dropped_count || run.reasoning || run.error);

  return (
    <li className={'paper-rebalance__item' + (open ? ' paper-rebalance__item--open' : '')}>
      <button
        type="button"
        className="paper-rebalance__head"
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
      >
        <span className="paper-rebalance__when">{fmtRunAt(run.ran_at)}</span>
        {run.engine ? (
          <span className="paper-tag paper-tag--engine" data-engine={run.engine}>
            {ENGINE_LABELS[run.engine] || run.engine}
          </span>
        ) : null}
        <ChangeSummary run={run} />
        {expandable ? (
          <span aria-hidden className={'paper-rebalance__caret' + (open ? ' is-open' : '')}>
            ▾
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="paper-rebalance__body">
          {run.error ? <p className="paper-rebalance__error">{run.error}</p> : null}
          <div className="paper-rebalance__groups">
            <TickerGroup label="Added" tickers={run.added} tone="add" />
            <TickerGroup label="Closed" tickers={run.dropped} tone="drop" />
          </div>
          {run.reasoning ? (
            <div className="paper-rebalance__group">
              <p className="paper-rebalance__group-k">Why</p>
              <p className="paper-rebalance__reasoning">{run.reasoning}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * AI rebalance history for one portfolio: a run per row, expanding to the names added and closed
 * plus the model's own reasoning for that run.
 *
 * @param {{ rebalances: object[], loading?: boolean, error?: string, isAiManaged?: boolean }} props
 */
export function RebalanceLog({ rebalances = [], loading = false, error = '', isAiManaged = true }) {
  if (loading && !rebalances.length) {
    return (
      <div className="paper-rebalance" aria-busy="true">
        <div className="paper-skeleton" style={{ minHeight: '5rem' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="paper-rebalance paper-rebalance--empty">
        <p className="paper-rebalance__empty-title">Couldn’t load rebalances</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!rebalances.length) {
    return (
      <div className="paper-rebalance paper-rebalance--empty">
        <p className="paper-rebalance__empty-title">No rebalances yet</p>
        <p>
          {isAiManaged
            ? 'Each time the AI reviews this portfolio, the run will appear here with the names it added and closed.'
            : 'This portfolio is managed manually, so it has no AI rebalance history.'}
        </p>
      </div>
    );
  }

  return (
    <div className="paper-rebalance">
      <p className="paper-rebalance__hint">
        Every AI review of this portfolio, newest first. Select a run to see what changed and why.
      </p>
      <ul className="paper-rebalance__list">
        {rebalances.map((run) => (
          <RebalanceRow key={run.id} run={run} />
        ))}
      </ul>
    </div>
  );
}
