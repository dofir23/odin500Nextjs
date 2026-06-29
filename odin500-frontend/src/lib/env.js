/** Client-safe env reads — use static process.env.NEXT_PUBLIC_* so Next.js inlines them in the browser bundle. */

export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN || 'https://odin500-1-production.up.railway.app';

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
