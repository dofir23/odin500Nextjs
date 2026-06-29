/** Canonical monthly report content — Apple (AAPL) April 2026 (from Odin500 report template). */

export const AAPL_REPORT_2026_04 = {
  meta: {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    indices: ['S&P 500', 'Nasdaq-100', 'Dow Jones Industrial Average'],
    benchmark: 'S&P 500 (SPY)',
    periodKey: '2026-04',
    month: 4,
    year: 2026,
    monthLabel: 'April',
    periodLabel: 'April 2026',
    reportKind: 'monthly',
    periodEnd: '2026-04-30',
    publishedLabel: 'May 1, 2026',
    asOfLabel: 'April 24, 2026',
    dataWindow: 'Jan 2023 – Apr 2026'
  },
  takeaways: [
    'Apple (AAPL) closed April 2026 at $271.06, up 7.30% for the month and 33.06% over the trailing 12 months.',
    'Year-to-date, AAPL is down 0.20%, underperforming the S&P 500 which has gained 4.70% YTD.',
    'The stock is trading 6.87% above its 200-day moving average ($253.64), a bullish technical signal.',
    'Over the past three years, AAPL has outperformed the S&P 500 by 12.90%, with a relative strength index reading of 112.9.',
    'Win rate over the trailing 36 months stands at 61.5% — 24 positive months versus 15 negative months.'
  ],
  statsGrid: [
    { label: 'Last Close', value: '$271.06', tone: 'neutral' },
    { label: '1-Month Return', value: '+7.30%', tone: 'pos' },
    { label: 'YTD Return', value: '−0.20%', tone: 'neg' },
    { label: '12-Month Return', value: '+33.06%', tone: 'pos' },
    { label: '3-Year Return', value: '+64.04%', tone: 'pos' },
    { label: 'Drawdown from 52W High', value: '−5.20%', tone: 'neg' }
  ],
  recapParagraphs: [
    'Apple Inc. ended April 2026 at $271.06, posting a monthly gain of 7.30% after a softer start to the year. The S&P 500 returned approximately 8.70% over the same period, meaning Apple lagged its primary benchmark by roughly 1.4 percentage points despite an absolute gain.',
    "The month's recovery follows a tougher first quarter, where AAPL dropped 6.6% in Q1 2026 against a backdrop of broader market volatility. The April rebound has lifted the stock back into a constructive technical position, with the share price now sitting 6.87% above its 200-day moving average of $253.64 — a configuration that historically signals continued momentum.",
    'On a year-to-date basis, however, the picture is less flattering. AAPL is down 0.20% YTD while the S&P 500 has gained 4.70%, leaving the stock with a YTD performance gap of nearly five percentage points relative to the index.'
  ],
  sectionNarratives: {
    priceChartCaption:
      'Apple (AAPL) 3-year price with 200-day moving average. Shaded band shows the 52-week trading range.',
    trailingReturns: {
      intro:
        "The table below summarizes AAPL's price performance across standard time horizons, alongside the S&P 500 (SPY) benchmark and the implied excess return.",
      summary:
        'Across the trailing horizons shown, AAPL has generally lagged the S&P 500, with the most pronounced underperformance over the 3-year period. The lone bright spot is the trailing 3-month window, where Apple\'s recovery from Q1 weakness produced a 5.79 percentage point lead over the benchmark.'
    },
    monthlyStats: {
      intro: 'The following statistics are derived from 39 monthly observations covering the trailing three years.',
      summary:
        'Apple has produced positive monthly returns in 24 of the past 39 months (61.5%), with an average gain of 1.84% per month. Realized annualized volatility of 20.4% is roughly in line with the broader large-cap technology sector. The implied 3-year CAGR of 27.12% reflects both the favorable starting point of January 2023 and the strength of the 2023–2024 rally; trailing returns from more recent reference dates are materially lower.'
    },
    bestWorstMonths: {
      summary:
        "The strongest monthly performance came in May 2024 (+13.02%), driven by post-earnings optimism around Apple's AI roadmap. The worst month was September 2023 (−8.86%), during a broad-market selloff in growth and technology names. Three of the five worst months occurred in 2025, reflecting the difficult environment for mega-cap technology earlier in that year."
    },
    quarterlyAnnual: {
      summary:
        'The pattern of declining annual returns from 2023 (+54.8%) through the 2026 YTD reading (−0.2%) reflects a broader cooling in mega-cap technology performance. Quarterly volatility has increased — the spread between Q3 2025\'s +24.25% and Q2 2025\'s −7.51% is the widest two-quarter swing in the observation window.'
    },
    drawdown: {
      intro:
        'The 52-week trading range for AAPL spans $194.68 to $285.92, with the current price of $271.06 sitting 5.20% below the 52-week high reached in December 2025. Position within the range is approximately 83.7% — meaning AAPL is in the upper portion of its yearly trading band.',
      summary:
        "Apple's worst three-year drawdown of −33.36% on April 8, 2025 followed the broad sell-off in mega-cap technology that occurred during early 2025. Recovery has been steady, with the current drawdown of just 5.2% from the cycle high suggesting the stock has substantially repaired the 2025 damage. Position above the 200-day moving average is a constructive medium-term technical configuration."
    },
    relativeStrength: {
      intro:
        'Relative Strength (RS) measures whether AAPL has outperformed or lagged the S&P 500 over time. The line is rebased to 100 at the start of the observation window — values above 100 indicate cumulative outperformance, values below indicate cumulative underperformance.',
      summary:
        "Apple's cumulative outperformance of the S&P 500 reached its peak at 132.6 in June 2023, when the stock's AI-driven rally was at its strongest. The trough of 96.1 in August 2025 marked a period when AAPL had given back its lead and was briefly trailing the index on a 3-year basis. The recovery to 112.9 reflects renewed outperformance in late 2025, though the stock is still well below its 2023 peak relative position.",
      summaryExtra:
        "It's worth noting that against the Nasdaq-100 (QQQ), the picture is meaningfully different. AAPL has actually underperformed QQQ by approximately 13.83% over the same three-year window, reflecting the strength of other mega-cap technology names that comprise the Nasdaq-100 index."
    },
    seasonality: {
      intro:
        "The following heatmap shows AAPL's monthly returns by calendar month and year. Green cells indicate positive months, red indicates negative months, with shading proportional to magnitude.",
      summary:
        'The strongest seasonal periods historically have been June (+9.0% average), November (+5.9%), and December (+4.4%). The weakest tend to be January (−4.1%) and February (−1.8%), suggesting Apple has historically struggled in the early weeks of each calendar year. This pattern is consistent with broader large-cap technology seasonality.'
    },
    scorecard: {
      intro:
        "Odin500's proprietary scorecard rates each Dow component on four dimensions, on a 0–25 scale per pillar, with a maximum total of 100.",
      summary:
        'Apple ranks #8 of 30 Dow components in the April 2026 scorecard, classified as Tier 2 — Buy. Strongest pillars are Momentum (19/25) and Growth (17/25), while Valuation and Dividend are middle-of-pack relative to the Dow universe.'
    }
  },
  monthlyStatsObservationCount: 39,
  trailingReturns: [
    { period: '1 Day', ticker: '−0.87%', bench: '+0.77%', excess: '−1.64%', tickerTone: 'neg', benchTone: 'pos', excessTone: 'neg' },
    { period: '1 Week', ticker: '+0.31%', bench: '+0.54%', excess: '−0.23%', tickerTone: 'pos', benchTone: 'pos', excessTone: 'neg' },
    { period: '1 Month', ticker: '+7.30%', bench: '+8.70%', excess: '−1.40%', tickerTone: 'pos', benchTone: 'pos', excessTone: 'neg' },
    { period: '3 Months', ticker: '+9.38%', bench: '+3.59%', excess: '+5.79%', tickerTone: 'pos', benchTone: 'pos', excessTone: 'pos' },
    { period: '6 Months', ticker: '+5.08%', bench: '+7.23%', excess: '−2.15%', tickerTone: 'pos', benchTone: 'pos', excessTone: 'neg' },
    { period: 'YTD', ticker: '−0.20%', bench: '+4.70%', excess: '−4.90%', tickerTone: 'neg', benchTone: 'pos', excessTone: 'neg' },
    { period: '12 Months', ticker: '+33.06%', bench: '+34.50%', excess: '−1.44%', tickerTone: 'pos', benchTone: 'pos', excessTone: 'neg' },
    { period: '3 Years', ticker: '+64.04%', bench: '+78.65%', excess: '−14.61%', tickerTone: 'pos', benchTone: 'pos', excessTone: 'neg', bold: true }
  ],
  monthlyStatsLeft: [
    { label: 'Average Monthly Return', value: '+1.84%', tone: 'pos' },
    { label: 'Median Monthly Return', value: '+1.91%', tone: 'pos' },
    { label: 'Standard Deviation', value: '5.89%', tone: 'neutral' },
    { label: 'Annualized Volatility', value: '20.41%', tone: 'neutral' },
    { label: 'CAGR (3-Year)', value: '+27.12%', tone: 'pos' },
    { label: 'Sharpe Ratio (rf=0)', value: '1.33', tone: 'neutral' }
  ],
  monthlyStatsRight: [
    { label: 'Positive Months', value: '24', tone: 'pos' },
    { label: 'Negative Months', value: '15', tone: 'neg' },
    { label: 'Total Months', value: '39', tone: 'neutral' },
    { label: 'Win Rate', value: '61.5%', tone: 'pos', bold: true },
    { label: 'Best Month', value: '+13.02%', tone: 'pos' },
    { label: 'Worst Month', value: '−8.86%', tone: 'neg' }
  ],
  bestMonths: [
    { rank: 1, label: 'May 2024', value: '+13.02%' },
    { rank: 2, label: 'Aug 2025', value: '+11.96%' },
    { rank: 3, label: 'Mar 2023', value: '+11.87%' },
    { rank: 4, label: 'Nov 2023', value: '+11.38%' },
    { rank: 5, label: 'Sep 2025', value: '+9.69%' }
  ],
  worstMonths: [
    { rank: 1, label: 'Sep 2023', value: '−8.86%' },
    { rank: 2, label: 'Mar 2025', value: '−8.15%' },
    { rank: 3, label: 'Jan 2025', value: '−5.76%' },
    { rank: 4, label: 'May 2025', value: '−5.36%' },
    { rank: 5, label: 'Mar 2024', value: '−5.13%' }
  ],
  quarters: [
    { quarter: 'Q1 2025', value: '−11.20%', tone: 'neg' },
    { quarter: 'Q2 2025', value: '−7.51%', tone: 'neg' },
    { quarter: 'Q3 2025', value: '+24.25%', tone: 'pos' },
    { quarter: 'Q4 2025', value: '+6.87%', tone: 'pos' },
    { quarter: 'Q1 2026', value: '−6.56%', tone: 'neg' },
    { quarter: 'Q2 2026 (QTD)', value: '+6.80%', tone: 'pos', bold: true }
  ],
  calendarYears: [
    { year: '2023', value: '+54.79%', tone: 'pos' },
    { year: '2024', value: '+30.71%', tone: 'pos' },
    { year: '2025', value: '+9.05%', tone: 'pos' },
    { year: '2026 YTD', value: '−0.20%', tone: 'neg', bold: true }
  ],
  drawdownMetrics: [
    { label: '52-Week High', value: '$285.92 (Dec 2, 2025)' },
    { label: '52-Week Low', value: '$194.68 (May 23, 2025)' },
    { label: 'Current Price', value: '$271.06' },
    { label: '200-Day Moving Average', value: '$253.64' },
    { label: 'Price vs 200DMA', value: '+6.87%', tone: 'pos' },
    { label: '3-Year Maximum Drawdown', value: '−33.36% (Apr 8, 2025)', tone: 'neg' },
    { label: 'Current Drawdown from 52W High', value: '−5.20%', tone: 'neg', bold: true }
  ],
  relativeStrength: [
    { label: 'RS Index (3-year, rebased to 100)', value: '112.9', tone: 'pos' },
    { label: '3-Year Excess Return vs S&P 500', value: '+12.90%', tone: 'pos' },
    { label: 'RS Peak', value: '132.6 (June 2023)' },
    { label: 'RS Trough', value: '96.1 (August 2025)' },
    { label: 'Status', value: 'Outperforming Benchmark', tone: 'pos', bold: true }
  ],
  seasonality: {
    years: [2023, 2024, 2025, 2026],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    cells: {
      '2023': [null, -2.3, 11.9, 2.9, 4.6, 9.4, -1.3, -4.4, -8.9, -0.7, 11.4, -0.7],
      '2024': [-4.9, -2.0, -5.1, -0.7, 13.0, 9.6, 0.7, 2.1, 1.5, -1.5, 7.6, 5.5],
      '2025': [-5.8, -1.0, -8.1, -1.5, -5.4, 8.0, 5.7, 12.0, 9.7, 5.1, -1.2, 8.4],
      '2026': [-1.6, -2.4, 3.0, 7.3, null, null, null, null, null, null, null, null]
    },
    averages: [-4.1, -1.8, 0.4, 1.7, 4.1, 9.0, 1.7, 3.2, 0.8, 1.0, 5.9, 4.4]
  },
  scorecard: {
    rank: '#8 of 30',
    total: '61 / 100',
    tier: 'Tier 2 — Buy',
    pillars: [
      { label: 'Valuation', score: '14 / 25', pct: 56 },
      { label: 'Growth', score: '17 / 25', pct: 68 },
      { label: 'Dividend', score: '11 / 25', pct: 44 },
      { label: 'Momentum', score: '19 / 25', pct: 76 }
    ],
    overallPct: 73,
    totalPct: 61
  },
  faqs: [
    {
      q: "What was Apple's (AAPL) stock return in April 2026?",
      a: 'Apple Inc. (AAPL) gained 7.30% in April 2026, closing the month at $271.06. This compared with a 8.70% gain for the S&P 500 (SPY) over the same period.'
    },
    {
      q: 'Has AAPL outperformed the S&P 500 in 2026 year-to-date?',
      a: 'No. As of April 24, 2026, AAPL is down 0.20% year-to-date, while the S&P 500 (SPY) has gained 4.70%. Apple has underperformed the benchmark by approximately 4.90 percentage points YTD.'
    },
    {
      q: "What is AAPL's 12-month return?",
      a: 'AAPL has returned 33.06% over the trailing 12 months, slightly underperforming the S&P 500 which returned 34.50% over the same period.'
    },
    {
      q: 'Is Apple stock above or below its 200-day moving average?',
      a: 'AAPL is trading 6.87% above its 200-day moving average of $253.64, signaling an uptrend in the stock\'s medium-term technical position.'
    },
    {
      q: "What was AAPL's worst drawdown in the past 3 years?",
      a: 'AAPL\'s worst drawdown over the past three years was −33.36%, which occurred on April 8, 2025. The stock has since recovered most of those losses and is currently 5.20% below its 52-week high.'
    },
    {
      q: 'How many positive months has AAPL had in the last 3 years?',
      a: 'Out of 39 monthly observations in the last three years, AAPL has posted positive returns in 24 months and negative returns in 15 months — a win rate of 61.5%.'
    }
  ],
  charts: {
    price3y: {
      labels: ['Jan 2023', 'Oct 2023', 'Aug 2024', 'Jun 2025', 'Apr 2026'],
      price: [245, 255, 220, 195, 271],
      ma200: [248, 250, 245, 240, 254],
      high52: 285.92,
      low52: 194.68
    },
    monthlyReturns: {
      labels: ['2023', '2024', '2025', '2026'],
      values: [2.1, 8.5, -1.2, 7.3, 4.2, -3.1, 5.6, 2.8, -2.4, 1.1, 6.2, -1.5, 3.2, -0.8, 4.1, -2.2, 7.3, 5.1, -4.2, 2.9, 1.8, -3.5, 4.6, 2.2, -1.6, -2.4, 3.0, 7.3]
    },
    annualCompare: {
      years: ['2023', '2024', '2025', '2026 YTD'],
      ticker: [54.8, 30.7, 9.1, -0.2],
      bench: [26.7, 24.9, 17.7, 4.7]
    },
    drawdown: {
      labels: ['Jan 2023', 'Oct 2023', 'Aug 2024', 'Jun 2025', 'Apr 2026'],
      values: [0, -5, -12, -33.4, -5.2]
    },
    relativeStrength: {
      labels: ['Jan 2023', 'Oct 2023', 'Aug 2024', 'Jun 2025', 'Apr 2026'],
      values: [100, 108, 115, 96, 112.9],
      peak: 132.6,
      trough: 96.1,
      peakDate: 'Jun 2023',
      troughDate: 'Aug 2025'
    }
  }
};
