import { NextResponse } from 'next/server';
import { API_ORIGIN } from '@/lib/env';
import { clearSessionCookies } from '@/lib/server-api';

export async function POST() {
  try {
    await fetch(`${API_ORIGIN.replace(/\/$/, '')}/api/auth/logout`, {
      method: 'POST',
      cache: 'no-store'
    });
  } catch {
    /* ignore backend logout errors */
  }
  await clearSessionCookies();
  return NextResponse.json({ message: 'Logged out' });
}
