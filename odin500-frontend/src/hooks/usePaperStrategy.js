'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function accountQs(accountId) {
  if (!accountId) return '';
  return `?account_id=${encodeURIComponent(accountId)}`;
}

export function usePaperStrategy(accountId) {
  const [strategy, setStrategy] = useState(null);
  const [binding, setBinding] = useState(null);
  const [rules, setRules] = useState([]);
  const [executionLog, setExecutionLog] = useState([]);
  const [automatedAccountIds, setAutomatedAccountIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const strategyFetchGenRef = useRef(0);
  const lastLoadedAccountRef = useRef(null);
  const { pathname, navEpoch } = useRouteNavigationDeps();

  const strategyActive = useMemo(() => {
    return !!(binding?.is_active && strategy && strategy.is_active !== false);
  }, [binding, strategy]);

  useEffect(() => {
    usePaperSessionStore.getState().setStrategyActive(strategyActive);
  }, [strategyActive]);

  const loadAutomatedAccounts = useCallback(async () => {
    if (!canFetchProtectedApi()) return new Set();
    try {
      const res = await fetchWithAuth(apiUrl('/api/paper/strategies'), { method: 'GET' });
      const payload = await parseJson(res);
      const ids = new Set();
      for (const s of payload.strategies || []) {
        for (const b of s.paper_strategy_account_bindings || []) {
          if (b.is_active) ids.add(b.account_id);
        }
      }
      setAutomatedAccountIds(ids);
      return ids;
    } catch (err) {
      if (shouldIgnoreRouteLoadError(err)) return new Set();
      throw err;
    }
  }, []);

  const loadByAccount = useCallback(async (id, opts = {}) => {
    const silent = opts.silent === true;
    if (!canFetchProtectedApi() || !id) {
      setStrategy(null);
      setBinding(null);
      setRules([]);
      setLoading(false);
      return;
    }
    const fetchGen = ++strategyFetchGenRef.current;
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(
        apiUrl(`/api/paper/strategies/by-account${accountQs(id)}`),
        { method: 'GET' }
      );
      const data = await parseJson(res);
      if (fetchGen !== strategyFetchGenRef.current) return;
      setStrategy(data.strategy || null);
      setBinding(data.binding || null);
      setRules(data.rules || []);
      if (fetchGen === strategyFetchGenRef.current) {
        lastLoadedAccountRef.current = id;
      }
    } catch (err) {
      if (fetchGen !== strategyFetchGenRef.current) return;
      if (shouldIgnoreRouteLoadError(err)) return;
      setError(err?.message || 'Failed to load strategy');
      setStrategy(null);
      setBinding(null);
      setRules([]);
      lastLoadedAccountRef.current = null;
    } finally {
      if (fetchGen === strategyFetchGenRef.current && !silent) {
        setLoading(false);
      }
    }
  }, []);

  const loadExecutionLog = useCallback(async (id, limit = 50) => {
    if (!canFetchProtectedApi() || !id) {
      setExecutionLog([]);
      return;
    }
    try {
      const qs = `${accountQs(id)}${accountQs(id) ? '&' : '?'}limit=${limit}`;
      const res = await fetchWithAuth(apiUrl(`/api/paper/strategies/execution-log${qs}`), {
        method: 'GET'
      });
      const data = await parseJson(res);
      setExecutionLog(data.log || []);
    } catch (err) {
      if (shouldIgnoreRouteLoadError(err)) return;
      throw err;
    }
  }, []);

  const refetch = useCallback(
    async (accountIdOverride, opts = {}) => {
      const id = accountIdOverride !== undefined && accountIdOverride !== null ? accountIdOverride : accountId;
      await Promise.all([loadByAccount(id, opts), loadExecutionLog(id), loadAutomatedAccounts()]);
    },
    [accountId, loadByAccount, loadExecutionLog, loadAutomatedAccounts]
  );

  useEffect(() => {
    void loadAutomatedAccounts();
  }, [loadAutomatedAccounts, pathname, navEpoch]);

  useEffect(() => {
    lastLoadedAccountRef.current = null;
  }, [pathname, navEpoch]);

  useEffect(() => {
    if (!canFetchProtectedApi() || !accountId) {
      lastLoadedAccountRef.current = null;
      setStrategy(null);
      setBinding(null);
      setRules([]);
      setLoading(false);
      return;
    }
    if (lastLoadedAccountRef.current === accountId) return;
    void loadByAccount(accountId);
  }, [accountId, loadByAccount, pathname, navEpoch]);

  useEffect(() => {
    void loadExecutionLog(accountId);
  }, [accountId, loadExecutionLog, pathname, navEpoch]);

  const createStrategy = useCallback(async ({ name, description, is_active = true }) => {
    const res = await fetchWithAuth(apiUrl('/api/paper/strategies'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, is_active })
    });
    return parseJson(res);
  }, []);

  const addRule = useCallback(async (strategyId, rule) => {
    const res = await fetchWithAuth(apiUrl(`/api/paper/strategies/${strategyId}/rules`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    return parseJson(res);
  }, []);

  const updateRule = useCallback(async (strategyId, ruleId, patch) => {
    const res = await fetchWithAuth(apiUrl(`/api/paper/strategies/${strategyId}/rules/${ruleId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    return parseJson(res);
  }, []);

  const deleteRule = useCallback(async (strategyId, ruleId) => {
    const res = await fetchWithAuth(apiUrl(`/api/paper/strategies/${strategyId}/rules/${ruleId}`), {
      method: 'DELETE'
    });
    return parseJson(res);
  }, []);

  const bindStrategy = useCallback(async (strategyId, account_id, is_active = true) => {
    const res = await fetchWithAuth(apiUrl(`/api/paper/strategies/${strategyId}/bindings`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id, is_active })
    });
    return parseJson(res);
  }, []);

  const patchBinding = useCallback(async (strategyId, account_id, patch) => {
    const res = await fetchWithAuth(apiUrl(`/api/paper/strategies/${strategyId}/bindings`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id, ...patch })
    });
    return parseJson(res);
  }, []);

  const patchStrategy = useCallback(async (strategyId, patch) => {
    const res = await fetchWithAuth(apiUrl(`/api/paper/strategies/${strategyId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    const data = await parseJson(res);
    setStrategy((prev) => (prev && prev.id === strategyId ? { ...prev, ...data } : prev));
    return data;
  }, []);

  const runOnce = useCallback(async (id) => {
    const res = await fetchWithAuth(apiUrl(`/api/paper/strategies/run-once${accountQs(id)}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: id })
    });
    return parseJson(res);
  }, []);

  return {
    strategy,
    binding,
    rules,
    executionLog,
    strategyActive,
    automatedAccountIds,
    loading,
    error,
    refetch,
    loadByAccount,
    loadExecutionLog,
    loadAutomatedAccounts,
    createStrategy,
    addRule,
    updateRule,
    deleteRule,
    bindStrategy,
    patchBinding,
    patchStrategy,
    runOnce
  };
}
