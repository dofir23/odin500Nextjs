/** Production backend when not running on localhost. */
export const DEPLOYED_API_ORIGIN_DEFAULT = 'https://odin500-1-production.up.railway.app';

/** Local odin500-backend (see PORT in backend .env). */
export const LOCAL_API_ORIGIN = 'http://localhost:5000';

function cleanOrigin(value: string | undefined): string | null {
  const v = String(value || '').trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return null;
  return v.replace(/\/$/, '');
}

function isLocalHostname(hostname: string | undefined): boolean {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

type ResolveApiOriginOptions = {
  /** Browser hostname (client-only). */
  hostname?: string;
};

/**
 * Backend API base URL.
 * - Local dev (`NODE_ENV=development`) → http://localhost:5000
 * - Browser on localhost / 127.0.0.1 → http://localhost:5000
 * - Deployed → API_ORIGIN / NEXT_PUBLIC_API_ORIGIN or Railway default
 *
 * `SSR_API_ORIGIN` overrides everything (server-only escape hatch).
 */
export function resolveApiOrigin(opts: ResolveApiOriginOptions = {}): string {
  const ssrOverride = cleanOrigin(process.env.SSR_API_ORIGIN);
  if (ssrOverride) return ssrOverride;

  if (isLocalHostname(opts.hostname)) {
    return LOCAL_API_ORIGIN;
  }

  if (process.env.NODE_ENV === 'development') {
    return LOCAL_API_ORIGIN;
  }

  const fromEnv =
    cleanOrigin(process.env.API_ORIGIN) || cleanOrigin(process.env.NEXT_PUBLIC_API_ORIGIN);
  if (fromEnv) return fromEnv;

  return DEPLOYED_API_ORIGIN_DEFAULT;
}
