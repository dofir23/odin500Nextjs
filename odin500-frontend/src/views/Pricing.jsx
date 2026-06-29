'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PricingPlanCards } from '@/components/premium/PricingPlanCards';
import { PRICING_HERO, PRICING_WHY_FEATURES } from '@/content/premiumPageContent';

const faqs = [
  {
    q: 'What do I get with a subscription?',
    intro:
      'You get full access to daily Odin Signals across all covered tickers (S&P 500, Nasdaq-100, Dow Jones, and leading ETFs), including:',
    points: [
      'Daily signals for covered tickers',
      'Coverage across S&P 500, Nasdaq-100, Dow Jones, and major ETFs',
      'Historical signal performance and return analytics',
      'Advanced market data views and return analysis'
    ]
  },
  {
    q: "What's the difference between Ticker Signals and Odin Trading Signals?",
    body: [
      'Odin Ticker Signals are generated daily for each covered ticker using proprietary quantitative methodologies that analyze price action, trends, and statistical patterns.',
      'Odin Trading Signals are separate signals used for Odin sample portfolio accounts. These sample accounts include a limited number of strategy-specific trading signals for each account.'
    ]
  },
  {
    q: 'What are Odin Sample Portfolio Accounts?',
    body: [
      'Odin Sample Portfolio Accounts are demo accounts that illustrate how Odin signals can be deployed under different trading strategies.',
      'Some accounts are focused on ETF/index deployment, while others emphasize specific factor-sensitive strategies. Performance is compared against the most relevant underlying benchmark.'
    ]
  },
  {
    q: 'How are Odin Signals generated?',
    body: [
      'Odin Signals are generated using proprietary quantitative methodologies that evaluate price action, trends, and statistical patterns across each ticker.',
      'The system is designed to identify, on a daily basis, higher-probability long and short opportunities.'
    ]
  },
  {
    q: 'What do the signals (L1, L2, L3, S1, S2, S3) mean?',
    points: [
      'L1 / S1: Strongest conviction signals',
      'L2 / S2: Moderate signals',
      'L3 / S3: Early or weaker signals',
      'N (neutral): No clear edge'
    ],
    outro: 'This structure helps you adjust position sizing and risk level.'
  },
  {
    q: 'Is this suitable for beginners?',
    intro: 'Yes, but with context. Odin500 is best for:',
    points: [
      'Active traders who want structured signals as an additional decision-support tool',
      'Investors looking to enhance returns versus buy-and-hold strategies'
    ],
    outro: 'Market understanding and trading experience are highly recommended.'
  },
  {
    q: 'Does this guarantee profits?',
    body: [
      'No. Like any trading methodology, there are no guarantees that signals will generate positive returns on every trade or over every period.',
      'Odin signals are designed as an additional decision-support layer, not as a replacement for your own investment decisions or risk preferences.'
    ]
  },
  {
    q: 'How often are signals updated?',
    body: [
      'Signals are updated daily for every covered ticker.',
      'You always have access to the latest signal state across the full universe.'
    ]
  },
  {
    q: 'Can I use this for long-term investing or only trading?',
    intro: 'Both.',
    points: [
      'Active traders can use signals for entry/exit timing',
      'Long-term investors can use signals to optimize allocations and reduce drawdowns'
    ],
    outro: 'Odin signals are not designed for day-trading or high-frequency strategies.'
  },
  {
    q: 'What markets are covered?',
    points: [
      'S&P 500 stocks',
      'Nasdaq-100 stocks',
      'Dow Jones stocks',
      'Major index ETFs (e.g., SPY, QQQ, DIA)',
      'S&P 500 sector ETFs',
      'Commodity ETFs (e.g., GLD, SLV, USO, UNG)'
    ]
  },
  {
    q: 'Can I cancel anytime?',
    body: [
      'Yes. You can cancel your subscription at any time. Access remains active until the end of your current billing cycle.'
    ]
  },
  {
    q: 'Do you offer a free trial or preview?',
    body: [
      'Yes. Limited access preview is available so you can evaluate signal quality before subscribing.'
    ]
  },
  {
    q: 'How is this different from other signal providers?',
    intro: 'Odin500 is built around:',
    points: [
      'Full market coverage (not just a few picks)',
      'Consistent daily signals for every ticker',
      'Structured signal-strength system',
      'Integrated data, analytics, ticker signals, and trading signals in one platform'
    ]
  },
  {
    q: 'Do I need to connect a broker?',
    body: [
      'No. Odin500 is an independent decision-support platform.',
      'You can execute trades using any broker you prefer.'
    ]
  },
  {
    q: 'Is there historical performance data?',
    intro: 'Yes. You can view:',
    points: [
      'Historical signal performance',
      'Monthly and annual return analytics',
      'Comparative performance versus buy-and-hold'
    ]
  },
  {
    q: 'Who is this built for?',
    points: [
      'Active traders',
      'Data-driven investors',
      'Users who want systematic signals as an additional decision-support tool'
    ]
  }
];

export default function OdinPricingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const leftFaqs = faqs.filter((_, i) => i % 2 === 0);
  const rightFaqs = faqs.filter((_, i) => i % 2 === 1);

  const renderFaqCard = (faq, index) => (
    <div
      key={index}
      className="overflow-hidden rounded-[14px] bg-[#e8edf5]/80 backdrop-blur-sm transition-colors hover:bg-[#e1e7f0] dark:bg-slate-900/55 dark:hover:bg-slate-800/70"
    >
      <button
        type="button"
        onClick={() => toggleFaq(index)}
        className="flex w-full items-center justify-between px-5 py-[18px] text-left"
      >
        <span className="pr-4 text-[13px] font-semibold text-[#334155] dark:text-slate-100">
          {faq.q}
        </span>
        <Plus
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform dark:text-slate-500 ${openFaq === index ? 'rotate-45' : ''}`}
        />
      </button>

      {openFaq === index ? (
        <div className="border-t border-slate-200/60 px-5 pb-5 pt-3 text-[13px] leading-relaxed text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
          {faq.intro ? <p className="mb-2">{faq.intro}</p> : null}
          {Array.isArray(faq.body)
            ? faq.body.map((line, lineIdx) => (
                <p key={lineIdx} className={lineIdx > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))
            : null}
          {Array.isArray(faq.points) && faq.points.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {faq.points.map((point, pointIdx) => (
                <li key={pointIdx}>{point}</li>
              ))}
            </ul>
          ) : null}
          {faq.outro ? <p className="mt-2">{faq.outro}</p> : null}
        </div>
      ) : null}
    </div>
  );

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

        <div className="relative mb-16">
          <div className="pointer-events-none absolute left-1/2 top-[40%] z-0 h-[600px] w-[1200px] -translate-x-1/2 rounded-full bg-white/40 blur-[100px] dark:bg-[#3b82f6]/12" />

          <h2 className="relative z-10 mb-10 text-center text-[2.2rem] font-extrabold text-[#0f172a] dark:text-white">
            Frequently Asked Questions
          </h2>

          <div className="relative z-10 grid grid-cols-1 items-start gap-x-5 gap-y-3 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              {leftFaqs.map((faq, localIdx) => renderFaqCard(faq, localIdx * 2))}
            </div>
            <div className="flex flex-col gap-3">
              {rightFaqs.map((faq, localIdx) => renderFaqCard(faq, localIdx * 2 + 1))}
            </div>
          </div>
        </div>

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
