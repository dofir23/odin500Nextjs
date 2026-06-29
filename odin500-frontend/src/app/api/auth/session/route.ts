import { NextResponse } from 'next/server';
import { getRefreshTokenFromCookies, getAccessTokenFromCookies } from '@/lib/server-api';
import { setSessionCookies } from '@/lib/server-api';

export async function GET() {
  const refresh = await getRefreshTokenFromCookies();
  const access = await getAccessTokenFromCookies();
  return NextResponse.json({ authenticated: Boolean(refresh || access) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const session = body?.session;
  if (!session?.access_token) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
  }
  await setSessionCookies(session);
  return NextResponse.json({ ok: true });
}
