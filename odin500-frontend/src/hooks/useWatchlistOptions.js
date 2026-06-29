'use client';
import { useCallback, useEffect, useState } from 'react';
import { fetchJsonCached, canFetchProtectedApi } from '../store/apiStore.js';
import { optionsFromApiArrays } from '../utils/watchlistOptions.js';

/**
 * Loads user + default watchlist options for strategy picker.
 */
export function useWatchlistOptions() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!canFetchProtectedApi()) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ttlMs = 2 * 60 * 1000;
      const [defaultsRes, mineRes] = await Promise.all([
        fetchJsonCached({ path: '/api/watchlists/defaults', auth: false, ttlMs }),
        fetchJsonCached({ path: '/api/watchlists', auth: true, ttlMs })
      ]);
      const defaultsRaw = defaultsRes?.data ?? defaultsRes;
      const mineRaw = mineRes?.data ?? mineRes;
      setOptions(optionsFromApiArrays(defaultsRaw, mineRaw));
    } catch (err) {
      setError(err?.message || 'Failed to load watchlists');
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { options, loading, error, reload: load };
}
