import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_ORIGIN } from '@/seo/siteConfig.js';
import { PageServerShell } from '@/seo/PageServerShell';
import { NewsletterArticleJsonLd } from '@/seo/NewsletterArticleJsonLd';
import { NewsletterIssueServer } from '@/ssr/pages/NewsletterIssueServer';
import { getNewsletterBySlugEnriched } from '@/lib/newsletterEnrich.server';
import { getNewsletterBySlug, getNewsletterSlugs } from '@/lib/newsletter.server';
import NewsletterIssue from '@/views/NewsletterIssue.jsx';

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getNewsletterSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const issue = await getNewsletterBySlug(slug);
  if (!issue) return { title: 'Newsletter not found' };

  const pathname = `/newsletter/${slug}`;
  const canonical = `${SITE_ORIGIN}${pathname}`;

  return {
    title: `${issue.meta.title} | Odin500 Weekly`,
    description: issue.meta.description,
    alternates: { canonical },
    openGraph: {
      title: issue.meta.title,
      description: issue.meta.description,
      url: canonical,
      type: 'article',
      publishedTime: issue.meta.publishedAt
    }
  };
}

export default async function NewsletterIssuePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const issue = await getNewsletterBySlugEnriched(slug);
  if (!issue) notFound();

  const pathname = `/newsletter/${slug}`;

  return (
    <>
      <NewsletterArticleJsonLd issue={issue} />
      <PageServerShell pathname={pathname} serverContent={<NewsletterIssueServer issue={issue} />}>
        <NewsletterIssue issue={issue} />
      </PageServerShell>
    </>
  );
}
