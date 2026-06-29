'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { apiUrl } from '../utils/apiOrigin.js';
import {
  clearApiCache,
  clearAuthToken,
  fetchWithAuth,
  getAuthToken,
  getProfileEmailLocalPart,
  isAuthDisabled,
  profileInitialsFromName
} from '../store/apiStore.js';

/**
 * Profile label/avatar for header rails. Shows Guest when signed out (no stale email).
 */
export function useHeaderProfile({ guestLabel = 'Guest', signedInFallback = 'Profile' } = {}) {
  const navigate = useNavigate();
  const [authEpoch, setAuthEpoch] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const loggedIn = Boolean(getAuthToken());

  const profileName = useMemo(() => {
    if (!loggedIn) return guestLabel;
    const emailPart = getProfileEmailLocalPart();
    return (displayName || emailPart || signedInFallback).trim();
  }, [loggedIn, displayName, authEpoch, guestLabel, signedInFallback]);

  const initials = useMemo(
    () => profileInitialsFromName(profileName, 'G'),
    [profileName]
  );

  const resetProfileState = useCallback(() => {
    setDisplayName('');
    setAvatarUrl('');
  }, []);

  const handleSignOut = useCallback(() => {
    clearAuthToken();
    clearApiCache();
    resetProfileState();
    if (isAuthDisabled()) {
      navigate('/market', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, resetProfileState]);

  const goToSignIn = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const onAuth = () => setAuthEpoch((e) => e + 1);
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!getAuthToken()) {
        resetProfileState();
        return;
      }

      try {
        const res = await fetchWithAuth(apiUrl('/api/user/profile'), { method: 'GET' });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!getAuthToken()) {
          resetProfileState();
          return;
        }
        if (!res.ok) {
          resetProfileState();
          return;
        }
        const apiName = payload?.userName || payload?.displayName || '';
        setDisplayName(apiName ? String(apiName) : '');
        setAvatarUrl(String(payload?.avatarUrl || ''));
      } catch {
        if (!cancelled) resetProfileState();
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [authEpoch, resetProfileState]);

  return {
    loggedIn,
    profileName,
    initials,
    avatarUrl,
    handleSignOut,
    goToSignIn
  };
}
