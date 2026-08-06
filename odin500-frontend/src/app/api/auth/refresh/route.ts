import { NextResponse } from 'next/server';
import { clearSessionCookies, refreshSessionOnServer } from '@/lib/server-api';

export async function POST() {
  const session = await refreshSessionOnServer();
  if (!session) {
    // Dead refresh cookie — clear so clients stop treating the user as signed in.
    await clearSessionCookies();
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
  }
  return NextResponse.json({ message: 'Session refreshed', session });
}
