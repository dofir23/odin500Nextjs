import { serverFetchJson } from '@/lib/server-api';

/** Fetch market JSON; tries cookie auth first, then anonymous public read. */
export async function fetchMarketJson(
  path: string,
  init?: RequestInit
): Promise<Record<string, unknown> | null> {
  try {
    return (await serverFetchJson(path, init, true)) as Record<string, unknown>;
  } catch {
    try {
      return (await serverFetchJson(path, init, false)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export async function postMarketJson(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  return fetchMarketJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function getMarketJson(path: string): Promise<Record<string, unknown> | null> {
  return fetchMarketJson(path, { method: 'GET' });
}
