'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth, canFetchProtectedApi } from '../store/apiStore.js';
import { shouldIgnoreRouteLoadError, useRouteNavigationDeps } from './useRouteLoadGuard.js';
import { toast } from '../utils/toast.js';

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }
  return payload;
}

export function usePaperOrders({ accountId = '' } = {}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { pathname, navEpoch } = useRouteNavigationDeps();

  const refetch = useCallback(async () => {
    if (!canFetchProtectedApi()) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
      const res = await fetchWithAuth(apiUrl(`/api/paper/orders${qs}`), { method: 'GET' });
      const data = await parseJson(res);
      setOrders(data.orders || []);
    } catch (err) {
      if (!shouldIgnoreRouteLoadError(err)) setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refetch();
  }, [refetch, pathname, navEpoch]);

  const placeOrder = useCallback(
    async (orderInput) => {
      try {
        const res = await fetchWithAuth(apiUrl('/api/paper/orders'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...orderInput, account_id: accountId || orderInput.account_id })
        });
        const result = await parseJson(res);
        await refetch();
        const ticker = orderInput?.ticker ? ` for ${orderInput.ticker}` : '';
        toast.success(`Order placed${ticker}`);
        return result;
      } catch (err) {
        toast.error(err);
        throw err;
      }
    },
    [refetch, accountId]
  );

  const cancelOrder = useCallback(
    async (orderId) => {
      try {
        const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
        const res = await fetchWithAuth(apiUrl(`/api/paper/orders/${encodeURIComponent(orderId)}${qs}`), {
          method: 'DELETE'
        });
        const result = await parseJson(res);
        await refetch();
        toast.success('Order canceled');
        return result;
      } catch (err) {
        toast.error(err);
        throw err;
      }
    },
    [refetch, accountId]
  );

  const modifyOrder = useCallback(
    async (orderId, patch) => {
      try {
        const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
        const res = await fetchWithAuth(apiUrl(`/api/paper/orders/${encodeURIComponent(orderId)}${qs}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        const result = await parseJson(res);
        await refetch();
        toast.success('Order updated');
        return result;
      } catch (err) {
        toast.error(err);
        throw err;
      }
    },
    [refetch, accountId]
  );

  return { orders, loading, placeOrder, cancelOrder, modifyOrder, refetch };
}
