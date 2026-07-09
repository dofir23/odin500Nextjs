'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { fetchJsonCached, canFetchMarketData } from '../store/apiStore.js';
import { fmtNumber } from '../utils/formatDisplayNumber.js';

const DAY_OPTIONS = [
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: '180', label: '180 days' },
  { id: '365', label: '1 year' }
];

const INDEX_OPTIONS = [
  { id: 'all', label: 'S&P 500 + Dow + Nasdaq 100' },
  { id: 'sp500', label: 'S&P 500' },
  { id: 'dow', label: 'Dow Jones' },
  { id: 'nasdaq', label: 'Nasdaq 100' }
];

function splitTypeLabel(type) {
  if (type === 'reverse_split') return 'Reverse';
  if (type === 'stock_dividend') return 'Stock div.';
  if (type === 'forward_split') return 'Forward';
  return type || 'Split';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isUpcomingSplit(executionDate) {
  const exec = String(executionDate || '').slice(0, 10);
  if (!exec) return false;
  const today = new Date().toISOString().slice(0, 10);
  return exec > today;
}

/**
 * @param {object} props
 * @param {import('../ssr/fetchPageData').StockSplitsInitialData | null} [props.initialData]
 */
export default function StockSplitsPage({ initialData = null }) {

  const ssrMatchesDefaults =
    initialData?.days === '90' && initialData?.indexId === 'all';
  const [days, setDays] = useState(() => initialData?.days ?? '90');
  const [indexId, setIndexId] = useState(() => initialData?.indexId ?? 'all');
  const [splits, setSplits] = useState(() =>
    ssrMatchesDefaults ? initialData?.splits ?? [] : []
  );
  const [syncStatus, setSyncStatus] = useState(() =>
    ssrMatchesDefaults ? initialData?.syncStatus ?? null : null
  );
  const [loading, setLoading] = useState(() => !ssrMatchesDefaults || !initialData?.splits?.length);
  const [error, setError] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);

  const load = useCallback(async () => {
    if (!canFetchMarketData()) return;
    if (
      ssrMatchesDefaults &&
      initialData?.splits?.length &&
      days === initialData.days &&
      indexId === initialData.indexId
    ) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [recentRes, statusRes] = await Promise.all([
        fetchJsonCached({
          path: `/api/splits/recent?days=${encodeURIComponent(days)}&limit=200&index=${encodeURIComponent(indexId)}`,
          method: 'GET',
          ttlMs: 3 * 60 * 1000
        }),
        fetchJsonCached({
          path: '/api/splits/status',
          method: 'GET',
          ttlMs: 60 * 1000
        })
      ]);
      const list = Array.isArray(recentRes?.data?.splits) ? recentRes.data.splits : [];
      setSplits(list);
      setSyncStatus(statusRes?.data || null);
    } catch (e) {
      setError(e?.message || 'Failed to load splits');
      setSplits([]);
    } finally {
      setLoading(false);
    }
  }, [days, indexId, initialData, ssrMatchesDefaults]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSync = async () => {
    setSyncBusy(true);
    setError('');
    try {
      const res = await fetchJsonCached({
        path: '/api/splits/sync',
        method: 'POST',
        body: { catchUpDays: 180 },
        ttlMs: 0,
        force: true
      });
      if (res?.data?.ok === false || res?.data?.success === false) {
        throw new Error(res?.data?.reason || res?.data?.error || 'Sync failed');
      }
      const inserted = res?.data?.inserted;
      const fetched = res?.data?.fetched;
      if (Number.isFinite(inserted) && Number.isFinite(fetched)) {
        console.info(`[stock-splits] sync ok fetched=${fetched} inserted=${inserted}`);
      }
      await load();
    } catch (e) {
      setError(e?.message || 'Sync failed');
    } finally {
      setSyncBusy(false);
    }
  };

  const lastSyncLabel = useMemo(() => {
    const raw = syncStatus?.last_run_at;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  }, [syncStatus]);

  return (
    <div className="stock-splits-page">
      <header className="stock-splits-page__header">
        <div>
          <h1 className="stock-splits-page__title">Stock Splits</h1>
          <p className="stock-splits-page__lead">
            Corporate split events for Odin-covered indices (S&amp;P 500, Dow Jones, Nasdaq 100), synced from Massive.
            Charts and returns use split-adjusted prices where available.
          </p>
        </div>
        <div className="stock-splits-page__actions">
          <label className="stock-splits-page__filter">
            <span className="stock-splits-page__filter-label">Index</span>
            <select
              className="stock-splits-page__select stock-splits-page__select--index"
              value={indexId}
              onChange={(e) => setIndexId(e.target.value)}
            >
              {INDEX_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-splits-page__filter">
            <span className="stock-splits-page__filter-label">Window</span>
            <select
              className="stock-splits-page__select"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              {DAY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="stock-splits-page__sync-btn"
            onClick={() => void onSync()}
            disabled={syncBusy || !syncStatus?.enabled}
            title={syncStatus?.enabled ? 'Refresh from Massive' : 'MASSIVE_API_KEY not configured on server'}
          >
            {syncBusy ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </header>

      {lastSyncLabel ? (
        <p className="stock-splits-page__meta">
          Last sync: {lastSyncLabel}
          {syncStatus?.last_new_count != null ? ` · ${syncStatus.last_new_count} new on last run` : ''}
        </p>
      ) : null}

      {error ? (
        <div className="stock-splits-page__error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="stock-splits-page__loading">Loading splits…</p>
      ) : splits.length === 0 ? (
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
              {splits.map((row) => {
                const upcoming = isUpcomingSplit(row.execution_date);
                return (
                <tr key={row.id} className={upcoming ? 'stock-splits-page__row--upcoming' : undefined}>
                  <td>
                    <Link className="stock-splits-page__sym" to={`/ticker/${encodeURIComponent(row.ticker)}`}>
                      {row.ticker}
                    </Link>
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
                        (row.adjustment_type === 'reverse_split' ? ' stock-splits-page__type--reverse' : '')
                      }
                    >
                      {splitTypeLabel(row.adjustment_type)}
                    </span>
                  </td>
                  <td>{row.ratio_factor != null ? fmtNumber(row.ratio_factor, { maximumFractionDigits: 4 }) : '—'}</td>
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
