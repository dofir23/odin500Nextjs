'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth } from '../store/apiStore.js';

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }
  return payload;
}

export function useAdmin({ enabled = true } = {}) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(apiUrl('/api/admin/me'), { method: 'GET' });
      const data = await parseJson(res);
      setIsAdmin(Boolean(data.isAdmin));
    } catch (err) {
      setIsAdmin(false);
      setError(err instanceof Error ? err.message : 'Failed to check admin status');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { isAdmin, loading, error, refetch: load };
}

export function useAdminOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(apiUrl('/api/admin/overview'), { method: 'GET' });
      const data = await parseJson(res);
      setOverview(data.overview || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { overview, loading, error, refetch: load };
}
