import { SITE_ORIGIN } from '@/seo/siteConfig.js';

/**
 * Canonical share URL — always https://www.odin500.com when on the Odin domain.
 * @param {string} [input]
 * @returns {string}
 */
export function normalizeSharePageUrl(input) {
  const fallback =
    typeof window !== 'undefined' && window.location?.href ? window.location.href : SITE_ORIGIN;
  const raw = String(input || fallback).trim() || fallback;
  try {
    const u = new URL(raw, SITE_ORIGIN);
    if (u.hostname === 'odin500.com' || u.hostname === 'www.odin500.com') {
      u.protocol = 'https:';
      u.hostname = 'www.odin500.com';
    }
    return u.toString();
  } catch {
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return `${SITE_ORIGIN}${path}`;
  }
}

/**
 * Post-style caption for social sharing. The page URL is always included.
 * @param {{ chartLabel?: string, pageUrl?: string }} opts
 * @returns {string}
 */
export function buildChartShareCaption({ chartLabel, pageUrl }) {
  const url = normalizeSharePageUrl(pageUrl);
  const title = String(chartLabel || 'Market chart').trim();
  return [
    title,
    '',
    'Chart snapshot from Odin500 — U.S. equity research, signals, and interactive dashboards.',
    '',
    `Explore the full interactive view: ${url}`,
    '',
    '#stocks #trading #marketdata #odin500'
  ].join('\n');
}

/**
 * @param {string} dataUrl
 * @param {string} filename
 * @returns {Promise<File>}
 */
export async function dataUrlToPngFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/png' });
}

/**
 * @param {string} text
 */
export async function copyTextToClipboard(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard is not available in this browser.');
  }
  await navigator.clipboard.writeText(text);
}

/**
 * @param {string} url
 */
export function openShareWindow(url) {
  window.open(url, '_blank', 'noopener,noreferrer,width=640,height=560');
}

/**
 * @param {string} caption
 */
export function buildTwitterShareUrl(caption) {
  const u = new URL('https://twitter.com/intent/tweet');
  u.searchParams.set('text', caption);
  return u.toString();
}

/**
 * @param {string} pageUrl
 */
export function buildFacebookShareUrl(pageUrl) {
  const u = new URL('https://www.facebook.com/sharer/sharer.php');
  u.searchParams.set('u', normalizeSharePageUrl(pageUrl));
  return u.toString();
}

/**
 * @param {string} pageUrl
 */
export function buildLinkedInShareUrl(pageUrl) {
  const u = new URL('https://www.linkedin.com/sharing/share-offsite/');
  u.searchParams.set('url', normalizeSharePageUrl(pageUrl));
  return u.toString();
}

/**
 * @param {string} previewUrl
 * @param {string} filename
 */
export function triggerChartImageDownload(previewUrl, filename) {
  const link = document.createElement('a');
  link.href = previewUrl;
  link.download = filename || 'odin500-chart.png';
  link.click();
}

/** @typedef {'instagram' | 'x' | 'facebook' | 'linkedin'} ChartSharePlatform */

/**
 * Copy caption, download chart image, and open the platform share flow where supported.
 * @param {ChartSharePlatform} platform
 * @param {{ caption: string, pageUrl?: string, previewUrl: string, filename: string }} opts
 * @returns {Promise<string>} User-facing hint after the action
 */
export async function shareChartToPlatform(platform, { caption, pageUrl, previewUrl, filename }) {
  const url = normalizeSharePageUrl(pageUrl);

  try {
    await copyTextToClipboard(caption);
  } catch {
    /* caption copy is best-effort; share window may still open */
  }

  triggerChartImageDownload(previewUrl, filename);

  switch (platform) {
    case 'x':
      openShareWindow(buildTwitterShareUrl(caption));
      return 'Caption copied and chart downloaded. Paste the image into your post on X if needed.';
    case 'facebook':
      openShareWindow(buildFacebookShareUrl(url));
      return 'Caption copied and chart downloaded. On Facebook, upload the image and paste the caption.';
    case 'linkedin':
      openShareWindow(buildLinkedInShareUrl(url));
      return 'Caption copied and chart downloaded. On LinkedIn, upload the image and paste the caption.';
    case 'instagram':
      return 'Caption copied and chart downloaded. Open Instagram, create a post, and upload the image.';
    default:
      return 'Caption copied and chart downloaded.';
  }
}
