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

/** Issues from BigQuery API + live Odin500 return tables (issue pages only). */
export async function getNewsletterBySlugEnriched(slug: string): Promise<NewsletterIssue | null> {
  const [issue, snapshot] = await Promise.all([
    getNewsletterBySlug(slug),
    fetchNewsletterMarketSnapshot()
  ]);
  if (!issue) return null;
  return enrichIssue(issue, snapshot);
}
