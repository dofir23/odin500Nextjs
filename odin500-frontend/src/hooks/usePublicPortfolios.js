'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }
  return payload;
}

async function parseJsonOptional(res) {
  if (res.status === 404) return null;
  return parseJson(res);
}

export function usePublicPortfolios() {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/public/paper/portfolios'));
      const payload = await parseJson(res);
      setPortfolios(payload.portfolios || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load public portfolios');
      setPortfolios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { portfolios, loading, error, refetch: load };
}

export function usePublicPortfolio(accountId) {
  const [portfolio, setPortfolio] = useState(null);
  const [history, setHistory] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [closedTotals, setClosedTotals] = useState({ gross_realized_pnl: 0, net_realized_pnl: 0 });
  const [sectors, setSectors] = useState([]);
  const [sectorEquity, setSectorEquity] = useState(0);
  const [orders, setOrders] = useState([]);
  const [strategy, setStrategy] = useState(null);
  const [binding, setBinding] = useState(null);
  const [rules, setRules] = useState([]);
  const [executionLog, setExecutionLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const id = String(accountId || '').trim();
    if (!id) {
      setPortfolio(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const base = `/api/public/paper/portfolios/${encodeURIComponent(id)}`;
      const [detailRes, historyRes, closedRes, sectorsRes, ordersRes, strategyRes] = await Promise.all([
        fetch(apiUrl(base)),
        fetch(apiUrl(`${base}/history`)),
        fetch(apiUrl(`${base}/closed-trades`)),
        fetch(apiUrl(`${base}/sectors`)),
        fetch(apiUrl(`${base}/orders`)),
        fetch(apiUrl(`${base}/strategy`))
      ]);

      const detail = await parseJson(detailRes);
      const hist = await parseJson(historyRes);
      const closed = await parseJson(closedRes);
      const sectorPayload = await parseJson(sectorsRes);
      const ordersPayload = await parseJsonOptional(ordersRes);
      const strategyPayload = await parseJsonOptional(strategyRes);

      setPortfolio(detail.portfolio || null);
      setHistory(hist.history || []);
      setClosedTrades(closed.trades || []);
      setClosedTotals(closed.totals || { gross_realized_pnl: 0, net_realized_pnl: 0 });
      setSectors(sectorPayload.sectors || []);
      setSectorEquity(Number(sectorPayload.equity) || 0);
      setOrders(ordersPayload?.orders || []);
      setStrategy(strategyPayload?.strategy || null);
      setBinding(strategyPayload?.binding || null);
      setRules(strategyPayload?.rules || []);
      setExecutionLog(strategyPayload?.executionLog || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
      setPortfolio(null);
      setHistory([]);
      setClosedTrades([]);
      setSectors([]);
      setOrders([]);
      setStrategy(null);
      setBinding(null);
      setRules([]);
      setExecutionLog([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const strategyActive = Boolean(binding?.is_active && strategy && strategy.is_active !== false);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return {
    portfolio,
    history,
    closedTrades,
    closedTotals,
    sectors,
    sectorEquity,
    orders,
    strategy,
    binding,
    rules,
    executionLog,
    strategyActive,
    pendingCount,
    loading,
    error,
    refetch: load
  };
}
