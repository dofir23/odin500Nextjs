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

export function usePaperPortfolioAnalytics({ accountId = '', enabled = true } = {}) {
  const [summaries, setSummaries] = useState([]);
  const [compareHistory, setCompareHistory] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [sectorEquity, setSectorEquity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { pathname, navEpoch } = useRouteNavigationDeps();

  const refetch = useCallback(async () => {
    if (!canFetchProtectedApi() || !enabled) {
      setSummaries([]);
      setCompareHistory([]);
      setSectors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const sectorQs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
      const [sumRes, histRes, secRes] = await Promise.all([
        fetchWithAuth(apiUrl('/api/paper/accounts/summary'), { method: 'GET' }),
        fetchWithAuth(apiUrl('/api/paper/portfolio/compare-history'), { method: 'GET' }),
        fetchWithAuth(apiUrl(`/api/paper/portfolio/sectors${sectorQs}`), { method: 'GET' })
      ]);
      const [sumData, histData, secData] = await Promise.all([
        parseJson(sumRes),
        parseJson(histRes),
        parseJson(secRes)
      ]);
      setSummaries(sumData.accounts || []);
      setCompareHistory(histData.accounts || []);
      setSectors(secData.sectors || []);
      setSectorEquity(Number(secData.equity) || 0);
    } catch (err) {
      if (shouldIgnoreRouteLoadError(err)) return;
      setError(err?.message || 'Failed to load portfolio insights');
      setSummaries([]);
      setCompareHistory([]);
      setSectors([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch, pathname, navEpoch]);

  return {
    summaries,
    compareHistory,
    sectors,
    sectorEquity,
    loading,
    error,
    refetch
  };
}
