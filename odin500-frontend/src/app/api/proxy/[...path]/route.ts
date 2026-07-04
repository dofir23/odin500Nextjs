import { NextRequest, NextResponse } from 'next/server';
import { API_ORIGIN } from '@/lib/env';
import {
  getAccessTokenFromCookies,
  refreshSessionOnServer
} from '@/lib/server-api';

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
  try {
    return await doProxyRequest(request, pathSegments);
  } catch (err) {
    console.error(
      `[proxy] ${request.method} /api/${pathSegments.join('/')} failed:`,
      err
    );
    const message = err instanceof Error ? err.message : 'Proxy request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function doProxyRequest(request: NextRequest, pathSegments: string[]) {
  const apiPath = '/api/' + pathSegments.join('/');
  const search = request.nextUrl.search || '';
  const target = `${API_ORIGIN.replace(/\/$/, '')}${apiPath}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') return;
    headers.set(key, value);
  });

  let token = await getAccessTokenFromCookies();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text()
  };

  let response = await fetch(target, init);

  if (response.status === 401 && request.method !== 'OPTIONS') {
    const refreshed = await refreshSessionOnServer();
    if (refreshed?.access_token) {
      headers.set('Authorization', `Bearer ${refreshed.access_token}`);
      response = await fetch(target, { ...init, headers });
    }
  }

  const outHeaders = new Headers();
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'content-encoding' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === 'connection'
    ) {
      return;
    }
    outHeaders.set(key, value);
  });

  // 204/205/304 are "null body" statuses: the Response constructor throws a
  // TypeError if given any body (even an empty ArrayBuffer). Read the body as
  // text and drop it entirely when it's empty or the status forbids a body.
  const bodyText = await response.text();

  if (response.status >= 400) {
    console.error(
      `[proxy] upstream ${request.method} ${target} -> ${response.status} :: ${bodyText.slice(0, 2000)}`
    );
  }

  const nullBodyStatus =
    response.status === 204 || response.status === 205 || response.status === 304;
  const outBody =
    nullBodyStatus || request.method === 'HEAD' || bodyText.length === 0 ? null : bodyText;

  if (outBody !== null) {
    outHeaders.set('content-type', response.headers.get('content-type') || 'application/json');
  }

  return new NextResponse(outBody, {
    status: response.status,
    headers: outHeaders
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(request, path);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyRequest(request, path);
}
