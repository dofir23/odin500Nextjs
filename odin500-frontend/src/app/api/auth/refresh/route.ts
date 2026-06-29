import { NextResponse } from 'next/server';
import { refreshSessionOnServer } from '@/lib/server-api';

export async function POST() {
  const session = await refreshSessionOnServer();
  if (!session) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
  }
  return NextResponse.json({ message: 'Session refreshed', session });
}
