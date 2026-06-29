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
