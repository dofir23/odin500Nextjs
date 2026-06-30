import type { Metadata } from 'next';
import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { NewsletterIndexServer } from '@/ssr/pages/NewsletterIndexServer';
import { getAllNewsletters } from '@/lib/newsletter.server';
import { hasAuthSession } from '@/lib/authGuestRedirect';
import NewsletterIndex from '@/views/NewsletterIndex.jsx';

export const metadata: Metadata = toNextMetadata('/newsletter');
export const revalidate = 300;

export default async function NewsletterIndexPage() {
  const issues = await getAllNewsletters();
  const initialLoggedIn = await hasAuthSession();

  return (
    <PageServerShell
      pathname="/newsletter"
      serverContent={<NewsletterIndexServer issues={issues} initialLoggedIn={initialLoggedIn} />}
    >
      <NewsletterIndex issues={issues} initialLoggedIn={initialLoggedIn} />
    </PageServerShell>
  );
}
