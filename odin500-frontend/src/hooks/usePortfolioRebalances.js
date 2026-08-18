'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth, canFetchProtectedApi } from '../store/apiStore.js';

/**
 * AI rebalance history for one portfolio.
 *
 * Two sources, one shape: the owner's authenticated endpoint and the published read-only one.
 * `readOnly` picks which, so the same component serves both the private and public pages.
 *
 * @param {string} accountId
 * @param {{ readOnly?: boolean, enabled?: boolean }} [options]
 */
export function usePortfolioRebalances(accountId, options = {}) {
  const { readOnly = false, enabled = true } = options;
  const [rebalances, setRebalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const id = String(accountId || '').trim();

  const load = useCallback(async () => {
    if (!id || !enabled) {
      setRebalances([]);
      return;
    }
    // The private endpoint needs a session; without one there is nothing to ask for.
    if (!readOnly && !canFetchProtectedApi()) {
      setRebalances([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const path = readOnly
        ? `/api/public/paper/portfolios/${encodeURIComponent(id)}/rebalances`
        : `/api/paper/accounts/${encodeURIComponent(id)}/rebalances`;
      const res = readOnly
        ? await fetch(apiUrl(path))
        : await fetchWithAuth(apiUrl(path), { method: 'GET' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to load rebalances');
      setRebalances(Array.isArray(payload?.rebalances) ? payload.rebalances : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rebalances');
      setRebalances([]);
    } finally {
      setLoading(false);
    }
  }, [id, readOnly, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rebalances, loading, error, refetch: load };
}
