import { NextRequest, NextResponse } from 'next/server';
import { API_ORIGIN } from '@/lib/env';
import {
  getAccessTokenFromCookies,
  refreshSessionOnServer
} from '@/lib/server-api';

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
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

  const body = await response.arrayBuffer();
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
  outHeaders.set('content-type', response.headers.get('content-type') || 'application/json');

  return new NextResponse(body, {
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
