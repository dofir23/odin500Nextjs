'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PricingPlanCards } from '@/components/premium/PricingPlanCards';
import { PRICING_HERO, PRICING_WHY_FEATURES } from '@/content/premiumPageContent';
import { PREMIUM_FAQS } from '@/content/premiumFaqs';
import '../styles/premium-page.css';

const faqs = PREMIUM_FAQS;

function FaqAnswer({ faq }) {
  return (
    <div className="pricing-faq__answer">
      {faq.intro ? <p>{faq.intro}</p> : null}
      {Array.isArray(faq.body)
        ? faq.body.map((line, lineIdx) => <p key={lineIdx}>{line}</p>)
        : null}
      {Array.isArray(faq.points) && faq.points.length ? (
        <ul>
          {faq.points.map((point, pointIdx) => (
            <li key={pointIdx}>{point}</li>
          ))}
        </ul>
      ) : null}
      {faq.outro ? <p>{faq.outro}</p> : null}
    </div>
  );
}

export default function OdinPricingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const leftFaqs = faqs.filter((_, i) => i % 2 === 0);
  const rightFaqs = faqs.filter((_, i) => i % 2 === 1);

  const renderFaqItem = (faq, index) => {
    const isOpen = openFaq === index;
    return (
      <article
        key={faq.q}
        className={'pricing-faq__item' + (isOpen ? ' pricing-faq__item--open' : '')}
      >
        <button
          type="button"
          className="pricing-faq__trigger"
          onClick={() => toggleFaq(index)}
          aria-expanded={isOpen}
        >
          <span className="pricing-faq__question">{faq.q}</span>
          <span className="pricing-faq__icon" aria-hidden>
            <ChevronDown size={14} strokeWidth={2.25} />
          </span>
        </button>
        {isOpen ? <FaqAnswer faq={faq} /> : null}
      </article>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f7fb] pb-16 font-sans dark:bg-[#020617] dark:pb-8">
      <div className="pointer-events-none absolute left-[15%] top-0 z-0 h-full w-px bg-white/60 dark:bg-white/[0.06]" />
      <div className="pointer-events-none absolute right-[15%] top-0 z-0 h-full w-px bg-white/60 dark:bg-white/[0.06]" />
      <div className="pointer-events-none absolute left-0 top-[120px] z-0 h-px w-full bg-white/60 dark:bg-white/[0.06]" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#3b82f6]/10 blur-[100px] dark:bg-[#3b82f6]/25" />
      <div className="pointer-events-none absolute left-1/2 top-[25%] z-0 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[#3b82f6]/20 blur-[80px] dark:bg-[#60a5fa]/30" />

      <section className="relative z-10 mx-auto max-w-[1400px] px-4 pb-16 pt-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-1 text-2xl font-bold tracking-wide text-[#4388fc] dark:text-[#60a5fa]">
            {PRICING_HERO.eyebrow}
          </p>
          <h1 className="mb-4 text-[2.75rem] font-extrabold leading-tight tracking-tight text-[#0f172a] dark:text-white md:text-[3.25rem]">
            {PRICING_HERO.title}
          </h1>
          <p className="px-4 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 sm:px-10">
            {PRICING_HERO.subtitle}
          </p>
        </div>

        <PricingPlanCards />
      </section>

      <section className="relative z-10 mx-auto max-w-[1000px] px-4 pt-8">
        <div className="relative mb-24">
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-[60%]">
            <div className="absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-200/40 dark:border-[#3b82f6]/25" />
            <div className="absolute left-1/2 top-1/2 h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-200/30 dark:border-[#3b82f6]/18" />
          </div>

          <h2 className="relative z-10 mb-10 text-center text-[2.2rem] font-extrabold text-[#0f172a] dark:text-white">
            Why Odin500?
          </h2>

          <div className="relative z-10 grid grid-cols-1 gap-[18px] md:grid-cols-3">
            {PRICING_WHY_FEATURES.map((text) => (
              <div
                key={text}
                className="flex min-h-[100px] items-center justify-center rounded-xl border border-white/80 bg-white/70 p-5 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)] backdrop-blur-md dark:border-white/[0.1] dark:bg-white/[0.05] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
              >
                <p className="text-[13px] font-semibold leading-[1.4] text-[#334155] dark:text-slate-300">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <section className="pricing-faq" aria-labelledby="pricing-faq-title">
          <div className="pricing-faq__panel">
            <h2 id="pricing-faq-title" className="pricing-faq__title">
              Frequently Asked Questions
            </h2>

            <div className="pricing-faq__columns">
              <div className="pricing-faq__col">
                {leftFaqs.map((faq, localIdx) => renderFaqItem(faq, localIdx * 2))}
              </div>
              <div className="pricing-faq__col">
                {rightFaqs.map((faq, localIdx) => renderFaqItem(faq, localIdx * 2 + 1))}
              </div>
            </div>
          </div>
        </section>

        <div className="relative z-20 pb-12 text-center">
          <a
            href="/signup"
            className="inline-flex rounded-xl bg-[#2b73fe] px-14 py-[14px] text-sm font-bold text-white shadow-[0_12px_24px_-6px_rgba(43,115,254,0.6)] transition-all hover:bg-[#1d5ee0] dark:bg-[#3b82f6] dark:hover:bg-[#2563eb] dark:shadow-[0_0_22px_rgba(59,130,246,0.45)]"
          >
            Start free
          </a>
          <p className="mt-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            No credit card required · Upgrade to Pro anytime
          </p>
        </div>
      </section>
    </div>
  );
}
