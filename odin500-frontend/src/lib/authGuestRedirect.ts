import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth-cookies';

const GUEST_AUTH_ENTRY_PATHS = new Set(['/login', '/signup', '/forgot-password']);

function resolveAuthenticatedDest(next?: string | null, fallback = '/market') {
  const raw = String(next || '').trim();
  if (!raw.startsWith('/')) return fallback;
  const pathOnly = raw.split('?')[0].split('#')[0];
  if (GUEST_AUTH_ENTRY_PATHS.has(pathOnly)) return fallback;
  return raw;
}

/** True when httpOnly session cookies are present (same check as GET /api/auth/session). */
export async function hasAuthSession(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(
    jar.get(ACCESS_TOKEN_COOKIE)?.value || jar.get(REFRESH_TOKEN_COOKIE)?.value
  );
}

/** Server redirect — keep signed-in users off login/signup entry pages. */
export async function redirectIfAuthenticated(next?: string | null, fallback = '/market') {
  if (await hasAuthSession()) {
    redirect(resolveAuthenticatedDest(next, fallback));
  }
}
