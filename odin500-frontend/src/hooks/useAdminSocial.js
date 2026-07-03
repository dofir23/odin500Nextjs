'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '../store/apiStore.js';

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }
  return payload;
}

export function useAdminSocial() {
  const [posts, setPosts] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [healthRes, postsRes] = await Promise.all([
        fetchWithAuth('/api/social/health', { method: 'GET' }),
        fetchWithAuth('/api/social/posts?limit=50', { method: 'GET' })
      ]);
      const healthData = await parseJson(healthRes);
      const postsData = await parseJson(postsRes);
      setHealth(healthData);
      setPosts(postsData.posts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load social drafts');
      setHealth(null);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runJob = useCallback(
    async (name, body = {}) => {
      setGenerating(name);
      setError('');
      try {
        const res = await fetchWithAuth(`/api/social/jobs/${encodeURIComponent(name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        await parseJson(res);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Job failed');
      } finally {
        setGenerating('');
      }
    },
    [load]
  );

  const discardPost = useCallback(
    async (id) => {
      setError('');
      try {
        const res = await fetchWithAuth(
          `/api/social/posts/${encodeURIComponent(id)}/discard`,
          { method: 'POST' }
        );
        await parseJson(res);
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to discard draft');
        await load();
      }
    },
    [load]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { posts, health, loading, generating, error, refetch: load, runJob, discardPost };
}
