import { redirect } from 'next/navigation';
import { hasValidAuthSession } from '@/lib/server-api';

const GUEST_AUTH_ENTRY_PATHS = new Set(['/login', '/signup', '/forgot-password']);

function resolveAuthenticatedDest(next?: string | null, fallback = '/paper-trading/ai') {
  const raw = String(next || '').trim();
  if (!raw.startsWith('/')) return fallback;
  const pathOnly = raw.split('?')[0].split('#')[0];
  if (GUEST_AUTH_ENTRY_PATHS.has(pathOnly)) return fallback;
  return raw;
}

/** True when a usable auth session exists (access token or successful refresh). */
export async function hasAuthSession(): Promise<boolean> {
  return hasValidAuthSession();
}

/** Server redirect — keep signed-in users off login/signup entry pages. */
export async function redirectIfAuthenticated(next?: string | null, fallback = '/paper-trading/ai') {
  if (await hasAuthSession()) {
    redirect(resolveAuthenticatedDest(next, fallback));
  }
}
