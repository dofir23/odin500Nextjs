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

export function useAdminUsers({ page = 1, search = '' } = {}) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        page: String(page),
        per_page: '25',
        search: String(search || '').trim()
      });
      const res = await fetchWithAuth(apiUrl(`/api/admin/users?${qs}`), { method: 'GET' });
      const data = await parseJson(res);
      setUsers(data.users || []);
      setTotal(Number(data.total) || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return { users, total, loading, error, refetch: load };
}

export function useAdminDeleteUser() {
  const deleteUser = useCallback(async (userId) => {
    const id = String(userId || '').trim();
    const res = await fetchWithAuth(apiUrl(`/api/admin/users/${encodeURIComponent(id)}`), {
      method: 'DELETE'
    });
    await parseJson(res);
  }, []);

  return { deleteUser };
}

export function useAdminUserDetail(userId) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const id = String(userId || '').trim();
    if (!id) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(apiUrl(`/api/admin/users/${encodeURIComponent(id)}`), {
        method: 'GET'
      });
      const data = await parseJson(res);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updatePlan = useCallback(
    async (patch) => {
      const id = String(userId || '').trim();
      const res = await fetchWithAuth(apiUrl(`/api/admin/users/${encodeURIComponent(id)}/plan`), {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      await parseJson(res);
      await load();
    },
    [userId, load]
  );

  const setAdmin = useCallback(
    async (isAdmin) => {
      const id = String(userId || '').trim();
      const res = await fetchWithAuth(apiUrl(`/api/admin/users/${encodeURIComponent(id)}/admin`), {
        method: 'PATCH',
        body: JSON.stringify({ is_admin: isAdmin })
      });
      await parseJson(res);
      await load();
    },
    [userId, load]
  );

  const unsubscribeNewsletter = useCallback(async () => {
    const id = String(userId || '').trim();
    const res = await fetchWithAuth(apiUrl(`/api/admin/users/${encodeURIComponent(id)}/newsletter`), {
      method: 'DELETE'
    });
    await parseJson(res);
    await load();
  }, [userId, load]);

  const unpublishPortfolio = useCallback(
    async (accountId) => {
      const res = await fetchWithAuth(
        apiUrl(`/api/admin/portfolios/${encodeURIComponent(accountId)}/unpublish`),
        { method: 'PATCH' }
      );
      await parseJson(res);
      await load();
    },
    [load]
  );

  const deletePortfolio = useCallback(
    async (accountId) => {
      const id = String(userId || '').trim();
      const res = await fetchWithAuth(
        apiUrl(`/api/admin/users/${encodeURIComponent(id)}/portfolios/${encodeURIComponent(accountId)}`),
        { method: 'DELETE' }
      );
      await parseJson(res);
      await load();
    },
    [userId, load]
  );

  const deleteWatchlist = useCallback(
    async (watchlistId) => {
      const id = String(userId || '').trim();
      const res = await fetchWithAuth(
        apiUrl(
          `/api/admin/users/${encodeURIComponent(id)}/watchlists/${encodeURIComponent(watchlistId)}`
        ),
        { method: 'DELETE' }
      );
      await parseJson(res);
      await load();
    },
    [userId, load]
  );

  const deleteUser = useCallback(async () => {
    const id = String(userId || '').trim();
    const res = await fetchWithAuth(apiUrl(`/api/admin/users/${encodeURIComponent(id)}`), {
      method: 'DELETE'
    });
    await parseJson(res);
  }, [userId]);

  return {
    detail,
    loading,
    error,
    refetch: load,
    updatePlan,
    setAdmin,
    unsubscribeNewsletter,
    unpublishPortfolio,
    deletePortfolio,
    deleteWatchlist,
    deleteUser
  };
}

export function useAdminPortfolios() {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth(apiUrl('/api/admin/content/portfolios'), { method: 'GET' });
      const data = await parseJson(res);
      setPortfolios(data.portfolios || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolios');
      setPortfolios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unpublish = useCallback(
    async (accountId) => {
      const res = await fetchWithAuth(
        apiUrl(`/api/admin/portfolios/${encodeURIComponent(accountId)}/unpublish`),
        { method: 'PATCH' }
      );
      await parseJson(res);
      await load();
    },
    [load]
  );

  return { portfolios, loading, error, refetch: load, unpublish };
}

export function useAdminNewsletters() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchWithAuth(apiUrl('/api/admin/content/newsletters'), { method: 'GET' });
        const data = await parseJson(res);
        if (!cancelled) setIssues(data.issues || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load newsletters');
          setIssues([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { issues, loading, error };
}

export function useAdminSubscribers() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchWithAuth(apiUrl('/api/admin/subscribers'), { method: 'GET' });
        const data = await parseJson(res);
        if (!cancelled) setSubscribers(data.subscribers || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load subscribers');
          setSubscribers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { subscribers, loading, error };
}
