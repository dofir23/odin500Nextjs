'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';

/**
 * In-app notifications + unread badge for the right-rail bell.
 */
export function useNotifications({ enabled = true, pollMs = 60_000 } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled || !getAuthToken()) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [listRes, countRes] = await Promise.all([
        fetchJsonCached({ path: '/api/notifications?limit=40', auth: true, ttlMs: 15_000, force: true }),
        fetchJsonCached({ path: '/api/notifications/unread-count', auth: true, ttlMs: 15_000, force: true })
      ]);
      setNotifications(Array.isArray(listRes.data?.notifications) ? listRes.data.notifications : []);
      setUnreadCount(Number(countRes.data?.count) || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setBusy(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !getAuthToken()) return undefined;
    const onAuth = () => void load();
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !pollMs || !getAuthToken()) return undefined;
    const t = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(t);
  }, [enabled, pollMs, load]);

  const markRead = useCallback(
    async (id) => {
      if (!id) return;
      try {
        await fetchJsonCached({
          path: `/api/notifications/${encodeURIComponent(id)}/read`,
          method: 'PATCH',
          auth: true,
          force: true,
          ttlMs: 0
        });
        setNotifications((rows) =>
          rows.map((n) =>
            n.id === id ? { ...n, readAt: new Date().toISOString(), unread: false } : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* ignore */
      }
    },
    []
  );

  const markAllRead = useCallback(async () => {
    try {
      await fetchJsonCached({
        path: '/api/notifications/read-all',
        method: 'PATCH',
        auth: true,
        force: true,
        ttlMs: 0
      });
      setNotifications((rows) =>
        rows.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString(), unread: false }))
      );
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  }, []);

  return { notifications, unreadCount, busy, error, reload: load, markRead, markAllRead };
};

/**
 * Newsletter email + in-app subscription toggle.
 */
export function useNewsletterSubscription({ enabled = true } = {}) {
  const [subscribed, setSubscribed] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(true);
  const [inAppOptIn, setInAppOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled || !getAuthToken()) {
      setSubscribed(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetchJsonCached({
        path: '/api/newsletter/subscribe/status',
        auth: true,
        ttlMs: 30_000,
        force: true
      });
      setSubscribed(Boolean(res.data?.subscribed));
      setEmailOptIn(res.data?.emailOptIn !== false);
      setInAppOptIn(res.data?.inAppOptIn !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setBusy(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const subscribe = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetchJsonCached({
        path: '/api/newsletter/subscribe',
        method: 'POST',
        body: { emailOptIn: true, inAppOptIn: true },
        auth: true,
        force: true,
        ttlMs: 0
      });
      setSubscribed(Boolean(res.data?.subscribed));
      setEmailOptIn(res.data?.emailOptIn !== false);
      setInAppOptIn(res.data?.inAppOptIn !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscribe failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await fetchJsonCached({
        path: '/api/newsletter/subscribe',
        method: 'DELETE',
        auth: true,
        force: true,
        ttlMs: 0
      });
      setSubscribed(false);
      setEmailOptIn(false);
      setInAppOptIn(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unsubscribe failed');
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    subscribed,
    emailOptIn,
    inAppOptIn,
    busy,
    error,
    subscribe,
    unsubscribe,
    reload: load
  };
}
