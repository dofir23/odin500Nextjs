import { NextResponse } from 'next/server';
import { API_ORIGIN } from '@/lib/env';
import { clearSessionCookies, getAccessTokenFromCookies } from '@/lib/server-api';

export async function POST() {
  try {
    const token = await getAccessTokenFromCookies();
    await fetch(`${API_ORIGIN.replace(/\/$/, '')}/api/auth/logout`, {
      method: 'POST',
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
  } catch {
    /* ignore backend logout errors */
  }
  await clearSessionCookies();
  return NextResponse.json({ message: 'Logged out' });
}
