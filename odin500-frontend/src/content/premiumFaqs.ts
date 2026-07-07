export type PremiumFaq = {
  q: string;
  intro?: string;
  body?: string[];
  points?: string[];
  outro?: string;
};

export const PREMIUM_FAQS: PremiumFaq[] = [
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

export function premiumFaqPlainText(faq: PremiumFaq): string {
  const parts: string[] = [];
  if (faq.intro) parts.push(faq.intro);
  if (faq.body?.length) parts.push(...faq.body);
  if (faq.points?.length) parts.push(faq.points.join('. '));
  if (faq.outro) parts.push(faq.outro);
  return parts.join(' ').trim();
}
