'use client';

/**
 * @deprecated SEO is server-rendered via Next.js `generateMetadata` and `PageServerShell`.
 * This hook is intentionally a no-op so client views cannot override `<head>` tags after hydration.
 */
export function useSitewideSeo() {}

/**
 * @deprecated Use `generateMetadata` / `toNextMetadata` on the route instead.
 */
export function usePageSeo(_options) {}

/** @deprecated */
export function absoluteSiteUrl(path) {
  const p = path && path.startsWith('/') ? path : `/${String(path || '')}`;
  const origin = 'https://www.odin500.com';
  if (p === '/') return `${origin}/`;
  return `${origin}${p}`;
}

/** @deprecated */
export function canonicalPathFromLocation(pathname) {
  const path = String(pathname || '/').split('?')[0].split('#')[0] || '/';
  return path.endsWith('/') && path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}
