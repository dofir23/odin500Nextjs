'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useNavigate } from '@/navigation/appRouterCompat.jsx';
import { getAuthToken } from '../store/apiStore.js';
import { useLoginGateOptional } from './LoginGateContext.jsx';
import { EngagementSignupModal } from '../components/engagement/EngagementSignupModal.jsx';
import { useActiveSessionTime } from '../engagement/useActiveSessionTime.js';
import { ENGAGEMENT_ACTIVE_MS_THRESHOLD, markEngagementFirstVisit } from '../engagement/engagementStorage.js';

const AUTH_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/auth',
  '/forgot-password',
  '/signup-verify',
  '/signup-enter-code',
  '/signup-username'
];

const EXCLUDED_PATHS = new Set(['/paper-trading']);

function isAuthRoute(pathname) {
  const p = String(pathname || '');
  return AUTH_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

function hasBlockingOverlay() {
  return Boolean(
    document.querySelector('.wl-manage-overlay:not(.engagement-signup-overlay), .product-tour-active')
  );
}

export function EngagementProvider({ children }) {
  const pathname = usePathname() || '/';
  const navigate = useNavigate();
  const loginGate = useLoginGateOptional();
  const loggedIn = Boolean(getAuthToken());
  const loginModalOpen = Boolean(loginGate?.loginModalOpen);

  const [open, setOpen] = useState(false);
  const [gateEarned, setGateEarned] = useState(false);

  const engagementEnabled = !loggedIn && !isAuthRoute(pathname) && !EXCLUDED_PATHS.has(pathname);
  const { activeMs } = useActiveSessionTime({ enabled: !loggedIn && !open });

  useEffect(() => {
    markEngagementFirstVisit();
  }, []);

  useEffect(() => {
    if (loggedIn || gateEarned) return;
    if (activeMs >= ENGAGEMENT_ACTIVE_MS_THRESHOLD) {
      setGateEarned(true);
    }
  }, [activeMs, gateEarned, loggedIn]);

  useEffect(() => {
    if (loggedIn) {
      setOpen(false);
      setGateEarned(false);
      return undefined;
    }

    const evaluate = () => {
      if (!gateEarned) {
        setOpen(false);
        return;
      }
      if (!engagementEnabled) {
        setOpen(false);
        return;
      }
      if (loginModalOpen) return;
      if (hasBlockingOverlay()) return;
      setOpen(true);
    };

    evaluate();
    const id = window.setInterval(evaluate, 500);
    return () => window.clearInterval(id);
  }, [loggedIn, gateEarned, engagementEnabled, loginModalOpen, pathname]);

  useEffect(() => {
    if (!open) {
      document.body.classList.remove('engagement-signup-lock');
      return undefined;
    }
    document.body.classList.add('engagement-signup-lock');
    return () => document.body.classList.remove('engagement-signup-lock');
  }, [open]);

  const onSignup = useCallback(() => {
    navigate('/signup');
  }, [navigate]);

  const onLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <>
      {children}
      <EngagementSignupModal open={open} onSignup={onSignup} onLogin={onLogin} />
    </>
  );
}
