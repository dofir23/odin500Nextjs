'use client';
import { paperPositionsPollMs } from '../lib/env.js';
import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth, canFetchProtectedApi } from '../store/apiStore.js';
import { shouldIgnoreRouteLoadError, useRouteNavigationDeps } from './useRouteLoadGuard.js';

/** Default 5 min — positions use daily close prices; override with VITE_PAPER_POSITIONS_POLL_MS. Set 0 to disable. */
const POLL_MS = (() => {
  const raw = paperPositionsPollMs();
  if (raw === '0' || raw === 0) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 300000;
})();

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }
  return payload;
}

/**
 * @param {{ enabled?: boolean }} [options] — when false, skips fetch/poll (e.g. logged out).
 */
export function usePaperPositions({ enabled = true, accountId = '' } = {}) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { pathname, navEpoch } = useRouteNavigationDeps();

  const refetch = useCallback(async () => {
    if (!enabled || !canFetchProtectedApi()) {
      setPositions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
      const res = await fetchWithAuth(apiUrl(`/api/paper/positions${qs}`), { method: 'GET' });
      const data = await parseJson(res);
      setPositions(data.positions || []);
    } catch (err) {
      if (!shouldIgnoreRouteLoadError(err)) setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, accountId]);

  useEffect(() => {
    if (!enabled) {
      setPositions([]);
      setLoading(false);
      return undefined;
    }
    void refetch();
    if (POLL_MS <= 0) return undefined;
    const t = window.setInterval(() => {
      void refetch();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [refetch, enabled, pathname, navEpoch]);

  return { positions, loading, refetch };
}
