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
  '/methodology',
  '/premium',
  '/ticker',
  '/ticker-report',
  '/historical-data',
  '/indices',
  '/sector-data',
  '/statistic',
  '/relative-performance',
  '/accounts',
  '/newsletter',
  '/paper-trading/public'
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

/** Lowercase symbol/slug segments so /ticker/AAPL 308s to /ticker/aapl (matches canonical + sitemap). */
function canonicalLowercaseRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  const rules: Array<{ pattern: RegExp; build: (match: RegExpMatchArray) => string }> = [
    {
      pattern: /^\/ticker\/([^/]+)$/i,
      build: (m) => `/ticker/${encodeURIComponent(decodeURIComponent(m[1]).toLowerCase())}`
    },
    {
      pattern: /^\/historical-data\/([^/]+)$/i,
      build: (m) => `/historical-data/${encodeURIComponent(decodeURIComponent(m[1]).toLowerCase())}`
    },
    {
      pattern: /^\/ticker-report\/([^/]+)$/i,
      build: (m) => `/ticker-report/${encodeURIComponent(decodeURIComponent(m[1]).toLowerCase())}`
    },
    {
      pattern: /^\/statistic\/(ticker-(?:annual|quarterly|monthly|weekly|daily))\/([^/]+)$/i,
      build: (m) =>
        `/statistic/${m[1].toLowerCase()}/${encodeURIComponent(decodeURIComponent(m[2]).toLowerCase())}`
    },
    {
      pattern: /^\/relative-performance\/ticker\/([^/]+)$/i,
      build: (m) =>
        `/relative-performance/ticker/${encodeURIComponent(decodeURIComponent(m[1]).toLowerCase())}`
    },
    {
      pattern: /^\/indices\/([^/]+)$/i,
      build: (m) => `/indices/${decodeURIComponent(m[1]).toLowerCase()}`
    },
    {
      pattern: /^\/sector-data\/([^/]+)$/i,
      build: (m) => `/sector-data/${decodeURIComponent(m[1]).toLowerCase()}`
    }
  ];

  for (const { pattern, build } of rules) {
    const match = pathname.match(pattern);
    if (!match) continue;
    const canonicalPath = build(match);
    if (canonicalPath === pathname) continue;
    const url = request.nextUrl.clone();
    url.pathname = canonicalPath;
    return NextResponse.redirect(url, 308);
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const lowercaseRedirect = canonicalLowercaseRedirect(request);
  if (lowercaseRedirect) return lowercaseRedirect;

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
