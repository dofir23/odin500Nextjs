const TWEET_CHAR_LIMIT = 280;
export const DISCLAIMER =
  'For informational and educational purposes only. Not investment advice.';

const URL_RE = /https?:\/\/[^\s]+/gi;
const ARROW_LINK_RE = /→\s*https?:\/\/\S+/gi;

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Remove duplicate disclaimer lines without moving sections around. */
export function dedupeDisclaimer(text) {
  const body = String(text || '').trim();
  if (!body.includes(DISCLAIMER)) return body;
  const re = new RegExp(escapeRegExp(DISCLAIMER), 'g');
  let seen = false;
  return body
    .replace(re, () => {
      if (seen) return '';
      seen = true;
      return DISCLAIMER;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractHashtagLine(text) {
  const lines = String(text || '').trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('#')) return line;
  }
  return '';
}

function extractLinkFromText(text, fallbackLink) {
  const arrow = String(text || '').match(ARROW_LINK_RE);
  if (arrow) return arrow[0].replace(/^→\s*/, '').trim();
  const url = String(text || '').match(URL_RE);
  if (url) return url[0].trim();
  return String(fallbackLink || '').trim();
}

/**
 * Rebuild twitter caption in draft order:
 * body → disclaimer → → link → hashtags
 */
export function normalizeTwitterCaption(text, { link = '', tags = '' } = {}) {
  const raw = dedupeDisclaimer(text);
  const hashtagLine = tags || extractHashtagLine(raw);
  const url = extractLinkFromText(raw, link);

  let body = raw;
  body = body.replace(DISCLAIMER, '');
  body = body.replace(ARROW_LINK_RE, '');
  body = body.replace(URL_RE, '');
  if (hashtagLine) {
    body = body.replace(hashtagLine, '');
  }
  body = body.replace(/\n{3,}/g, '\n\n').trim();

  const parts = [body, DISCLAIMER];
  if (url) parts.push(`→ ${url}`);
  if (hashtagLine) parts.push(hashtagLine);
  return parts.filter(Boolean).join('\n\n').trim();
}

/** X compose: same as draft but without the link line (avoids odin500.com preview card). */
export function buildXComposeText(text, { link = '', tags = '' } = {}) {
  const full = normalizeTwitterCaption(text, { link, tags });
  return full
    .replace(ARROW_LINK_RE, '')
    .replace(URL_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** X intent — text only; images must be uploaded in the compose UI. */
export function buildXShareUrl(composeText) {
  let full = String(composeText || '').trim();
  if (full.length > TWEET_CHAR_LIMIT) {
    full = `${full.slice(0, TWEET_CHAR_LIMIT - 1).trim()}…`;
  }
  return `https://x.com/intent/post?text=${encodeURIComponent(full)}`;
}

/** LinkedIn — keep full draft text, only dedupe disclaimer. */
export function buildLinkedInShareUrl(text) {
  const full = dedupeDisclaimer(text);
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(full)}`;
}

async function fetchImageBlob(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error('Image fetch failed');
  return res.blob();
}

export async function copyImageToClipboard(imageUrl) {
  if (!imageUrl || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return false;
  }
  try {
    const blob = await fetchImageBlob(imageUrl);
    const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

export async function downloadImage(imageUrl, filename) {
  if (!imageUrl) return false;
  try {
    const blob = await fetchImageBlob(imageUrl);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename || 'odin500-social.png';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prepare X post: snapshot downloaded, caption normalized, modal text = X prefilled text.
 */
export async function openXShare({ text, link, tags, imageUrl, filename }) {
  const fullCaption = normalizeTwitterCaption(text, { link, tags });
  const composeText = buildXComposeText(text, { link, tags });

  const imageDownloaded = await downloadImage(imageUrl, filename);
  const imageCopied = imageDownloaded ? await copyImageToClipboard(imageUrl) : false;

  let textCopied = false;
  try {
    await navigator.clipboard.writeText(fullCaption);
    textCopied = true;
  } catch {
    /* clipboard may be blocked */
  }

  window.open(buildXShareUrl(composeText), '_blank', 'noopener,noreferrer,width=640,height=720');

  return { fullCaption, composeText, imageDownloaded, imageCopied, textCopied };
}

/** Instagram — copy caption, download image, open Instagram. */
export async function openInstagramShare({ caption, imageUrl, filename }) {
  const text = dedupeDisclaimer(caption);
  if (text) {
    await navigator.clipboard.writeText(text);
  }
  if (imageUrl) {
    await downloadImage(imageUrl, filename);
  }
  window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  return Boolean(text);
}
