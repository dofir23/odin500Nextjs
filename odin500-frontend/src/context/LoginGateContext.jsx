'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { getAuthToken, initAuthSessionOnLoad, isAuthHydrated } from '../store/apiStore.js';
import { LoginRequiredModal } from '../components/LoginRequiredModal.jsx';
import { GUEST_AUTH_ENTRY_PATHS, buildAuthEntryUrl } from '../utils/authRedirect.js';

const LoginGateContext = createContext(null);

export function LoginGateProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);
  const [authReady, setAuthReady] = useState(() => isAuthHydrated());
  const dismissRef = useRef(null);
  const returnToRef = useRef(null);

  useEffect(() => {
    const onAuth = () => setAuthEpoch((e) => e + 1);
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, []);

  useEffect(() => {
    const finish = () => setAuthReady(true);
    if (isAuthHydrated()) {
      finish();
      return undefined;
    }
    window.addEventListener('odin-auth-hydrated', finish);
    void initAuthSessionOnLoad().finally(finish);
    return () => window.removeEventListener('odin-auth-hydrated', finish);
  }, []);

  const isLoggedIn = Boolean(getAuthToken());
  void authEpoch;

  useEffect(() => {
    if (GUEST_AUTH_ENTRY_PATHS.has(pathname)) {
      dismissRef.current = null;
      returnToRef.current = null;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (isLoggedIn && open) {
      dismissRef.current = null;
      returnToRef.current = null;
      setOpen(false);
    }
  }, [isLoggedIn, open]);

  const resolveReturnTo = useCallback(() => {
    const explicit = returnToRef.current;
    if (explicit && explicit.startsWith('/')) return explicit;
    if (typeof window === 'undefined') return '/market';
    const current = window.location.pathname + window.location.search;
    if (current.startsWith('/') && !GUEST_AUTH_ENTRY_PATHS.has(current.split('?')[0])) {
      return current;
    }
    return '/market';
  }, []);

  /** @param {{ onDismiss?: () => void, returnTo?: string }} [opts] */
  const showLoginRequired = useCallback((opts) => {
    if (Boolean(getAuthToken())) return;
    if (GUEST_AUTH_ENTRY_PATHS.has(pathname)) return;
    dismissRef.current = typeof opts?.onDismiss === 'function' ? opts.onDismiss : null;
    returnToRef.current =
      typeof opts?.returnTo === 'string' && opts.returnTo.startsWith('/') ? opts.returnTo : null;
    setOpen(true);
  }, [pathname]);

  const closeLoginRequired = useCallback(() => {
    setOpen(false);
    const onDismiss = dismissRef.current;
    dismissRef.current = null;
    if (typeof onDismiss === 'function') onDismiss();
  }, []);

  const requireLogin = useCallback((onAllowed) => {
    if (Boolean(getAuthToken())) {
      if (typeof onAllowed === 'function') onAllowed();
      return true;
    }
    setOpen(true);
    return false;
  }, []);

  const goLogin = useCallback(() => {
    const dest = buildAuthEntryUrl('/login', resolveReturnTo());
    dismissRef.current = null;
    returnToRef.current = null;
    setOpen(false);
    navigate(dest);
  }, [navigate, resolveReturnTo]);

  const goSignup = useCallback(() => {
    const dest = buildAuthEntryUrl('/signup', resolveReturnTo());
    dismissRef.current = null;
    returnToRef.current = null;
    setOpen(false);
    navigate(dest);
  }, [navigate, resolveReturnTo]);

  const value = useMemo(
    () => ({ isLoggedIn, authReady, requireLogin, showLoginRequired, loginModalOpen: open }),
    [isLoggedIn, authReady, requireLogin, showLoginRequired, open]
  );

  return (
    <LoginGateContext.Provider value={value}>
      {children}
      <LoginRequiredModal open={open} onClose={closeLoginRequired} onLogin={goLogin} onSignup={goSignup} />
    </LoginGateContext.Provider>
  );
}

export function useLoginGate() {
  const ctx = useContext(LoginGateContext);
  if (!ctx) throw new Error('useLoginGate must be used within LoginGateProvider');
  return ctx;
}

export function useLoginGateOptional() {
  return useContext(LoginGateContext);
}
