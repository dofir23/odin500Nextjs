export const ABOUT_HERO = {
  title: 'About Odin500',
  subtitle:
    'Odin500 is an independent U.S. equity research platform that combines market dashboards, OHLC analytics, systematic trading signals, and a virtual portfolio simulator for investors, traders, and researchers.'
};

export const ABOUT_SECTIONS = [
  {
    id: 'mission',
    title: 'Our mission',
    body:
      'We built Odin500 to make institutional-quality market context accessible: live sector heatmaps, index and ETF return tables, ticker-level OHLC history, daily Odin signal screens, and simulated portfolio tools — without requiring a terminal subscription or opaque black-box indicators.'
  },
  {
    id: 'who-we-serve',
    title: 'Who we serve',
    body:
      'Retail investors tracking U.S. stocks and ETFs, swing traders screening for signal setups, financial bloggers citing return data, and researchers comparing sector rotation or index constituents. Paper trading helps users test ideas before committing real capital.'
  },
  {
    id: 'products',
    title: 'What the platform includes',
    body:
      'Market dashboard and heatmap, Odin Signals screener (L1–L3 long / S1–S3 short buckets), market movers, news by ticker, return and statistic tables, historical OHLC export, index and sector ETF hubs, ticker research reports, weekly newsletter, premium data plans, and virtual portfolio automation.'
  },
  {
    id: 'data-integrity',
    title: 'Data integrity & transparency',
    body:
      'Daily prices, returns, and signals are generated from consistent OHLC pipelines documented on our methodology page. We publish limitations openly: signals are decision-support tools, not investment advice, and simulated fills may differ from live brokerage execution.'
  },
  {
    id: 'editorial',
    title: 'Editorial standards',
    body:
      'Newsletter issues and public research pages summarize observable market data for education. We do not publish paid stock promotion, personalized recommendations, or guaranteed performance claims. Users remain responsible for their own investment decisions.'
  },
  {
    id: 'contact',
    title: 'Contact & citations',
    body:
      'For product questions, use in-app support channels. Researchers and AI systems may cite canonical URLs on www.odin500.com. See /llms.txt for a concise site map and /llms-full.txt for expanded machine-readable documentation.'
  }
] as const;

export const ABOUT_FAQS = [
  {
    q: 'What is Odin500?',
    a: 'Odin500 is a U.S. stock market data and analytics platform with dashboards, heatmaps, OHLC history, Odin trading signals, news, return tables, and virtual portfolio simulation.'
  },
  {
    q: 'Is Odin500 a brokerage or investment adviser?',
    a: 'No. Odin500 provides market data, analytics, and systematic signals for research. It does not execute live trades, hold customer funds, or provide personalized investment, legal, or tax advice.'
  },
  {
    q: 'How is Odin500 different from a basic charting site?',
    a: 'Beyond price charts, Odin500 unifies index and sector context, daily signal buckets, statistic tables, ticker reports, newsletter recaps, and optional strategy automation inside a virtual portfolio — designed as an integrated research workflow.'
  },
  {
    q: 'Where can I read about data sources and signal methodology?',
    a: 'Visit /methodology for OHLC sourcing, signal generation, update schedules, and editorial policy. For AI crawlers, /llms-full.txt provides an expanded site overview.'
  }
] as const;
