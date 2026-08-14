export const GUEST_AUTH_ENTRY_PATHS = new Set(['/login', '/signup', '/forgot-password']);

/** Default destination after login when no safe `?next=` is provided. */
export const DEFAULT_POST_LOGIN_PATH = '/paper-trading/ai';

/** Safe post-login destination from `?next=` (client or URLSearchParams). */
export function resolvePostLoginPath(searchParams, fallback = DEFAULT_POST_LOGIN_PATH) {
  const next =
    typeof searchParams?.get === 'function'
      ? searchParams.get('next')
      : typeof searchParams === 'string'
        ? searchParams
        : null;
  const raw = String(next || '').trim();
  if (!raw.startsWith('/')) return fallback;
  const pathOnly = raw.split('?')[0].split('#')[0];
  if (GUEST_AUTH_ENTRY_PATHS.has(pathOnly)) return fallback;
  return raw;
}

/** Build `/login?next=...` or `/signup?next=...` for auth entry navigation. */
export function buildAuthEntryUrl(entryPath, returnTo, fallback = DEFAULT_POST_LOGIN_PATH) {
  const base = entryPath === '/signup' ? '/signup' : '/login';
  const raw = String(returnTo || '').trim();
  const dest =
    raw.startsWith('/') && !GUEST_AUTH_ENTRY_PATHS.has(raw.split('?')[0].split('#')[0])
      ? raw
      : fallback;
  return `${base}?next=${encodeURIComponent(dest)}`;
}
