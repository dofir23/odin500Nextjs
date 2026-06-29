import { NextResponse } from 'next/server';
import { API_ORIGIN } from '@/lib/env';
import { setSessionCookies } from '@/lib/server-api';

function backendUrl(path: string) {
  return `${API_ORIGIN.replace(/\/$/, '')}${path}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const res = await fetch(backendUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(payload, { status: res.status });
  }
  if (payload?.session) {
    await setSessionCookies(payload.session);
  }
  return NextResponse.json(payload);
}
