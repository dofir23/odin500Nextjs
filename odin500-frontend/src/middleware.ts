import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_DISABLED =
  process.env.AUTH_DISABLED === 'true' || process.env.AUTH_DISABLED === '1';

/**
 * Market and analytics pages are publicly readable (SSR + SEO).
 * Used for canonical-case redirects; the auth guard keys off PRIVATE_PREFIXES instead.
 */
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
  /** Public gallery only — private /virtual-portfolio stays auth-gated. */
  '/virtual-portfolio/public',
  '/virtual-portfolio/ai',
  '/newsletter'
];

/**
 * Auth-gated surfaces. This list is the authority — anything not named here reaches Next.js.
 *
 * The guard used to be deny-by-default (gate everything not on the public list), which meant a
 * URL that simply does not exist was treated as private: /something 307'd to /login instead of
 * rendering not-found. Crawlers saw a redirect into a robots-disallowed page for every dead URL,
 * and the custom 404 was unreachable. Listing private prefixes explicitly fixes that.
 *
 * NOTE: new authenticated routes must be added here, or they will be publicly reachable.
 */
const PRIVATE_PREFIXES = ['/profile', '/accounts', '/admin'];

/** `/virtual-portfolio` is the visitor's own book; its /ai and /public sub-trees are public. */
function isPrivatePaperTradingPath(pathname: string) {
  if (pathname === '/virtual-portfolio') return true;
  if (!pathname.startsWith('/virtual-portfolio/')) return false;
  return !(
    pathname === '/virtual-portfolio/ai' ||
    pathname === '/virtual-portfolio/public' ||
    pathname.startsWith('/virtual-portfolio/public/')
  );
}

function isPrivatePath(pathname: string) {
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return isPrivatePaperTradingPath(pathname);
}

function isPublicContentPath(pathname: string) {
  return PUBLIC_CONTENT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isGuestAuthEntryPath(pathname: string) {
  return pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';
}

function redirectAuthenticatedFromGuestPage(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next');
  const dest =
    next && next.startsWith('/') && !isGuestAuthEntryPath(next.split('?')[0])
      ? next
      : '/virtual-portfolio/ai';
  return NextResponse.redirect(new URL(dest, request.url));
}

/** Canonical host — every sitemap URL, canonical tag, and OG URL uses www. */
const CANONICAL_HOST = 'www.odin500.com';
const APEX_HOST = 'odin500.com';

/**
 * Send apex requests to www, keeping the path.
 *
 * Only takes effect once the apex A record points at this app. While the apex sits on a
 * registrar domain-forwarding service, that service answers first: it 301s `/` correctly but
 * returns a plain-text 404 for every deeper path, so `odin500.com/ticker/aapl` never reaches
 * Next.js and audit tools see a non-HTML page with no title, canonical, or H1.
 */
function apexToWwwRedirect(request: NextRequest): NextResponse | null {
  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  if (host !== APEX_HOST) return null;

  const url = request.nextUrl.clone();
  url.protocol = 'https:';
  url.host = CANONICAL_HOST;
  url.port = '';
  url.pathname = canonicalPathname(request.nextUrl.pathname);
  return NextResponse.redirect(url, 308);
}

/** Lowercase symbol/slug segments so /ticker/AAPL 308s to /ticker/aapl (matches canonical + sitemap). */
function canonicalPathname(pathname: string): string {
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
    return build(match);
  }

  /**
   * Routes without a dynamic segment (/MARKET, /Newsletter/x) match no rule above, so uppercase
   * content URLs used to fall through the case-sensitive public check and 307 to /login —
   * Googlebot saw a login redirect, not the page. Every sitemap URL is lowercase, so folding to
   * lowercase is always the canonical target.
   */
  const lowercased = pathname.toLowerCase();
  if (lowercased !== pathname && isPublicContentPath(lowercased)) return lowercased;

  return pathname;
}

/** Path-only canonicalisation, for requests already on the canonical host. */
function canonicalLowercaseRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const canonicalPath = canonicalPathname(pathname);
  if (canonicalPath === pathname) return null;

  const url = request.nextUrl.clone();
  url.pathname = canonicalPath;
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Host first, and it folds the path in the same hop so apex + uppercase never chains redirects.
  const hostRedirect = apexToWwwRedirect(request);
  if (hostRedirect) return hostRedirect;

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

  // Unknown URLs fall through to Next.js so not-found.tsx renders a real 404.
  if (!isPrivatePath(pathname)) return NextResponse.next();

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
