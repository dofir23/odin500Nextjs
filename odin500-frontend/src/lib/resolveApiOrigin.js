/** @typedef {{ hostname?: string }} ResolveApiOriginOptions */

export const DEPLOYED_API_ORIGIN_DEFAULT = 'https://odin500-1-production.up.railway.app';
export const LOCAL_API_ORIGIN = 'http://localhost:5000';

function cleanOrigin(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return null;
  return v.replace(/\/$/, '');
}

function isLocalHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/** @param {ResolveApiOriginOptions} [opts] */
export function resolveApiOrigin(opts = {}) {
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
