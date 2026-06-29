import { PRICING_PLANS, type PricingPlan } from '@/content/premiumPageContent';

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 5 8.7 9.5 3.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 3l6 6M9 3 3 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const isPro = plan.highlighted;

  return (
    <article
      className={
        'pricing-card relative flex flex-col rounded-[28px] px-7 pb-8 pt-8 transition-all duration-300 ' +
        (isPro
          ? 'pricing-card--pro border-2 border-[#4388fc] bg-[#ebf1f9] shadow-[0_0_40px_rgba(59,130,246,0.18)] dark:border-[#3b82f6] dark:bg-white/[0.06] dark:shadow-[0_0_48px_rgba(59,130,246,0.28)] md:scale-[1.02] z-10'
          : 'pricing-card--free border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]')
      }
    >
      {plan.badge ? (
        <div className="absolute -top-3.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#2b73fe] px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md dark:bg-[#3b82f6]">
          {plan.badge}
        </div>
      ) : null}

      <header className="mb-5 border-b border-slate-200/70 pb-5 dark:border-white/[0.08]">
        <h2 className="mb-1 text-[15px] font-bold text-[#0f172a] dark:text-white">{plan.name}</h2>
        <p className="min-h-[2.5rem] text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          {plan.description}
        </p>
        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-[2.75rem] font-extrabold leading-none text-[#0f172a] dark:text-white">
            ${plan.price}
          </span>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/ month</span>
        </div>
      </header>

      <ul className="mb-8 flex-grow space-y-3">
        {plan.features.map((feature) => (
          <li key={feature.text} className="flex items-start gap-3">
            <span
              className={
                'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ' +
                (feature.included
                  ? 'bg-[#2b73fe] text-white dark:bg-[#3b82f6]'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-300')
              }
            >
              {feature.included ? <CheckIcon /> : <XIcon />}
            </span>
            <span
              className={
                'text-[13px] font-medium leading-snug ' +
                (feature.included
                  ? 'text-[#0f172a] dark:text-slate-100'
                  : 'text-slate-400 line-through decoration-slate-300/80 dark:text-slate-500 dark:decoration-slate-600')
              }
            >
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      <a
        href={plan.ctaHref}
        className={
          'flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-bold transition-all ' +
          (isPro
            ? 'bg-[#2b73fe] text-white shadow-[0_12px_24px_-6px_rgba(43,115,254,0.55)] hover:bg-[#1d5ee0] dark:bg-[#3b82f6] dark:hover:bg-[#2563eb] dark:shadow-[0_0_22px_rgba(59,130,246,0.45)]'
            : 'border border-slate-300/80 bg-white text-[#0f172a] hover:bg-slate-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]')
        }
      >
        {plan.cta}
      </a>
    </article>
  );
}

export function PricingPlanCards() {
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 md:grid-cols-2 md:gap-8 lg:px-0">
      {PRICING_PLANS.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
