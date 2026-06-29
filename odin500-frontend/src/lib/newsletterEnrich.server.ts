import 'server-only';
import { marked } from 'marked';
import {
  buildNewsletterDataMarkdown,
  fetchNewsletterMarketSnapshot
} from './newsletterData.server';
import { getAllNewsletters, getNewsletterBySlug } from './newsletter.server';
import type { NewsletterIssue } from './newsletter.shared';

async function enrichIssue(issue: NewsletterIssue, snapshot: Awaited<ReturnType<typeof fetchNewsletterMarketSnapshot>>) {
  if (!snapshot) return issue;

  const dataMd = buildNewsletterDataMarkdown(
    snapshot,
    issue.meta.weekLabel || issue.meta.publishedAt
  );
  const fullMarkdown = `${issue.content.trim()}\n\n${dataMd}`;

  return {
    ...issue,
    content: fullMarkdown,
    html: marked.parse(fullMarkdown, { async: false }) as string
  };
}

/** Markdown issues from repo + live Odin500 return tables. */
export async function getAllNewslettersEnriched(): Promise<NewsletterIssue[]> {
  const issues = getAllNewsletters();
  const snapshot = await fetchNewsletterMarketSnapshot();
  return Promise.all(issues.map((issue) => enrichIssue(issue, snapshot)));
}

export async function getNewsletterBySlugEnriched(slug: string): Promise<NewsletterIssue | null> {
  const issue = getNewsletterBySlug(slug);
  if (!issue) return null;
  const snapshot = await fetchNewsletterMarketSnapshot();
  return enrichIssue(issue, snapshot);
}
