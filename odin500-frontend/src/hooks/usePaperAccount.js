'use client';
// fetchWithAuth: store/apiStore.js — apiUrl from utils/apiOrigin.js (same as useHeaderProfile).
// Auth: ProtectedRoute in appRoutes.jsx; API uses requireAuthStrict on /api/paper.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth, canFetchProtectedApi } from '../store/apiStore.js';
import { shouldIgnoreRouteLoadError, useRouteNavigationDeps } from './useRouteLoadGuard.js';

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }
  return payload;
}

export function usePaperAccount() {
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState(() => {
    try {
      return window.localStorage.getItem('paper.activeAccountId') || '';
    } catch {
      return '';
    }
  });
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const accountFetchGenRef = useRef(0);
  const { pathname, navEpoch } = useRouteNavigationDeps();

  const loadAccounts = useCallback(async (opts = {}) => {
    if (!canFetchProtectedApi()) return [];
    try {
      const res = await fetchWithAuth(apiUrl('/api/paper/accounts'), { method: 'GET' });
      const payload = await parseJson(res);
      const rows = payload.accounts || [];
      setAccounts(rows);
      if (opts.pickFirstIfMissing) {
        if (!rows.length) setActiveAccountId('');
        else if (!rows.some((a) => a.id === activeAccountId)) setActiveAccountId(rows[0].id);
      } else if (!activeAccountId && rows.length) {
        setActiveAccountId(rows[0].id);
      }
      return rows;
    } catch (err) {
      if (shouldIgnoreRouteLoadError(err)) return [];
      throw err;
    }
  }, [activeAccountId]);

  const refetch = useCallback(async (accountIdOverride) => {
    if (!canFetchProtectedApi()) {
      setAccount(null);
      setLoading(false);
      return;
    }
    const accountId =
      accountIdOverride !== undefined && accountIdOverride !== null
        ? accountIdOverride
        : activeAccountId;
    const fetchGen = ++accountFetchGenRef.current;
    setLoading(true);
    setError('');
    try {
      if (!accountId) {
        if (fetchGen === accountFetchGenRef.current) {
          setAccount(null);
        }
        return;
      }
      const qs = `?account_id=${encodeURIComponent(accountId)}`;
      const res = await fetchWithAuth(apiUrl(`/api/paper/account${qs}`), { method: 'GET' });
      const data = await parseJson(res);
      if (fetchGen !== accountFetchGenRef.current) return;
      setAccount(data);
      if (data?.id && data.id !== activeAccountId) setActiveAccountId(data.id);
    } catch (err) {
      if (fetchGen !== accountFetchGenRef.current) return;
      if (shouldIgnoreRouteLoadError(err)) return;
      setError(err?.message || 'Failed to load paper account');
      setAccount(null);
    } finally {
      if (fetchGen === accountFetchGenRef.current) {
        setLoading(false);
      }
    }
  }, [activeAccountId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts, pathname, navEpoch]);

  useEffect(() => {
    void refetch();
  }, [refetch, pathname, navEpoch]);

  useEffect(() => {
    try {
      if (activeAccountId) window.localStorage.setItem('paper.activeAccountId', activeAccountId);
      else window.localStorage.removeItem('paper.activeAccountId');
    } catch {
      // ignore storage errors
    }
  }, [activeAccountId]);

  const resetPortfolio = useCallback(async () => {
    const res = await fetchWithAuth(
      apiUrl(`/api/paper/account/reset${activeAccountId ? `?account_id=${encodeURIComponent(activeAccountId)}` : ''}`),
      { method: 'POST' }
    );
    await parseJson(res);
    await refetch();
  }, [refetch, activeAccountId]);

  const createAccount = useCallback(
    async ({ name, starting_capital, activate = true }) => {
      const res = await fetchWithAuth(apiUrl('/api/paper/accounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, starting_capital })
      });
      const created = await parseJson(res);
      await loadAccounts();
      if (activate && created?.id) {
        setActiveAccountId(created.id);
        await refetch(created.id);
      }
      return created;
    },
    [loadAccounts, refetch]
  );

  const deleteAccount = useCallback(
    async (accountId) => {
      const id = String(accountId || '').trim();
      if (!id) throw new Error('No account selected');
      const res = await fetchWithAuth(apiUrl(`/api/paper/accounts/${encodeURIComponent(id)}`), {
        method: 'DELETE'
      });
      await parseJson(res);
      const rows = await loadAccounts({ pickFirstIfMissing: true });
      const nextId = rows[0]?.id || '';
      setActiveAccountId(nextId);
      setError('');
      if (!nextId) {
        accountFetchGenRef.current += 1;
        setAccount(null);
        setLoading(false);
        return { deletedId: id, nextAccountId: null };
      }
      await refetch(nextId);
      return { deletedId: id, nextAccountId: nextId };
    },
    [loadAccounts, refetch]
  );

  return {
    account,
    accounts,
    activeAccountId,
    setActiveAccountId,
    loading,
    error,
    refetch,
    resetPortfolio,
    createAccount,
    deleteAccount
  };
}
