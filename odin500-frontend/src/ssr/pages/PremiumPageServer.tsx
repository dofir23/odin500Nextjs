import { PricingPlanCards } from '@/components/premium/PricingPlanCards';
import { PRICING_HERO, PRICING_WHY_FEATURES } from '@/content/premiumPageContent';
import { PREMIUM_FAQS, premiumFaqPlainText } from '@/content/premiumFaqs';

/**
 * Server-rendered premium/pricing summary — full plan comparison in initial HTML.
 * Interactive FAQ accordion hydrates via the client Pricing view.
 */
export function PremiumPageServer() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f7fb] pb-16 font-sans dark:bg-[#020617] dark:pb-8">
      <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#3b82f6]/10 blur-[100px] dark:bg-[#3b82f6]/25" />

      <section className="relative z-10 mx-auto max-w-[1400px] px-4 pb-16 pt-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-1 text-2xl font-bold tracking-wide text-[#4388fc] dark:text-[#60a5fa]">
            {PRICING_HERO.eyebrow}
          </p>
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-[#0f172a] dark:text-white md:text-4xl">
            {PRICING_HERO.title}
          </h1>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 md:text-base">
            {PRICING_HERO.subtitle}
          </p>
        </div>

        <PricingPlanCards />

        <section aria-labelledby="why-odin-heading" className="mx-auto mt-20 max-w-3xl">
          <h2
            id="why-odin-heading"
            className="mb-6 text-center text-xl font-bold text-slate-800 dark:text-slate-100"
          >
            Why Odin500
          </h2>
          <ul className="grid grid-cols-1 gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            {PRICING_WHY_FEATURES.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-slate-200/60 bg-white/70 px-4 py-3 dark:border-white/[0.08] dark:bg-slate-900/40"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pricing-faq-heading" className="mx-auto mt-16 max-w-3xl">
          <h2
            id="pricing-faq-heading"
            className="mb-6 text-center text-xl font-bold text-slate-800 dark:text-slate-100"
          >
            Frequently asked questions
          </h2>
          <dl className="space-y-5">
            {PREMIUM_FAQS.map((faq) => (
              <div key={faq.q}>
                <dt className="text-sm font-semibold text-slate-800 dark:text-slate-100">{faq.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {premiumFaqPlainText(faq)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </section>
    </div>
  );
}
