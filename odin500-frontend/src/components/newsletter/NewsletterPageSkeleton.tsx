import type { CSSProperties } from 'react';
import '@/styles/newsletter-page.css';

function Shimmer({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span className={`newsletter-skeleton ${className}`.trim()} style={style} aria-hidden />;
}

export function NewsletterIndexSkeleton() {
  return (
    <div className="newsletter-page newsletter-skeleton-page" aria-busy="true" aria-label="Loading newsletter">
      <header className="newsletter-page__header">
        <div className="newsletter-page__header-main">
          <Shimmer className="newsletter-skeleton--title" />
          <Shimmer className="newsletter-skeleton--lead" />
          <Shimmer className="newsletter-skeleton--lead" style={{ width: '75%' }} />
        </div>
        <Shimmer className="newsletter-skeleton--subscribe" />
      </header>

      <section className="newsletter-featured">
        <Shimmer className="newsletter-skeleton--section-title" />
        <article className="newsletter-featured__card newsletter-featured__card--skeleton">
          <Shimmer className="newsletter-skeleton--meta" />
          <Shimmer className="newsletter-skeleton--featured-title" />
          <Shimmer className="newsletter-skeleton--desc" />
          <Shimmer className="newsletter-skeleton--desc" style={{ width: '88%' }} />
          <Shimmer className="newsletter-skeleton--cta" />
        </article>
      </section>

      <section className="newsletter-archive">
        <Shimmer className="newsletter-skeleton--section-title" />
        <ul className="newsletter-archive__list">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="newsletter-archive__item">
              <article className="newsletter-card newsletter-card--skeleton">
                <Shimmer className="newsletter-skeleton--meta" />
                <Shimmer className="newsletter-skeleton--card-title" />
                <Shimmer className="newsletter-skeleton--desc" />
                <Shimmer className="newsletter-skeleton--desc" style={{ width: '70%' }} />
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function NewsletterIssueSkeleton() {
  return (
    <article
      className="newsletter-page newsletter-article newsletter-skeleton-page"
      aria-busy="true"
      aria-label="Loading newsletter issue"
    >
      <header className="newsletter-article__header">
        <Shimmer className="newsletter-skeleton--eyebrow" />
        <Shimmer className="newsletter-skeleton--article-title" />
        <Shimmer className="newsletter-skeleton--meta" style={{ width: '12rem' }} />
        <Shimmer className="newsletter-skeleton--dek" />
        <Shimmer className="newsletter-skeleton--dek" style={{ width: '90%' }} />
      </header>

      <div className="newsletter-article__body newsletter-article__body--skeleton">
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer
            key={i}
            className="newsletter-skeleton--paragraph"
            style={{ width: i % 3 === 2 ? '72%' : '100%' }}
          />
        ))}
        <Shimmer className="newsletter-skeleton--subhead" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer
            key={`b-${i}`}
            className="newsletter-skeleton--paragraph"
            style={{ width: i === 3 ? '65%' : '100%' }}
          />
        ))}
      </div>

      <footer className="newsletter-article__footer">
        <Shimmer className="newsletter-skeleton--footer-line" />
        <Shimmer className="newsletter-skeleton--cta" />
      </footer>
    </article>
  );
}
