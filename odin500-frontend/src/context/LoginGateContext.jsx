'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { getAuthToken, initAuthSessionOnLoad, isAuthHydrated } from '../store/apiStore.js';
import { LoginRequiredModal } from '../components/LoginRequiredModal.jsx';

const LoginGateContext = createContext(null);

export function LoginGateProvider({ children }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);
  const [authReady, setAuthReady] = useState(() => isAuthHydrated());

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

  const dismissRef = useRef(null);

  useEffect(() => {
    if (isLoggedIn && open) {
      dismissRef.current = null;
      setOpen(false);
    }
  }, [isLoggedIn, open]);

  /** @param {{ onDismiss?: () => void }} [opts] */
  const showLoginRequired = useCallback((opts) => {
    if (Boolean(getAuthToken())) return;
    dismissRef.current = typeof opts?.onDismiss === 'function' ? opts.onDismiss : null;
    setOpen(true);
  }, []);

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
    setOpen(false);
    navigate('/login');
  }, [navigate]);

  const goSignup = useCallback(() => {
    setOpen(false);
    navigate('/signup');
  }, [navigate]);

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
