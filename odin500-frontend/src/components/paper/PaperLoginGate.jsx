'use client';

import { useEffect } from 'react';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { useLoginGateOptional } from '../../context/LoginGateContext.jsx';
import { useIsLoggedIn } from '../../hooks/useIsLoggedIn.js';

/** Same login modal as watchlist / Your Portfolio. */
export function PaperLoginGate({ children }) {
  const navigate = useNavigate();
  const loginGate = useLoginGateOptional();
  const loggedIn = useIsLoggedIn();
  const authReady = loginGate?.authReady ?? false;

  useEffect(() => {
    if (!authReady || loggedIn) return;
    loginGate?.showLoginRequired({
      onDismiss: () => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/market', { replace: true });
      }
    });
  }, [authReady, loggedIn, loginGate, navigate]);

  if (!authReady || !loggedIn) {
    return null;
  }

  return children;
}
