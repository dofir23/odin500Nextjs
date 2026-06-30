import 'server-only';
import { marked } from 'marked';
import { API_ORIGIN } from '@/lib/env';
import type { NewsletterIssue } from './newsletter.shared';

export type ApiNewsletterSummary = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  weekLabel?: string;
  tags?: string[];
  author?: string;
  generator?: string;
};

export type ApiNewsletterRow = ApiNewsletterSummary & {
  bodyMarkdown: string;
};

function apiBase() {
  return API_ORIGIN.replace(/\/$/, '');
}

function summaryToIssue(row: ApiNewsletterSummary): NewsletterIssue {
  return {
    slug: row.slug,
    meta: {
      title: row.title,
      description: row.description,
      publishedAt: row.publishedAt,
      weekLabel: row.weekLabel,
      tags: row.tags,
      author: row.author || 'Odin500'
    },
    content: '',
    html: ''
  };
}

function rowToIssue(row: ApiNewsletterRow): NewsletterIssue {
  const content = String(row.bodyMarkdown || '').trim();
  return {
    slug: row.slug,
    meta: {
      title: row.title,
      description: row.description,
      publishedAt: row.publishedAt,
      weekLabel: row.weekLabel,
      tags: row.tags,
      author: row.author || 'Odin500'
    },
    content,
    html: marked.parse(content, { async: false }) as string
  };
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 }
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Index/archive cards — metadata only, no body fetch or markdown parse. */
export async function fetchNewsletterSummariesFromApi(): Promise<NewsletterIssue[]> {
  const payload = await fetchJson<{ success?: boolean; issues?: ApiNewsletterSummary[] }>(
    '/api/public/newsletter'
  );
  if (!payload?.success || !Array.isArray(payload.issues)) return [];
  return payload.issues.map(summaryToIssue);
}

/** Full issue with body (issue detail pages). */
export async function fetchNewsletterBySlugFromApi(slug: string): Promise<NewsletterIssue | null> {
  const enc = encodeURIComponent(slug);
  const payload = await fetchJson<{ success?: boolean; issue?: ApiNewsletterRow }>(
    `/api/public/newsletter/${enc}`
  );
  if (!payload?.success || !payload.issue) return null;
  return rowToIssue(payload.issue);
}

export async function fetchNewsletterSlugsFromApi(): Promise<string[]> {
  const payload = await fetchJson<{ success?: boolean; slugs?: string[] }>(
    '/api/public/newsletter/slugs'
  );
  if (payload?.success && Array.isArray(payload.slugs)) {
    return payload.slugs;
  }
  const issues = await fetchNewsletterSummariesFromApi();
  return issues.map((i) => i.slug);
}

/** @deprecated Prefer fetchNewsletterSummariesFromApi for list views. */
export async function fetchAllNewslettersFromApi(): Promise<NewsletterIssue[]> {
  return fetchNewsletterSummariesFromApi();
}
