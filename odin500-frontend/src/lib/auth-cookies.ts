import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export const ACCESS_TOKEN_COOKIE = 'odin_access_token';
export const REFRESH_TOKEN_COOKIE = 'odin_refresh_token';
export const EXPIRES_AT_COOKIE = 'odin_expires_at';

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

export function maxAgeFromExpiresAt(expiresAtSec: number) {
  if (!expiresAtSec) return 60 * 60 * 24 * 7;
  const delta = expiresAtSec - Math.floor(Date.now() / 1000);
  return Math.max(60, delta);
}
