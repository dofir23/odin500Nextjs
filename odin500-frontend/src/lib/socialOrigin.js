/** Resolve odin500-social worker origin (server-side proxy target). */

export function resolveSocialOrigin() {
  const fromEnv = process.env.SOCIAL_ORIGIN || process.env.NEXT_PUBLIC_SOCIAL_ORIGIN;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return 'http://localhost:8080';
  return '';
}

export const SOCIAL_ORIGIN = resolveSocialOrigin();
