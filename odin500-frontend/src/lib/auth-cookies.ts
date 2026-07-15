import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export const ACCESS_TOKEN_COOKIE = 'odin_access_token';
export const REFRESH_TOKEN_COOKIE = 'odin_refresh_token';
export const EXPIRES_AT_COOKIE = 'odin_expires_at';
export const REMEMBER_ME_COOKIE = 'odin_remember_me';

/** Minimum session cookie lifetime — stay signed in at least 3 days unless user logs out. */
export const SESSION_REFRESH_MAX_AGE_MIN_SEC = 60 * 60 * 24 * 3;
/** Default refresh cookie lifetime when user does not check Remember me. */
export const SESSION_REFRESH_MAX_AGE_DEFAULT_SEC = 60 * 60 * 24 * 30;
/** Extended refresh cookie lifetime when Remember me is checked. */
export const SESSION_REFRESH_MAX_AGE_REMEMBER_SEC = 60 * 60 * 24 * 90;
export const SESSION_ACCESS_FALLBACK_MAX_AGE_SEC = 60 * 60;

export function cookieOptions(maxAge?: number): Partial<ResponseCookie> {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    ...(maxAge != null ? { maxAge } : {})
  };
}

export type SessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
};

export function sessionFromBody(session: SessionPayload | null | undefined) {
  if (!session?.access_token || !session?.refresh_token) return null;
  const expiresAt =
    session.expires_at != null
      ? Number(session.expires_at)
      : session.expires_in != null
        ? Math.floor(Date.now() / 1000) + Number(session.expires_in)
        : 0;
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt
  };
}

/** Short-lived access token cookie — matches Supabase JWT expiry. */
export function accessCookieMaxAge(expiresAtSec: number) {
  if (!expiresAtSec) return SESSION_ACCESS_FALLBACK_MAX_AGE_SEC;
  const delta = expiresAtSec - Math.floor(Date.now() / 1000);
  return Math.max(60, delta);
}

/** Long-lived refresh cookie — independent of access token expiry. Always >= 3 days. */
export function refreshCookieMaxAge(remember = false) {
  const target = remember
    ? SESSION_REFRESH_MAX_AGE_REMEMBER_SEC
    : SESSION_REFRESH_MAX_AGE_DEFAULT_SEC;
  return Math.max(SESSION_REFRESH_MAX_AGE_MIN_SEC, target);
}

/** @deprecated Use accessCookieMaxAge — kept for any stale imports. */
export function maxAgeFromExpiresAt(expiresAtSec: number) {
  return accessCookieMaxAge(expiresAtSec);
}
