/** Client-safe env reads — use static process.env.NEXT_PUBLIC_* so Next.js inlines them in the browser bundle. */

import { resolveApiOrigin } from './resolveApiOrigin.js';

/** Resolved at runtime when `window` is available; otherwise uses server/build rules. */
export function getApiOrigin() {
  if (typeof window !== 'undefined') {
    return resolveApiOrigin({ hostname: window.location.hostname });
  }
  return resolveApiOrigin();
}

/** Default origin for modules that read a constant at import time (SSR / build). */
export const API_ORIGIN = resolveApiOrigin();

export const isDev = process.env.NODE_ENV === 'development';

export const isAuthDisabled = () =>
  process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true' ||
  process.env.NEXT_PUBLIC_AUTH_DISABLED === '1';

export const finnhubToken = () => process.env.NEXT_PUBLIC_FINNHUB_TOKEN || '';

export const companyProfileDataKey = () =>
  process.env.NEXT_PUBLIC_COMPANY_PROFILE_DATA_KEY || '';

export const paperPositionsPollMs = () => process.env.NEXT_PUBLIC_PAPER_POSITIONS_POLL_MS || '';

export const tickerSearchDebounceMs = () =>
  process.env.NEXT_PUBLIC_TICKER_SEARCH_DEBOUNCE_MS || '';
