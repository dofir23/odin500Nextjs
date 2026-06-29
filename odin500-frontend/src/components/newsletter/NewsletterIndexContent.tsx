import '@/styles/newsletter-page.css';
import Link from 'next/link';
import type { NewsletterIssue } from '@/lib/newsletter.shared';
import { formatNewsletterDate } from '@/lib/newsletter.shared';
import { NewsletterSubscribeSection } from './NewsletterSubscribeSection';

type NewsletterIndexContentProps = {
  issues: NewsletterIssue[];
  initialLoggedIn?: boolean;
};

export function NewsletterIndexContent({ issues, initialLoggedIn = false }: NewsletterIndexContentProps) {
  const latest = issues[0];
  const archive = issues.length > 1 ? issues.slice(1) : [];

  return (
    <div className="newsletter-page">
      <header className="newsletter-page__hero">
        <p className="newsletter-page__eyebrow">Odin500 Weekly</p>
        <h1 className="newsletter-page__title">Market newsletter</h1>
        <p className="newsletter-page__lead">
          Weekly U.S. equity recaps powered by Odin500 market data, index analytics, Odin Signals,
          and monthly ticker reports — published for investors, researchers, and search engines.
        </p>
      </header>

      {latest ? (
        <section className="newsletter-featured" aria-labelledby="newsletter-featured-title">
          <h2 id="newsletter-featured-title" className="newsletter-section-title">
            Latest Update
          </h2>
          <article className="newsletter-featured__card">
            <p className="newsletter-card__meta">
              {latest.meta.weekLabel || formatNewsletterDate(latest.meta.publishedAt)}
            </p>
            <h3 className="newsletter-featured__heading">
              <Link href={`/newsletter/${latest.slug}`}>{latest.meta.title}</Link>
            </h3>
            <p className="newsletter-card__description">{latest.meta.description}</p>
            <Link href={`/newsletter/${latest.slug}`} className="newsletter-card__cta">
              Read issue →
            </Link>
          </article>
        </section>
      ) : null}

      <section className="newsletter-archive" aria-labelledby="newsletter-archive-title">
        <h2 id="newsletter-archive-title" className="newsletter-section-title">
          Archive
        </h2>
        {archive.length === 0 ? (
          <p className="newsletter-empty">No previous issues yet.</p>
        ) : (
          <ul className="newsletter-archive__list">
            {archive.map((issue) => (
              <li key={issue.slug} className="newsletter-archive__item">
                <article className="newsletter-card">
                  <p className="newsletter-card__meta">
                    {issue.meta.weekLabel || formatNewsletterDate(issue.meta.publishedAt)}
                  </p>
                  <h3 className="newsletter-card__title">
                    <Link href={`/newsletter/${issue.slug}`}>{issue.meta.title}</Link>
                  </h3>
                  <p className="newsletter-card__description">{issue.meta.description}</p>
                  {issue.meta.tags?.length ? (
                    <ul className="newsletter-card__tags" aria-label="Tags">
                      {issue.meta.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NewsletterSubscribeSection initialLoggedIn={initialLoggedIn} />
    </div>
  );
}
