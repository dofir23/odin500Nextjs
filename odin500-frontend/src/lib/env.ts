/** Centralized env reads for Next.js server (route handlers, middleware, RSC). */

export const API_ORIGIN =
  process.env.API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  'https://odin500-1-production.up.railway.app';

export const isDev = process.env.NODE_ENV === 'development';

export const isAuthDisabled = () =>
  process.env.AUTH_DISABLED === 'true' ||
  process.env.AUTH_DISABLED === '1' ||
  process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true' ||
  process.env.NEXT_PUBLIC_AUTH_DISABLED === '1';

export const finnhubToken = () =>
  process.env.FINNHUB_TOKEN || process.env.NEXT_PUBLIC_FINNHUB_TOKEN || '';

export const companyProfileDataKey = () =>
  process.env.COMPANY_PROFILE_DATA_KEY ||
  process.env.NEXT_PUBLIC_COMPANY_PROFILE_DATA_KEY ||
  '';
