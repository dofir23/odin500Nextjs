'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth, canFetchProtectedApi } from '../store/apiStore.js';
import { shouldIgnoreRouteLoadError, useRouteNavigationDeps } from './useRouteLoadGuard.js';

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || payload?.message || 'Request failed');
  return payload;
}

export function usePaperClosedTrades({ accountId = '' } = {}) {
  const [trades, setTrades] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const { pathname, navEpoch } = useRouteNavigationDeps();

  const refetch = useCallback(async () => {
    if (!canFetchProtectedApi()) {
      setTrades([]);
      setTotals(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
      const res = await fetchWithAuth(apiUrl(`/api/paper/trades/closed${qs}`), { method: 'GET' });
      const data = await parseJson(res);
      setTrades(data.trades || []);
      setTotals(data.totals || null);
    } catch (err) {
      if (!shouldIgnoreRouteLoadError(err)) {
        setTrades([]);
        setTotals(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refetch();
  }, [refetch, pathname, navEpoch]);

  return { trades, totals, loading, refetch };
}

