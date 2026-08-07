import { SITE_ORIGIN } from './siteConfig.js';

/** Default share image (absolute URL). 1200×630 PNG — run `npm run gen:og-image` to regenerate. */
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-default.png`;

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export function defaultOgImages() {
  return [
    {
      url: DEFAULT_OG_IMAGE,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      alt: 'Odin500 — U.S. equity OHLC data, returns, and trading signals'
    }
  ];
}

/**
 * Route segments that ship their own `opengraph-image.tsx`, which renders a per-symbol card.
 *
 * Next's file convention only applies when metadata does NOT set `openGraph.images` — an
 * explicit value wins. Setting the shared default on these routes therefore silently shadowed
 * the generators, so every symbol page shared one generic share image. Keep this list in sync
 * with the `opengraph-image.tsx` files under src/app.
 */
const ROUTES_WITH_OG_IMAGE = [
  '/ticker/',
  '/ticker-report/',
  '/indices/',
  '/sector-data/',
  '/historical-data/',
  '/relative-performance/ticker/',
  '/statistic/'
];

/** True when the route generates its own OG image and metadata should leave `images` unset. */
export function hasGeneratedOgImage(pathname: string | undefined) {
  if (!pathname) return false;
  const path = String(pathname).split('?')[0];
  // Only the parameterised child pages have generators, not the bare segment index.
  return ROUTES_WITH_OG_IMAGE.some((prefix) => path.startsWith(prefix) && path.length > prefix.length);
}
