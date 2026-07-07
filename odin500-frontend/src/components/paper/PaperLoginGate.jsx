'use client';

import { useEffect, useRef } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { useLoginGateOptional } from '../../context/LoginGateContext.jsx';
import { useIsLoggedIn } from '../../hooks/useIsLoggedIn.js';
import { GUEST_AUTH_ENTRY_PATHS } from '../../utils/authRedirect.js';

/** Same login modal as watchlist / Your Portfolio. */
export function PaperLoginGate({ children, returnTo = '/paper-trading' }) {
  const navigate = useNavigate();
  const loginGate = useLoginGateOptional();
  const loggedIn = useIsLoggedIn();
  const authReady = loginGate?.authReady ?? false;
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!authReady || loggedIn || promptedRef.current) return;
    if (GUEST_AUTH_ENTRY_PATHS.has(window.location.pathname)) return;
    promptedRef.current = true;
    loginGate?.showLoginRequired({
      returnTo,
      onDismiss: () => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/market', { replace: true });
      }
    });
  }, [authReady, loggedIn, loginGate, navigate, returnTo]);

  if (!authReady || !loggedIn) {
    return null;
  }

  return children;
}
