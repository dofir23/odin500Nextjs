import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_DISABLED =
  process.env.AUTH_DISABLED === 'true' || process.env.AUTH_DISABLED === '1';

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/auth/callback',
  '/api/',
  '/_next/',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml'
];

/** Market and analytics pages are publicly readable (SSR + SEO). Account flows stay gated. */
const PUBLIC_CONTENT_PREFIXES = [
  '/market',
  '/heatmap',
  '/market-movers',
  '/odin-signals',
  '/news',
  '/statistic-data',
  '/return-table',
  '/stock-splits',
  '/about',
  '/premium',
  '/ticker',
  '/ticker-report',
  '/historical-data',
  '/indices',
  '/sector-data',
  '/statistic',
  '/relative-performance',
  '/accounts',
  '/paper-trading',
  '/newsletter'
];

function isPublicPath(pathname: string) {
  if (pathname === '/') return true;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
  return PUBLIC_CONTENT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isGuestAuthEntryPath(pathname: string) {
  return pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';
}

function redirectAuthenticatedFromGuestPage(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next');
  const dest =
    next && next.startsWith('/') && !isGuestAuthEntryPath(next.split('?')[0]) ? next : '/market';
  return NextResponse.redirect(new URL(dest, request.url));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isGuestAuthEntryPath(pathname)) {
    const refresh = request.cookies.get('odin_refresh_token')?.value;
    const access = request.cookies.get('odin_access_token')?.value;
    if (refresh || access) {
      return redirectAuthenticatedFromGuestPage(request);
    }
    return NextResponse.next();
  }

  if (AUTH_DISABLED) return NextResponse.next();

  if (isPublicPath(pathname)) return NextResponse.next();

  const refresh = request.cookies.get('odin_refresh_token')?.value;
  const access = request.cookies.get('odin_access_token')?.value;

  if (refresh || access) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt)$).*)'
  ]
};
