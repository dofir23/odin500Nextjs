import { NewsletterIssueContent } from '@/components/newsletter/NewsletterIssueContent';
import type { NewsletterIssue } from '@/lib/newsletter.shared';

type NewsletterIssueServerProps = {
  issue: NewsletterIssue;
};

/** Server-rendered newsletter article for crawlers and no-JS visitors. */
export function NewsletterIssueServer({ issue }: NewsletterIssueServerProps) {
  return <NewsletterIssueContent issue={issue} />;
}
