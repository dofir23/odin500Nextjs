import { SEO_BRAND_NAME, SITE_ORIGIN } from '@/seo/siteConfig.js';
import { JsonLd } from '@/seo/JsonLd';
import type { NewsletterIssue } from '@/lib/newsletter.shared';

type NewsletterArticleJsonLdProps = {
  issue: NewsletterIssue;
};

/** Article schema for newsletter issues. */
export function NewsletterArticleJsonLd({ issue }: NewsletterArticleJsonLdProps) {
  const url = `${SITE_ORIGIN}/newsletter/${issue.slug}`;

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: issue.meta.title,
        description: issue.meta.description,
        datePublished: issue.meta.publishedAt,
        dateModified: issue.meta.publishedAt,
        author: {
          '@type': 'Organization',
          name: issue.meta.author || SEO_BRAND_NAME,
          url: SITE_ORIGIN
        },
        publisher: {
          '@type': 'Organization',
          name: SEO_BRAND_NAME,
          url: SITE_ORIGIN,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_ORIGIN}/og-default.png`
          }
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': url
        },
        url
      }}
    />
  );
}
