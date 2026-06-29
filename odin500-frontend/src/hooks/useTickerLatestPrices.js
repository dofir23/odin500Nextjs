'use client';
import { useEffect, useMemo, useState } from 'react';
import { canFetchMarketData, fetchJsonCached } from '../store/apiStore.js';
import { latestCloseFromOhlcPayload } from '../utils/marketOhlcLatest.js';

/**
 * @param {string[]} tickers
 * @param {{ enabled?: boolean }} [options]
 */
export function useTickerLatestPrices(tickers = [], { enabled = true } = {}) {
  const symbols = useMemo(() => {
    const unique = [...new Set((tickers || []).map((t) => String(t || '').trim().toUpperCase()).filter(Boolean))];
    unique.sort();
    return unique;
  }, [tickers]);

  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const symbolsKey = symbols.join(',');

  useEffect(() => {
    if (!enabled || !symbols.length) {
      setPrices({});
      setLoading(false);
      setError('');
      return undefined;
    }

    if (!canFetchMarketData()) {
      setPrices({});
      setLoading(false);
      setError('Sign in to load prices');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const entries = await Promise.all(
          symbols.map(async (sym) => {
            const res = await fetchJsonCached({
              path: '/api/market/ohlc?symbol=' + encodeURIComponent(sym) + '&limit=5',
              method: 'GET',
              ttlMs: 60 * 1000
            });
            return [sym, latestCloseFromOhlcPayload(res.data)];
          })
        );
        if (cancelled) return;
        setPrices(Object.fromEntries(entries));
        setError('');
      } catch (err) {
        if (!cancelled) {
          setPrices({});
          setError(err?.message || 'Could not load prices');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, symbolsKey, symbols]);

  return { prices, loading, error, symbols };
}
