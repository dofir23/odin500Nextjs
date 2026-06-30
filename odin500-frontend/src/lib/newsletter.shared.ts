export type NewsletterFrontmatter = {
  title: string;
  description: string;
  publishedAt: string;
  weekLabel?: string;
  tags?: string[];
  author?: string;
};

export type NewsletterIssue = {
  slug: string;
  meta: NewsletterFrontmatter;
  content: string;
  html: string;
};

export function formatNewsletterDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const DESCRIPTION_FALLBACK =
  'Weekly U.S. equity market recap from Odin500 index, sector, and signal data.';

/** Clean API descriptions (fixes legacy `>-` YAML migration artifacts). */
export function displayNewsletterDescription(description?: string) {
  const d = String(description || '').trim();
  if (!d || /^>[\-|+]?$/.test(d) || d === '|-' || d === '|' || d === '...') {
    return DESCRIPTION_FALLBACK;
  }
  return d;
}
