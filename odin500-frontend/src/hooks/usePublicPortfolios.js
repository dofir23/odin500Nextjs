'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

const EMPTY_PAGINATION = {
  page: 1,
  page_size: 10,
  total: 0,
  total_pages: 1,
  has_prev: false,
  has_next: false
};

/**
 * Server-paginated published portfolios. Filtering, sorting and paging all happen on the
 * API (`?page=&page_size=&sort=&dir=&ai_only=&ai=&owner=&engine=&index=&direction=&q=`) so the
 * browser only ever holds one page of rows.
 *
 * `q` is matched against portfolio name and owner. Debounce it at the call site — every change
 * is a request.
 *
 * @param {{ page?: number, pageSize?: number, sort?: string, dir?: 'asc'|'desc',
 *           aiOnly?: boolean, ai?: ''|'ai'|'manual', owner?: ''|'admin'|'user',
 *           engine?: string, index?: string, direction?: string, q?: string,
 *           enabled?: boolean }} params
 */
export function usePublicPortfoliosPaged(params = {}) {
  const {
    page = 1,
    pageSize = 10,
    sort = 'total_return_pct',
    dir = 'desc',
    aiOnly = false,
    /** '' = both kinds, 'ai' = engine-tagged only, 'manual' = built by hand only. */
    ai = '',
    /** '' = every owner, 'admin' = Odin's own books, 'user' = member-published. */
    owner = '',
    engine = '',
    index = '',
    direction = '',
    q = '',
    enabled = true
  } = params;

  const [portfolios, setPortfolios] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [facets, setFacets] = useState({ engines: [] });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('page_size', String(pageSize));
    qs.set('sort', sort);
    qs.set('dir', dir);
    if (aiOnly) qs.set('ai_only', '1');
    if (ai) qs.set('ai', ai);
    if (owner) qs.set('owner', owner);
    if (engine && engine !== '__all__') qs.set('engine', engine);
    if (index && index !== '__all__') qs.set('index', index);
    if (direction && direction !== '__all__') qs.set('direction', direction);
    const search = String(q || '').trim();
    if (search) qs.set('q', search);
    return qs.toString();
  }, [page, pageSize, sort, dir, aiOnly, ai, owner, engine, index, direction, q]);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/public/paper/portfolios?${query}`));
      const payload = await parseJson(res);
      setPortfolios(payload.portfolios || []);
      setPagination(payload.pagination || EMPTY_PAGINATION);
      setFacets(payload.facets || { engines: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load public portfolios');
      setPortfolios([]);
      setPagination(EMPTY_PAGINATION);
    } finally {
      setLoading(false);
    }
  }, [query, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { portfolios, pagination, facets, loading, error, refetch: load };
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
