import {
  METHODOLOGY_FAQS,
  METHODOLOGY_HERO,
  METHODOLOGY_SECTIONS
} from '@/content/methodologyPageContent';

/**
 * Server-rendered methodology & trust page for SEO and AI discovery.
 */
export function MethodologyPageServer() {
  return (
    <article className="ssr-page-content mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-500">Trust</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-3xl">
          {METHODOLOGY_HERO.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 md:text-base">
          {METHODOLOGY_HERO.subtitle}
        </p>
      </header>

      {METHODOLOGY_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="mb-8">
          <h2 className="mb-2 text-lg font-bold text-slate-800 dark:text-slate-100">{section.title}</h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{section.body}</p>
        </section>
      ))}

      <section aria-labelledby="methodology-faq-heading" className="mb-8">
        <h2 id="methodology-faq-heading" className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">
          Frequently asked questions
        </h2>
        <dl className="space-y-4">
          {METHODOLOGY_FAQS.map((faq) => (
            <div key={faq.q}>
              <dt className="text-sm font-semibold text-slate-800 dark:text-slate-100">{faq.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav className="text-sm" aria-label="Related pages">
        <p className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Related</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/premium">Pricing</a>
          </li>
          <li>
            <a href="/newsletter">Weekly newsletter</a>
          </li>
          <li>
            <a href="/odin-signals">Odin signals</a>
          </li>
        </ul>
      </nav>
    </article>
  );
}
