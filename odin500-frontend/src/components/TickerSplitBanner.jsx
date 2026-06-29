'use client';
import { Link } from '@/navigation/appRouterCompat.jsx';

function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function typeLabel(type) {
  if (type === 'reverse_split') return 'Reverse split';
  if (type === 'stock_dividend') return 'Stock dividend';
  return 'Stock split';
}

function relativePastDays(daysSince) {
  if (daysSince == null || daysSince < 0) return null;
  if (daysSince === 0) return 'today';
  if (daysSince === 1) return '1 day ago';
  return `${daysSince} days ago`;
}

function relativeFutureDays(daysUntil) {
  if (daysUntil == null || daysUntil <= 0) return null;
  if (daysUntil === 1) return 'in 1 day';
  return `in ${daysUntil} days`;
}

/**
 * @param {{
 *   ticker: string,
 *   split: { execution_date?: string, split_ratio?: string, adjustment_type?: string } | null,
 *   variant: 'past' | 'upcoming',
 *   daysSinceSplit?: number | null,
 *   daysUntilSplit?: number | null,
 *   adjCloseValidation?: { ok?: boolean } | null,
 *   className?: string
 * }} props
 */
export function TickerSplitBanner({
  ticker,
  split,
  variant,
  daysSinceSplit = null,
  daysUntilSplit = null,
  adjCloseValidation = null,
  className = ''
}) {
  if (!split?.execution_date) return null;

  const sym = String(ticker || split.ticker || '').toUpperCase();
  const ratio = split.split_ratio || '—';
  const label = typeLabel(split.adjustment_type || 'split');
  const dateFmt = formatDisplayDate(split.execution_date);
  const isUpcoming = variant === 'upcoming';

  const pastText = relativePastDays(daysSinceSplit);
  const futureText = relativeFutureDays(daysUntilSplit);

  return (
    <div
      className={
        'stock-split-banner' +
        (isUpcoming ? ' stock-split-banner--upcoming' : '') +
        (className ? ` ${className}` : '')
      }
      role="status"
    >
      <span className="stock-split-banner__icon" aria-hidden>
        {isUpcoming ? '📅' : '✂'}
      </span>
      <div className="stock-split-banner__body">
        <p className="stock-split-banner__title">
          {isUpcoming ? (
            <>
              Upcoming {label.toLowerCase()} — {ratio}
            </>
          ) : (
            <>
              {label} occurred — {ratio}
            </>
          )}
        </p>
        <p className="stock-split-banner__meta">
          {isUpcoming ? (
            <>
              {sym} scheduled for {dateFmt}
              {futureText ? ` (${futureText})` : ''}. Prices are not adjusted until the execution date.
            </>
          ) : (
            <>
              {sym} effective {dateFmt}
              {pastText ? ` (${pastText})` : ''}. Historical prices use split-adjusted data.
              {adjCloseValidation && adjCloseValidation.ok === false ? (
                <span className="stock-split-banner__warn">
                  {' '}
                  Adj. close continuity check flagged a possible data gap — verify chart returns.
                </span>
              ) : null}
            </>
          )}
          <Link className="stock-split-banner__link" to="/stock-splits">
            View all splits
          </Link>
        </p>
      </div>
    </div>
  );
}
