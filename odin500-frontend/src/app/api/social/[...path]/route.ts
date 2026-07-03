import { NextRequest, NextResponse } from 'next/server';
import { SOCIAL_ORIGIN } from '@/lib/socialOrigin';
import { serverFetchJson } from '@/lib/server-api';

async function assertAdmin() {
  try {
    const data = await serverFetchJson('/api/admin/me', { method: 'GET' });
    if (!data?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
}

function socialUrl(pathSegments: string[]) {
  if (!SOCIAL_ORIGIN) {
    throw new Error('SOCIAL_ORIGIN is not configured');
  }
  const path = pathSegments.join('/');
  return `${SOCIAL_ORIGIN.replace(/\/$/, '')}/${path}`;
}

async function proxySocial(request: NextRequest, pathSegments: string[]) {
  const denied = await assertAdmin();
  if (denied) return denied;

  if (!SOCIAL_ORIGIN) {
    return NextResponse.json(
      {
        error:
          'Social worker not configured. Set SOCIAL_ORIGIN=http://localhost:8080 and run odin500-social.'
      },
      { status: 503 }
    );
  }

  const target = socialUrl(pathSegments);
  const search = request.nextUrl.search || '';
  const url = `${target}${search}`;

  const headers = new Headers();
  headers.set('Accept', request.headers.get('accept') || 'application/json');

  const isJobTrigger =
    request.method === 'POST' && pathSegments[0] === 'jobs' && pathSegments.length >= 2;
  const isPostDelete =
    request.method === 'DELETE' && pathSegments[0] === 'posts' && pathSegments.length === 2;
  const isPostDiscard =
    request.method === 'POST' &&
    pathSegments[0] === 'posts' &&
    pathSegments.length === 3 &&
    pathSegments[2] === 'discard';
  if (isJobTrigger || isPostDelete || isPostDiscard) {
    const secret = process.env.SOCIAL_INTERNAL_SECRET || '';
    if (!secret) {
      return NextResponse.json(
        { error: 'SOCIAL_INTERNAL_SECRET is not configured on the frontend server' },
        { status: 503 }
      );
    }
    headers.set('x-social-secret', secret);
    headers.set('Content-Type', 'application/json');
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    body: ['GET', 'HEAD', 'DELETE'].includes(request.method) ? undefined : await request.text()
  };

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Social worker unreachable';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const body = await response.arrayBuffer();
  const outHeaders = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) outHeaders.set('content-type', contentType);

  return new NextResponse(body, {
    status: response.status,
    headers: outHeaders
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxySocial(request, path);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxySocial(request, path);
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxySocial(request, path);
}
