export const METHODOLOGY_HERO = {
  title: 'Data methodology & editorial standards',
  subtitle:
    'How Odin500 sources U.S. equity data, generates daily trading signals, publishes research pages, and communicates limitations to investors and researchers.'
};

export const METHODOLOGY_SECTIONS = [
  {
    id: 'coverage',
    title: 'Market coverage',
    body:
      'Odin500 focuses on U.S. listed equities, major index benchmarks (S&P 500, Dow Jones, Nasdaq-100), sector ETFs, and selected commodity ETFs. Ticker pages, heatmaps, return tables, and signal screens share a consistent symbol universe updated from our market data pipeline.'
  },
  {
    id: 'ohlc',
    title: 'OHLC prices & returns',
    body:
      'Charts, statistics, and return tables are built from daily open, high, low, and close prices. Period returns (daily through annual) are computed from those OHLC series using consistent calendar rules so comparisons across tickers and indices remain aligned.'
  },
  {
    id: 'signals',
    title: 'Odin trading signals',
    body:
      'Odin Signals (L1–L3 long, S1–S3 short, N neutral) are generated daily from proprietary quantitative models that evaluate price action, trend structure, and statistical patterns. Signals are decision-support indicators — not investment recommendations or guarantees of future performance.'
  },
  {
    id: 'updates',
    title: 'Update frequency',
    body:
      'Daily OHLC data and signal states refresh on the platform’s market data schedule. The weekly newsletter publishes on Sundays (UTC) with index performance, sector rotation notes, and signal highlights. Market news headlines are ingested from third-party news providers and grouped by ticker and index.'
  },
  {
    id: 'editorial',
    title: 'Editorial & newsletter policy',
    body:
      'Newsletter issues summarize observable market data and Odin platform metrics for the prior week. They are written for education and research context, reviewed before publication, and should not be interpreted as personalized financial advice. Users are responsible for their own investment decisions.'
  },
  {
    id: 'limitations',
    title: 'Limitations & disclaimers',
    body:
      'Historical performance and signal backtests do not guarantee future results. Paper trading uses simulated fills that may differ from live brokerage execution, especially during fast markets or corporate actions. Always verify critical data independently before trading.'
  }
] as const;

export const METHODOLOGY_FAQS = [
  {
    q: 'Where does Odin500 get stock prices?',
    a: 'Daily OHLC history powers charts, return analytics, heatmaps, and simulated paper trading fills across the covered U.S. equity universe.'
  },
  {
    q: 'How often do signals change?',
    a: 'Odin signal buckets are recalculated daily for each covered ticker. The latest state is shown on ticker pages, the Odin Signals screener, and strategy automation rules.'
  },
  {
    q: 'Is Odin500 investment advice?',
    a: 'No. Odin500 provides market data, analytics, and systematic signals for research. It does not provide personalized investment, legal, or tax advice.'
  },
  {
    q: 'Can I cite Odin500 in research or AI summaries?',
    a: 'Yes. Link to the canonical URL on www.odin500.com for the specific ticker, index, or tool referenced. See /llms.txt for a concise site map and /llms-full.txt for expanded AI documentation.'
  }
] as const;
