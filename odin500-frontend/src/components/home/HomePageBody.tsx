import {
  HOME_DATA_COVERAGE,
  HOME_FEATURES,
  HOME_FOOTER_CTA,
  HOME_HERO,
  HOME_IMAGES,
  HOME_MISSION,
  HOME_NAV_EXPLORE,
  HOME_NAV_PRODUCT,
  HOME_PILLARS,
  HOME_PRICING_TEASER,
  HOME_SHOWCASE,
  HOME_SHOWCASE_INTRO,
  HOME_USE_CASES
} from '@/content/homePageContent';
import { HomeMarketingImage } from './HomeMarketingImage';

export function HomePageBody() {
  return (
    <>
      <main className="home-main" id="main-content">
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero__copy">
            <p className="home-hero__eyebrow">{HOME_HERO.eyebrow}</p>
            <h1 id="home-hero-title" className="home-hero__title">
              {HOME_HERO.title}
            </h1>
            <p className="home-hero__subtitle">{HOME_HERO.subtitle}</p>
            <div className="home-hero__ctas">
              <a href={HOME_HERO.primaryCta.href} className="home-btn home-btn--primary">
                {HOME_HERO.primaryCta.label}
              </a>
              <a href={HOME_HERO.secondaryCta.href} className="home-btn home-btn--ghost">
                {HOME_HERO.secondaryCta.label}
              </a>
            </div>
          </div>
          <HomeMarketingImage
            darkSrc={HOME_IMAGES.hero.dark}
            lightSrc={HOME_IMAGES.hero.light}
            alt="Odin500 market dashboard preview with charts, heatmap, and index performance"
            className="home-hero__visual"
            priority
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </section>

        <section className="home-pillars" aria-labelledby="home-pillars-title">
          <h2 id="home-pillars-title" className="home-section-title home-section-title--center">
            Built for investors, by market-data practitioners
          </h2>
          <div className="home-pillars__grid">
            {HOME_PILLARS.map((pillar) => (
              <article key={pillar.title} className="home-pillar-card">
                <h3 className="home-pillar-card__title">{pillar.title}</h3>
                <p className="home-pillar-card__body">{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-showcase" aria-labelledby="home-showcase-title">
          <h2 id="home-showcase-title" className="home-section-title home-section-title--center">
            {HOME_SHOWCASE_INTRO.title}
          </h2>
          <p className="home-section-lead home-section-lead--center">{HOME_SHOWCASE_INTRO.lead}</p>
          {HOME_SHOWCASE.map((item, index) => (
            <div
              key={item.id}
              className={
                'home-showcase__row' + (index % 2 === 1 ? ' home-showcase__row--reverse' : '')
              }
            >
              <div className="home-showcase__copy">
                <h3 className="home-showcase__heading">{item.title}</h3>
                <p className="home-section-lead home-showcase__text">{item.description}</p>
                <a href={item.href} className="home-link-arrow">
                  {item.linkLabel}
                </a>
              </div>
              <HomeMarketingImage
                darkSrc={HOME_IMAGES[item.imageKey].dark}
                lightSrc={HOME_IMAGES[item.imageKey].light}
                alt={item.imageAlt}
                className="home-showcase__media"
              />
            </div>
          ))}
        </section>

        <section className="home-use-cases" aria-labelledby="home-use-cases-title">
          <h2 id="home-use-cases-title" className="home-section-title">
            Clear insights, confident decisions
          </h2>
          <p className="home-section-lead">
            Odin500 packages institutional-grade U.S. equity datasets into workflows for traders,
            researchers, and long-term investors — with a free tier to get started.
          </p>
          <div className="home-use-cases__grid">
            {HOME_USE_CASES.map((item) => (
              <article key={item.title} className="home-use-card">
                <h3 className="home-use-card__title">{item.title}</h3>
                <p className="home-use-card__body">{item.body}</p>
                <a href={item.href} className="home-link-arrow">
                  {item.linkLabel}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="home-coverage" aria-labelledby="home-coverage-title">
          <h2 id="home-coverage-title" className="home-section-title home-section-title--center">
            Everything in one place
          </h2>
          <p className="home-section-lead home-section-lead--center">
            Odin500 is designed to be the only tool you need for a full picture of U.S. equities —
            from index snapshots to ticker-level OHLC history and systematic signals.
          </p>
          <div className="home-coverage__grid">
            {HOME_DATA_COVERAGE.map((item) => (
              <article key={item.id} className="home-coverage-card" id={`coverage-${item.id}`}>
                <h3 className="home-coverage-card__title">
                  <a href={item.href}>{item.title}</a>
                </h3>
                <p className="home-coverage-card__summary">{item.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-mission" aria-labelledby="home-mission-title">
          <h2 id="home-mission-title" className="home-mission__title">
            {HOME_MISSION.title}
          </h2>
          <p className="home-mission__body">{HOME_MISSION.body}</p>
        </section>

        <section className="home-features" aria-labelledby="home-features-title">
          <h2 id="home-features-title" className="home-section-title home-section-title--center">
            Featuring: systematic market insight
          </h2>
          <p className="home-section-lead home-section-lead--center">
            Proprietary Odin workflows combine OHLC history, return analytics, and signal screens so
            you spend less time gathering data and more time evaluating ideas.
          </p>
          <div className="home-features__grid">
            {HOME_FEATURES.map((feature) => (
              <article key={feature.title} className="home-feature-card">
                <h3 className="home-feature-card__title">
                  <a href={feature.href}>{feature.title}</a>
                </h3>
                <p className="home-feature-card__body">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-platform" aria-labelledby="home-platform-title">
          <h2 id="home-platform-title" className="home-section-title">
            Platform overview for researchers &amp; AI agents
          </h2>
          <div className="home-platform__body">
            <p>
              Odin500 (www.odin500.com) is a U.S. stock market data and analytics platform. Public
              routes include the market dashboard, sector heatmap, market movers screener, Odin
              Signals, news hub, return tables, statistic data, stock split calendar, index pages
              for S&P 500 / Dow Jones / Nasdaq-100, sector ETF pages, per-ticker OHLC charts and
              historical downloads, ticker research reports, relative performance tools, premium
              subscription plans, and a virtual portfolio simulator with optional strategy automation.
              See our <a href="/methodology">data methodology</a> for sources, signal standards, and
              editorial policy.
            </p>
            <p>
              Data is derived from daily OHLC prices and proprietary signal models. Users can sign up
              for a free account to access charts, watchlists, and basic signals; paid tiers expand
              index and ETF signal coverage. The site is server-rendered for search engines and
              machine-readable summaries on each route.
            </p>
            <ul className="home-platform__links">
              {HOME_NAV_EXPLORE.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="home-pricing" aria-labelledby="home-pricing-title">
          <h2 id="home-pricing-title" className="home-section-title">
            {HOME_PRICING_TEASER.title}
          </h2>
          <p className="home-section-lead">{HOME_PRICING_TEASER.body}</p>
          <a href={HOME_PRICING_TEASER.href} className="home-btn home-btn--primary">
            {HOME_PRICING_TEASER.cta}
          </a>
        </section>

        <section className="home-footer-cta" aria-labelledby="home-footer-cta-title">
          <h2 id="home-footer-cta-title" className="home-footer-cta__title">
            {HOME_FOOTER_CTA.title}
          </h2>
          <p className="home-footer-cta__body">{HOME_FOOTER_CTA.body}</p>
          <a href={HOME_FOOTER_CTA.href} className="home-btn home-btn--primary home-btn--lg">
            {HOME_FOOTER_CTA.cta}
          </a>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer__inner">
          <div className="home-footer__col">
            <strong className="home-footer__brand">Odin500</strong>
            <p className="home-footer__tagline">
              U.S. stock market data, OHLC history, charts, and Odin trading signals.
            </p>
          </div>
          <div className="home-footer__col">
            <h3 className="home-footer__heading">Product</h3>
            <ul>
              {HOME_NAV_PRODUCT.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className="home-footer__col">
            <h3 className="home-footer__heading">Explore</h3>
            <ul>
              {HOME_NAV_EXPLORE.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className="home-footer__col">
            <h3 className="home-footer__heading">Account</h3>
            <ul>
              <li>
                <a href="/login">Log in</a>
              </li>
              <li>
                <a href="/signup">Sign up</a>
              </li>
              <li>
                <a href="/profile">Profile</a>
              </li>
            </ul>
          </div>
        </div>
        <p className="home-footer__copy">© 2026 Odin500. All rights reserved.</p>
      </footer>
    </>
  );
}
