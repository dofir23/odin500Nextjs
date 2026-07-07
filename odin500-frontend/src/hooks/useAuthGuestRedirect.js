'use client';

import { useEffect } from 'react';
import { useLocation, useSearchParams } from '@/navigation/appRouterCompat.jsx';
import { useLoginGateOptional } from '../context/LoginGateContext.jsx';
import { getAuthToken, isAuthHydrated } from '../store/apiStore.js';
import { hardNavigate } from '../utils/installChunkLoadRecovery.js';
import { GUEST_AUTH_ENTRY_PATHS, resolvePostLoginPath } from '../utils/authRedirect.js';

/**
 * Redirect users with an active session away from login/signup entry pages.
 * Logged-in = getAuthToken() truthy after initAuthSessionOnLoad() (backed by session cookies).
 */
export function useAuthGuestRedirect(fallback = '/market') {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const gate = useLoginGateOptional();
  const authReady = gate?.authReady ?? isAuthHydrated();
  const loggedIn = gate?.isLoggedIn ?? Boolean(getAuthToken());

  useEffect(() => {
    if (!GUEST_AUTH_ENTRY_PATHS.has(pathname)) return;
    if (!authReady || !loggedIn) return;
    hardNavigate(resolvePostLoginPath(searchParams, fallback));
  }, [authReady, loggedIn, pathname, searchParams, fallback]);
}
