import { NewsletterIndexContent } from '@/components/newsletter/NewsletterIndexContent';
import type { NewsletterIssue } from '@/lib/newsletter.shared';

type NewsletterIndexServerProps = {
  issues: NewsletterIssue[];
  initialLoggedIn?: boolean;
};

/** Server-rendered newsletter index for crawlers and no-JS visitors. */
export function NewsletterIndexServer({ issues, initialLoggedIn = false }: NewsletterIndexServerProps) {
  return <NewsletterIndexContent issues={issues} initialLoggedIn={initialLoggedIn} />;
}
