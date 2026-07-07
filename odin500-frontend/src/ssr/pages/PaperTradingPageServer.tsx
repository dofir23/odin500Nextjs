import {
  PAPER_TRADING_FAQS,
  PAPER_TRADING_FEATURES,
  PAPER_TRADING_HERO
} from '@/content/paperTradingPageContent';

/**
 * Server-rendered paper trading hub — intro, features, and FAQs for crawlers.
 */
export function PaperTradingPageServer() {
  return (
    <article className="ssr-page-content mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-500">
          Paper trading
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-3xl">
          {PAPER_TRADING_HERO.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 md:text-base">
          {PAPER_TRADING_HERO.subtitle}
        </p>
      </header>

      <section aria-labelledby="paper-features-heading" className="mb-10">
        <h2 id="paper-features-heading" className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">
          What you can do
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {PAPER_TRADING_FEATURES.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/40"
            >
              <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="paper-faq-heading" className="mb-8">
        <h2 id="paper-faq-heading" className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">
          Frequently asked questions
        </h2>
        <dl className="space-y-4">
          {PAPER_TRADING_FAQS.map((faq) => (
            <div key={faq.q}>
              <dt className="text-sm font-semibold text-slate-800 dark:text-slate-100">{faq.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav className="text-sm" aria-label="Related tools">
        <p className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Explore next</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li>
            <a href="/odin-signals">Odin trading signals</a>
          </li>
          <li>
            <a href="/market-movers">Market movers</a>
          </li>
          <li>
            <a href="/premium">Pricing plans</a>
          </li>
          <li>
            <a href="/methodology">Data methodology</a>
          </li>
        </ul>
      </nav>
    </article>
  );
}
