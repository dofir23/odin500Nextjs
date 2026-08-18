'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { ENGINE_SECTIONS } from '../utils/aiCompareSeries.js';

/**
 * Top N published portfolios per AI engine, for the comparison page's left rail.
 *
 * One request per engine against the existing paged list endpoint (`ai_only=1&engine=…`), run
 * in parallel — the API already filters, sorts and pages, so no new backend route is needed.
 * A failing engine yields an empty section rather than blanking the page; engines with no
 * portfolios published yet (Gemini, today) are a normal empty state, not an error.
 */
export function useAiEngineLeaders({ limit = 5, enabled = true } = {}) {
  const [byEngine, setByEngine] = useState(() => Object.fromEntries(ENGINE_SECTIONS.map((e) => [e.id, []])));
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const entries = await Promise.all(
        ENGINE_SECTIONS.map(async (engine) => {
          const qs = new URLSearchParams({
            page: '1',
            page_size: String(limit),
            sort: 'total_return_pct',
            dir: 'desc',
            ai_only: '1',
            engine: engine.id
          });
          try {
            const res = await fetch(apiUrl(`/api/public/paper/portfolios?${qs}`));
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) return [engine.id, []];
            return [engine.id, Array.isArray(payload.portfolios) ? payload.portfolios : []];
          } catch {
            return [engine.id, []];
          }
        })
      );
      setByEngine(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI portfolios');
    } finally {
      setLoading(false);
    }
  }, [limit, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => Object.values(byEngine).reduce((sum, rows) => sum + rows.length, 0),
    [byEngine]
  );

  return { byEngine, total, loading, error, refetch: load };
}

/**
 * Equity curves for the selected portfolios, cached per account for the page's lifetime.
 *
 * The curve only changes when the daily snapshot job runs, so re-fetching on every toggle
 * would be wasted work; an in-flight map also stops a double-toggle firing two requests for
 * the same account.
 */
export function usePortfolioHistoryCache() {
  const cacheRef = useRef(new Map());
  const inFlightRef = useRef(new Map());

  return useCallback(async (accountId) => {
    const id = String(accountId || '');
    if (!id) return [];
    if (cacheRef.current.has(id)) return cacheRef.current.get(id);
    if (inFlightRef.current.has(id)) return inFlightRef.current.get(id);

    const promise = (async () => {
      try {
        const res = await fetch(apiUrl(`/api/public/paper/portfolios/${encodeURIComponent(id)}/history`));
        const payload = await res.json().catch(() => ({}));
        const history = res.ok && Array.isArray(payload.history) ? payload.history : [];
        // Reshaped into OHLC row shape so the chart's normalizeRows() reads equity as a close
        // and rebases it to percent — no special-casing inside the chart component.
        const rows = history
          .map((row) => ({ Date: row.snapshot_at, Close: Number(row.equity) }))
          .filter((row) => row.Date && Number.isFinite(row.Close));
        cacheRef.current.set(id, rows);
        return rows;
      } finally {
        inFlightRef.current.delete(id);
      }
    })();

    inFlightRef.current.set(id, promise);
    return promise;
  }, []);
}
