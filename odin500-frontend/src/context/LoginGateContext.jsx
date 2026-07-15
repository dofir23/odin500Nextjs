'use client';
import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { initAuthSessionOnLoad, isAuthHydrated } from '../store/apiStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useUiStore } from '../store/uiStore.js';
import { LoginRequiredModal } from '../components/LoginRequiredModal.jsx';

/**
 * Thin shell: registers navigate + hydrate, renders login modal from uiStore.
 * State lives in Zustand (authStore / uiStore).
 */
export function LoginGateProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const loginModalOpen = useUiStore((s) => s.loginModalOpen);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  useEffect(() => {
    useUiStore.getState().setAuthNavigate(navigate);
    return () => useUiStore.getState().setAuthNavigate(null);
  }, [navigate]);

  useEffect(() => {
    useUiStore.getState().setRequireLoginFn((action) =>
      useUiStore.getState().requireLogin(action, pathname)
    );
    return () => useUiStore.getState().setRequireLoginFn(null);
  }, [pathname]);

  useEffect(() => {
    const finish = () => useAuthStore.getState().markHydrated();
    if (isAuthHydrated()) {
      finish();
      return undefined;
    }
    window.addEventListener('odin-auth-hydrated', finish);
    void initAuthSessionOnLoad().finally(finish);
    return () => window.removeEventListener('odin-auth-hydrated', finish);
  }, []);

  useEffect(() => {
    useUiStore.getState().clearLoginGateOnAuthPath(pathname);
  }, [pathname]);

  useEffect(() => {
    useUiStore.getState().closeLoginIfLoggedIn();
  }, [isLoggedIn, loginModalOpen]);

  const closeLoginRequired = useCallback(() => {
    useUiStore.getState().closeLoginRequired();
  }, []);

  const goLogin = useCallback(() => {
    useUiStore.getState().goLogin();
  }, []);

  const goSignup = useCallback(() => {
    useUiStore.getState().goSignup();
  }, []);

  return (
    <>
      {children}
      <LoginRequiredModal
        open={loginModalOpen}
        onClose={closeLoginRequired}
        onLogin={goLogin}
        onSignup={goSignup}
      />
    </>
  );
}

/** @returns {{ isLoggedIn: boolean, authReady: boolean, requireLogin: Function, showLoginRequired: Function, loginModalOpen: boolean }} */
export function useLoginGate() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const authReady = useAuthStore((s) => s.hydrated);
  const loginModalOpen = useUiStore((s) => s.loginModalOpen);
  const { pathname } = useLocation();

  const requireLogin = useCallback(
    (onAllowed) => useUiStore.getState().requireLogin(onAllowed, pathname),
    [pathname]
  );
  const showLoginRequired = useCallback(
    (opts) => useUiStore.getState().showLoginRequired(opts, pathname),
    [pathname]
  );

  return useMemo(
    () => ({ isLoggedIn, authReady, requireLogin, showLoginRequired, loginModalOpen }),
    [isLoggedIn, authReady, requireLogin, showLoginRequired, loginModalOpen]
  );
}

export function useLoginGateOptional() {
  return useLoginGate();
}
