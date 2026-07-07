export const PAPER_TRADING_HERO = {
  title: 'Virtual portfolio simulator',
  subtitle:
    'Practice U.S. stock trading with simulated fills at daily OHLC closes. Build watchlists, place manual orders, automate strategy rules, and track performance — without risking real capital.'
};

export const PAPER_TRADING_FEATURES = [
  {
    title: 'Simulated market fills',
    body:
      'Market and limit orders fill against Odin daily close prices with realistic slippage assumptions. Review equity curves, closed trades, and sector exposure like a live account.'
  },
  {
    title: 'Strategy automation',
    body:
      'Attach Odin signal rules to a virtual portfolio — buy or short when entry signals fire, exit on opposing signals, and cap position size by shares or dollar amount.'
  },
  {
    title: 'Manual order ticket',
    body:
      'Place buys, sells, shorts, and covers with share quantity or dollar amount sizing. Use bracket stop-loss and take-profit orders on entries.'
  },
  {
    title: 'Public portfolios',
    body:
      'Publish a read-only portfolio to share holdings, performance, and trade history with the community.'
  }
] as const;

export const PAPER_TRADING_FAQS = [
  {
    q: 'Is paper trading free?',
    a: 'Yes. Virtual portfolios are included with a free Odin500 account. Pro unlocks full signal coverage for strategy rules across all indices and ETFs.'
  },
  {
    q: 'How are fills priced?',
    a: 'Simulated fills use the latest available daily OHLC close for each ticker, with slippage applied on market orders. Pending limit and stop orders are evaluated on the daily close schedule.'
  },
  {
    q: 'Can I automate trades from Odin signals?',
    a: 'Yes. Strategy rules can open and close positions when Odin signal buckets (L1–L3, S1–S3, neutral) match your entry and exit criteria, subject to position limits you define.'
  },
  {
    q: 'Does paper trading connect to my broker?',
    a: 'No. Odin500 paper trading is fully simulated. Execute real trades with any broker you choose using Odin data and signals as research input.'
  },
  {
    q: 'Who is virtual portfolio trading for?',
    a: 'Active traders testing position sizing, investors validating signal ideas before committing capital, and researchers comparing systematic rules across tickers and sectors.'
  }
] as const;
