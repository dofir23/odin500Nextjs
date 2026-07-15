'use client';
// fetchWithAuth: store/apiStore.js — apiUrl from utils/apiOrigin.js (same as useHeaderProfile).
// Auth: ProtectedRoute in appRoutes.jsx; API uses requireAuthStrict on /api/paper.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth, canFetchProtectedApi } from '../store/apiStore.js';
import { usePaperSessionStore } from '../store/paperSessionStore.js';
import { shouldIgnoreRouteLoadError, useRouteNavigationDeps } from './useRouteLoadGuard.js';

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }
  return payload;
}

export function usePaperAccount() {
  const activeAccountId = usePaperSessionStore((s) => s.activeAccountId);
  const setActiveAccountId = usePaperSessionStore((s) => s.setActiveAccountId);
  const setAccountsInStore = usePaperSessionStore((s) => s.setAccounts);
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const accountFetchGenRef = useRef(0);
  const { pathname, navEpoch } = useRouteNavigationDeps();

  useEffect(() => {
    usePaperSessionStore.getState().ensureActiveAccountId();
  }, []);

  const loadAccounts = useCallback(async (opts = {}) => {
    if (!canFetchProtectedApi()) return [];
    try {
      const res = await fetchWithAuth(apiUrl('/api/paper/accounts'), { method: 'GET' });
      const payload = await parseJson(res);
      const rows = payload.accounts || [];
      setAccounts(rows);
      setAccountsInStore(rows.map((a) => ({ id: a.id, name: a.name })));
      const currentId = usePaperSessionStore.getState().activeAccountId;
      if (opts.pickFirstIfMissing) {
        if (!rows.length) setActiveAccountId('');
        else if (!rows.some((a) => a.id === currentId)) setActiveAccountId(rows[0].id);
      } else if (!currentId && rows.length) {
        setActiveAccountId(rows[0].id);
      }
      return rows;
    } catch (err) {
      if (shouldIgnoreRouteLoadError(err)) return [];
      throw err;
    }
  }, [setActiveAccountId, setAccountsInStore]);

  const refetch = useCallback(async (accountIdOverride) => {
    if (!canFetchProtectedApi()) {
      setAccount(null);
      setLoading(false);
      return;
    }
    const accountId =
      accountIdOverride !== undefined && accountIdOverride !== null
        ? accountIdOverride
        : usePaperSessionStore.getState().activeAccountId;
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
      if (data?.id && data.id !== usePaperSessionStore.getState().activeAccountId) {
        setActiveAccountId(data.id);
      }
    } catch (err) {
      if (fetchGen !== accountFetchGenRef.current) return;
      if (shouldIgnoreRouteLoadError(err)) return;
      setError(err?.message || 'Failed to load virtual portfolio account');
      setAccount(null);
    } finally {
      if (fetchGen === accountFetchGenRef.current) {
        setLoading(false);
      }
    }
  }, [setActiveAccountId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts, pathname, navEpoch]);

  useEffect(() => {
    void refetch();
  }, [refetch, pathname, navEpoch, activeAccountId]);

  const resetPortfolio = useCallback(async () => {
    const id = usePaperSessionStore.getState().activeAccountId;
    const res = await fetchWithAuth(
      apiUrl(`/api/paper/account/reset${id ? `?account_id=${encodeURIComponent(id)}` : ''}`),
      { method: 'POST' }
    );
    await parseJson(res);
    await refetch();
  }, [refetch]);

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
    [loadAccounts, refetch, setActiveAccountId]
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
    [loadAccounts, refetch, setActiveAccountId]
  );

  const setPublished = useCallback(
    async (accountId, published, meta = {}) => {
      const id = String(accountId || usePaperSessionStore.getState().activeAccountId || '').trim();
      if (!id) throw new Error('No account selected');
      const path = published
        ? `/api/paper/accounts/${encodeURIComponent(id)}/publish`
        : `/api/paper/accounts/${encodeURIComponent(id)}/unpublish`;
      const res = await fetchWithAuth(apiUrl(path), {
        method: 'PATCH',
        headers: published ? { 'Content-Type': 'application/json' } : undefined,
        body: published
          ? JSON.stringify({
              publishDescription: meta.publishDescription,
              publishStrategy: meta.publishStrategy
            })
          : undefined
      });
      const updated = await parseJson(res);
      await loadAccounts();
      if (id === usePaperSessionStore.getState().activeAccountId) {
        setAccount((prev) => (prev ? { ...prev, ...updated } : updated));
      }
      return updated;
    },
    [loadAccounts]
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
    deleteAccount,
    setPublished
  };
}
