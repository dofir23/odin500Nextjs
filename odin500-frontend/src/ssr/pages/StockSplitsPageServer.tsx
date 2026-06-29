import type { StockSplitsInitialData } from '@/ssr/fetchPageData';

function splitTypeLabel(type: unknown) {
  if (type === 'reverse_split') return 'Reverse';
  if (type === 'stock_dividend') return 'Stock div.';
  if (type === 'forward_split') return 'Forward';
  return type ? String(type) : 'Split';
}

function formatDate(dateStr: unknown) {
  if (!dateStr) return '—';
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isUpcomingSplit(executionDate: unknown) {
  const exec = String(executionDate || '').slice(0, 10);
  if (!exec) return false;
  const today = new Date().toISOString().slice(0, 10);
  return exec > today;
}

function formatFactor(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n * 10000) / 10000);
}

type SplitRow = {
  id?: string | number;
  ticker?: string;
  execution_date?: string;
  split_ratio?: string;
  adjustment_type?: string;
  ratio_factor?: number;
};

type StockSplitsPageServerProps = {
  data: StockSplitsInitialData | null;
};

/**
 * Server-rendered stock splits page — full HTML table in the initial response.
 */
export function StockSplitsPageServer({ data }: StockSplitsPageServerProps) {
  const splits = (Array.isArray(data?.splits) ? data.splits : []) as SplitRow[];
  const syncStatus = data?.syncStatus ?? null;
  const days = data?.days ?? '90';
  const indexId = data?.indexId ?? 'all';

  const indexLabel =
    indexId === 'sp500'
      ? 'S&P 500'
      : indexId === 'dow'
        ? 'Dow Jones'
        : indexId === 'nasdaq'
          ? 'Nasdaq 100'
          : 'S&P 500 + Dow + Nasdaq 100';

  const windowLabel =
    days === '30'
      ? '30 days'
      : days === '180'
        ? '180 days'
        : days === '365'
          ? '1 year'
          : '90 days';

  let lastSyncLabel: string | null = null;
  const rawSync = syncStatus?.last_run_at;
  if (rawSync) {
    const d = new Date(String(rawSync));
    if (!Number.isNaN(d.getTime())) lastSyncLabel = d.toLocaleString('en-US');
  }

  return (
    <div className="stock-splits-page">
      <header className="stock-splits-page__header">
        <div>
          <h1 className="stock-splits-page__title">Stock Splits</h1>
          <p className="stock-splits-page__lead">
            Corporate split events for Odin-covered indices (S&amp;P 500, Dow Jones, Nasdaq 100),
            synced from Massive. Charts and returns use split-adjusted prices where available.
          </p>
        </div>
        <p className="stock-splits-page__meta">
          Showing {indexLabel} · last {windowLabel}
          {lastSyncLabel ? ` · Last sync: ${lastSyncLabel}` : ''}
        </p>
      </header>

      {splits.length === 0 ? (
        <p className="stock-splits-page__empty">No splits in the selected window.</p>
      ) : (
        <div className="stock-splits-page__table-wrap">
          <table className="stock-splits-page__table">
            <thead>
              <tr>
                <th scope="col">Ticker</th>
                <th scope="col">Execution date</th>
                <th scope="col">Ratio</th>
                <th scope="col">Type</th>
                <th scope="col">Factor</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((row, i) => {
                const ticker = String(row.ticker ?? '').toUpperCase();
                const upcoming = isUpcomingSplit(row.execution_date);
                const rowKey = row.id ?? `${ticker}-${row.execution_date}-${i}`;
                return (
                  <tr
                    key={rowKey}
                    className={upcoming ? 'stock-splits-page__row--upcoming' : undefined}
                  >
                    <td>
                      {ticker ? (
                        <a className="stock-splits-page__sym" href={`/ticker/${encodeURIComponent(ticker)}`}>
                          {ticker}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {formatDate(row.execution_date)}
                      {upcoming ? (
                        <span className="stock-splits-page__upcoming-badge">Upcoming</span>
                      ) : null}
                    </td>
                    <td className="stock-splits-page__ratio">{row.split_ratio || '—'}</td>
                    <td>
                      <span
                        className={
                          'stock-splits-page__type' +
                          (row.adjustment_type === 'reverse_split'
                            ? ' stock-splits-page__type--reverse'
                            : '')
                        }
                      >
                        {splitTypeLabel(row.adjustment_type)}
                      </span>
                    </td>
                    <td>{formatFactor(row.ratio_factor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
