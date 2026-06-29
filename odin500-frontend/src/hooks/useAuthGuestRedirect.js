'use client';

import { useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from '@/navigation/appRouterCompat.jsx';
import { useLoginGateOptional } from '../context/LoginGateContext.jsx';
import { getAuthToken, isAuthHydrated } from '../store/apiStore.js';

const GUEST_AUTH_ENTRY_PATHS = new Set(['/login', '/signup', '/forgot-password']);

function resolvePostLoginPath(searchParams, fallback = '/market') {
  const next = searchParams?.get('next');
  if (next && next.startsWith('/') && !GUEST_AUTH_ENTRY_PATHS.has(next.split('?')[0])) {
    return next;
  }
  return fallback;
}

/**
 * Redirect users with an active session away from login/signup entry pages.
 * Logged-in = getAuthToken() truthy after initAuthSessionOnLoad() (backed by session cookies).
 */
export function useAuthGuestRedirect(fallback = '/market') {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const gate = useLoginGateOptional();
  const authReady = gate?.authReady ?? isAuthHydrated();
  const loggedIn = gate?.isLoggedIn ?? Boolean(getAuthToken());

  useEffect(() => {
    if (!GUEST_AUTH_ENTRY_PATHS.has(pathname)) return;
    if (!authReady || !loggedIn) return;
    navigate(resolvePostLoginPath(searchParams, fallback), { replace: true });
  }, [authReady, loggedIn, pathname, navigate, searchParams, fallback]);
}
