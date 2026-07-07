import { cookies } from 'next/headers';
import { API_ORIGIN } from '@/lib/env';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  EXPIRES_AT_COOKIE,
  REMEMBER_ME_COOKIE,
  cookieOptions,
  accessCookieMaxAge,
  refreshCookieMaxAge,
  sessionFromBody,
  type SessionPayload
} from '@/lib/auth-cookies';

export type SessionCookieOptions = {
  remember?: boolean;
};

function backendUrl(path: string) {
  const base = API_ORIGIN.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export async function setSessionCookies(
  session: SessionPayload,
  options: SessionCookieOptions = {}
) {
  const parsed = sessionFromBody(session);
  if (!parsed) return false;
  const jar = await cookies();

  let remember = options.remember;
  if (remember == null) {
    remember = jar.get(REMEMBER_ME_COOKIE)?.value === '1';
  }

  const accessMaxAge = accessCookieMaxAge(parsed.expiresAt);
  const refreshMaxAge = refreshCookieMaxAge(remember);

  jar.set(ACCESS_TOKEN_COOKIE, parsed.accessToken, cookieOptions(accessMaxAge));
  jar.set(REFRESH_TOKEN_COOKIE, parsed.refreshToken, cookieOptions(refreshMaxAge));
  if (parsed.expiresAt) {
    jar.set(EXPIRES_AT_COOKIE, String(parsed.expiresAt), cookieOptions(refreshMaxAge));
  }
  if (remember) {
    jar.set(REMEMBER_ME_COOKIE, '1', cookieOptions(refreshMaxAge));
  } else if (options.remember === false) {
    jar.delete(REMEMBER_ME_COOKIE);
  }
  return true;
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(REFRESH_TOKEN_COOKIE);
  jar.delete(EXPIRES_AT_COOKIE);
  jar.delete(REMEMBER_ME_COOKIE);
}

export async function getAccessTokenFromCookies() {
  const jar = await cookies();
  return jar.get(ACCESS_TOKEN_COOKIE)?.value || '';
}

export async function getRefreshTokenFromCookies() {
  const jar = await cookies();
  return jar.get(REFRESH_TOKEN_COOKIE)?.value || '';
}

export async function refreshSessionOnServer() {
  const refreshToken = await getRefreshTokenFromCookies();
  if (!refreshToken) return null;

  const res = await fetch(backendUrl('/api/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: 'no-store'
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.session) return null;
  await setSessionCookies(payload.session);
  return payload.session;
}

export async function serverFetch(path: string, init: RequestInit = {}, auth = true) {
  const url = backendUrl(path);
  const headers = new Headers(init.headers || {});
  if (auth) {
    let token = await getAccessTokenFromCookies();
    if (!token) {
      const refreshed = await refreshSessionOnServer();
      token = refreshed?.access_token || '';
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  let response = await fetch(url, { ...init, headers, cache: 'no-store' });
  if (response.status === 401 && auth) {
    const refreshed = await refreshSessionOnServer();
    if (refreshed?.access_token) {
      headers.set('Authorization', `Bearer ${refreshed.access_token}`);
      response = await fetch(url, { ...init, headers, cache: 'no-store' });
    }
  }
  return response;
}

export async function serverFetchJson(path: string, init?: RequestInit, auth = true) {
  const res = await serverFetch(path, init, auth);
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(
      (data && (String(data.error || '') || String(data.message || ''))) ||
        `Request failed (${res.status}): ${path}`
    );
  }
  return data;
}
