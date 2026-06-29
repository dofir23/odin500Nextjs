import '@/styles/newsletter-page.css';
import Link from 'next/link';
import type { NewsletterIssue } from '@/lib/newsletter.shared';
import { formatNewsletterDate } from '@/lib/newsletter.shared';

type NewsletterIssueContentProps = {
  issue: NewsletterIssue;
};

export function NewsletterIssueContent({ issue }: NewsletterIssueContentProps) {
  return (
    <article className="newsletter-page newsletter-article">
      <header className="newsletter-article__header">
        <p className="newsletter-page__eyebrow">
          <Link href="/newsletter">Odin500 Weekly</Link>
        </p>
        <h1 className="newsletter-article__title">{issue.meta.title}</h1>
        <p className="newsletter-article__meta">
          <time dateTime={issue.meta.publishedAt}>
            {issue.meta.weekLabel || formatNewsletterDate(issue.meta.publishedAt)}
          </time>
          {issue.meta.author ? <span> · {issue.meta.author}</span> : null}
        </p>
        {issue.meta.description ? (
          <p className="newsletter-article__dek">{issue.meta.description}</p>
        ) : null}
      </header>

      <div
        className="newsletter-article__body"
        dangerouslySetInnerHTML={{ __html: issue.html }}
      />

      <footer className="newsletter-article__footer">
        <p>
          Explore live data behind this recap on the{' '}
          <Link href="/market">market dashboard</Link>, <Link href="/odin-signals">Odin Signals</Link>
          , and <Link href="/ticker-report/aapl">ticker reports</Link>.
        </p>
        <Link href="/newsletter" className="newsletter-card__cta">
          ← All newsletter issues
        </Link>
      </footer>
    </article>
  );
}
