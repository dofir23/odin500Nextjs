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
