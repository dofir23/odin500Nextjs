/** Crawler-visible copy for routes without API-backed SSR tables. */

export type StaticPageSeoBlock = {
  heading: string;
  paragraphs: string[];
  /** Optional h3 sub-sections, for pages that need more depth than a few paragraphs. */
  sections?: Array<{ heading: string; body: string }>;
  /** Optional Q&A. Wire the path into faqJsonLdForPath to also emit FAQPage schema. */
  faqs?: Array<{ q: string; a: string }>;
  links?: Array<{ href: string; label: string }>;
};

export const STATIC_PAGE_SEO: Record<string, StaticPageSeoBlock> = {
  '/': {
    heading: 'AI stock portfolios — Claude, ChatGPT and Gemini trading U.S. equities',
    paragraphs: [
      'Odin500 runs virtual stock portfolios in which large language models make every trading decision. Each book picks its own tickers and rebalances on a set cadence across the S&P 500, Nasdaq-100, and Dow Jones, going long, short, or both — and every position, rebalance, and closed trade is published so you can compare how the models actually perform.',
      'Launch your own AI-managed portfolio with Claude, ChatGPT, or Gemini: choose the index, the direction, the selection criteria, and how often it rebalances, then leave it to trade unattended and track it against every other published book.',
      'The same platform carries the market data the models trade on — dashboards, sector heatmaps, OHLC historical prices, index and ETF return analytics, Odin trading signals, market news, statistic tables, stock split calendars, and per-ticker research reports.',
      'All portfolios are simulated paper trading for research and comparison. Nothing here is investment advice.'
    ],
    links: [
      { href: '/virtual-portfolio/ai', label: 'Full AI portfolio leaderboard' },
      { href: '/market', label: 'Market dashboard' },
      { href: '/odin-signals', label: 'Odin Signals' },
      { href: '/signup', label: 'Create free account' },
      { href: '/premium', label: 'Premium plans' }
    ]
  },
  '/about': {
    heading: 'About Odin500',
    paragraphs: [
      'Odin500 is an independent U.S. equity research platform with market dashboards, OHLC analytics, Odin trading signals, return tables, and a virtual portfolio simulator.',
      'We publish methodology, editorial standards, and machine-readable documentation for researchers and AI systems.'
    ],
    links: [
      { href: '/methodology', label: 'Data methodology' },
      { href: '/premium', label: 'Pricing plans' },
      { href: '/market', label: 'Market dashboard' },
      { href: '/newsletter', label: 'Weekly newsletter' }
    ]
  },
  '/profile': {
    heading: 'Your account profile',
    paragraphs: [
      'Manage your Odin500 account profile, display name, contact details, avatar, and security settings.',
      'Update subscription plan details and review account preferences from this page.'
    ],
    links: [
      { href: '/accounts', label: 'Account management' },
      { href: '/premium', label: 'Premium plans' },
      { href: '/market', label: 'Market dashboard' }
    ]
  },
  '/accounts': {
    heading: 'Account management',
    paragraphs: [
      'View billing preferences, linked authentication methods, and account security options for your Odin500 stock data account.',
      'Use this page to review account details and manage access to charts, signals, and historical OHLC data.'
    ],
    links: [
      { href: '/profile', label: 'Profile settings' },
      { href: '/virtual-portfolio', label: 'Virtual portfolio' },
      { href: '/market', label: 'Market dashboard' }
    ]
  },
  '/virtual-portfolio': {
    heading: 'Your virtual portfolio',
    paragraphs: [
      'Practice U.S. stock trading with simulated virtual portfolios, orders, and performance analytics without risking real capital.',
      'Publish a portfolio to share read-only holdings and performance on the public gallery.'
    ],
    links: [
      { href: '/virtual-portfolio/public', label: 'Public portfolios' },
      { href: '/market', label: 'Live market dashboard' },
      { href: '/odin-signals', label: 'Trading signals screener' }
    ]
  },
  '/virtual-portfolio/public': {
    heading: 'Public virtual portfolios',
    paragraphs: [
      'Browse virtual portfolios published by Odin500 users. View holdings, equity curves, closed trades, and sector allocation in read-only mode.',
      'Publish your own portfolio from Your Portfolio when you are ready to share.'
    ],
    links: [
      { href: '/virtual-portfolio', label: 'Your portfolio' },
      { href: '/market', label: 'Market dashboard' }
    ]
  },
  '/virtual-portfolio/ai/compare': {
    heading: 'Compare AI portfolios — Claude vs ChatGPT vs Gemini vs the index',
    paragraphs: [
      'Put the best-performing books from each AI model on a single chart, alongside the S&P 500, Dow Jones and Nasdaq-100 they trade against. Pick any combination of models, portfolios and indices to see how the strategies actually diverge.',
      'Every series is rebased to a common start date — the publish date of the youngest portfolio selected — so a book running two weeks is never plotted against six months of an index. Each line shows percent return from that shared date, which is the only way portfolios of different ages compare honestly.',
      'These are simulated paper-trading portfolios for research and comparison. Nothing here is investment advice.'
    ],
    sections: [
      {
        heading: 'Why the chart rebases every line',
        body:
          'Total return rewards whichever portfolio has been running longest, and a normalised chart that starts each series at its own first data point repeats that bias visually. Anchoring every series to one date means the slope you compare covers the same market conditions for all of them — the same trending days, the same choppy ones.'
      },
      {
        heading: 'Comparing models against each other and against the market',
        body:
          'Selecting one portfolio per model shows how Claude, ChatGPT and Gemini handled the same window with their own picks. Adding an index answers the harder question: whether any of them beat simply holding the benchmark over that period. Both comparisons only mean something across enough time to cover more than one market regime.'
      }
    ],
    faqs: [
      {
        q: 'How are the portfolios on this page chosen?',
        a: 'Each AI model section lists its five published portfolios with the highest total return. Models with no published portfolios yet show an empty section rather than being hidden.'
      },
      {
        q: 'Why does a portfolio line start partway across the chart?',
        a: 'A portfolio has no performance before it was published. When you select portfolios with different publish dates, the chart rebases everything to the most recent one so all selected series share a start.'
      }
    ]
  },
  '/virtual-portfolio/ai': {
    heading: 'AI stock portfolios — Claude, ChatGPT & Gemini trading performance',
    paragraphs: [
      'Odin500 runs virtual investment portfolios in which large language models make every trading decision. Claude and ChatGPT each manage their own book of stocks today, with Gemini next, going long and short across the S&P 500, Nasdaq-100, and Dow Jones. Every position, rebalance, and closed trade is published so you can compare how different AI models handle the same stock market.',
      'Each portfolio runs to a fixed trading plan set when it is created: an index universe, a direction (long, short, or long-short), how many positions it holds and how many shares each one gets, selection criteria, and a daily, weekly, or monthly rebalance cadence. From then on the model is trading stocks unattended — no human overrides the picks.',
      'Portfolios are ranked by total return since publication. The table shows portfolio value, total return, track record length, and open position count for every AI-powered portfolio — read the return alongside how long the book has been running, since a portfolio opened months ago has had far longer to accumulate one.',
      'These are simulated paper-trading portfolios for research and comparison. Nothing here is investment advice.'
    ],
    sections: [
      {
        heading: 'How the AI models make trading decisions',
        body:
          'At each rebalance the model is given tools rather than opinions. It pulls the full index universe with each constituent’s current Odin signal bucket, and can request recent market news, company news, and latest daily close prices before committing to a set of target holdings. It is instructed to rank long candidates by the strongest bullish buckets (L1, then L2, then L3) and short candidates by the strongest bearish buckets (S1, then S2, then S3), and it may never invent a ticker, price, or signal that did not come back from a tool call.'
      },
      {
        heading: 'Signals come from price data, not fundamentals',
        body:
          'The Odin signal buckets driving candidate selection are derived from daily OHLC price history, which puts these books closer to systematic technical analysis than to fundamental valuation. The financial data each model sees is identical, so differences in trading performance reflect how each model reasons over the same inputs — which candidates it takes, how it balances long and short exposure, and how quickly it rotates as market conditions change.'
      },
      {
        heading: 'Risk management and position sizes',
        body:
          'Position sizes are spread across the book rather than concentrated in single high-conviction bets, and the configured direction caps how much short exposure a portfolio may carry. Managing risk is visible rather than assumed: open positions, sector concentration, and the full closed-trade history are published for every portfolio, so drawdowns and losing streaks are on the record alongside the wins.'
      },
      {
        heading: 'Judging results over the short and long term',
        body:
          'A few strong weeks say very little about automated trading strategies. Closed-trade analytics report win rate and profit statistics per portfolio, which separates books that are genuinely working from books carried by one outsized position. Ranking noise over the short term fades as sample size grows, so treat total return over a longer track record — across both trending and choppy market conditions — as the meaningful comparison.'
      }
    ],
    faqs: [
      {
        q: 'Which AI models trade these portfolios?',
        a: 'Claude and ChatGPT run books today, with Gemini support next. Each runs as a general-purpose large language model called through its provider API — the models are not fine-tuned on market data, so what you are comparing is out-of-the-box reasoning over identical financial data.'
      },
      {
        q: 'Do the AI models trade with real money?',
        a: 'No. Every AI portfolio is a simulated paper-trading account. Fills are priced against Odin daily close data, and no broker connection or real capital is involved.'
      },
      {
        q: 'How often do the portfolios rebalance?',
        a: 'Each portfolio is configured with a daily, weekly, or monthly cadence when it is created. Rebalances run automatically on that schedule — the model closes dropped picks and opens new ones without manual intervention.'
      },
      {
        q: 'Can the AI portfolios short stocks?',
        a: 'Yes. A portfolio can be configured long-only, short-only, or long-short. Short candidates are ranked by bearish Odin signal buckets (S1 to S3), the mirror of how long candidates are ranked.'
      },
      {
        q: 'How should I compare portfolios of different ages?',
        a: 'The leaderboard ranks by total return since publication, which rewards whichever portfolio has been running longest, so every row shows its track record length next to the return. A book up 7% in two weeks and one up 7% over six months are very different results — read the two columns together.'
      },
      {
        q: 'Can I build my own portfolio alongside these?',
        a: 'Yes. Virtual portfolios are free with an Odin500 account. You can trade manually, automate entries and exits from Odin signal rules, set position limits, and publish the result to the public gallery.'
      }
    ],
    links: [
      { href: '/virtual-portfolio/public', label: 'All public portfolios' },
      { href: '/virtual-portfolio', label: 'Your portfolio' },
      { href: '/odin-signals', label: 'Odin trading signals' },
      { href: '/methodology', label: 'Signal methodology' },
      { href: '/market', label: 'Market dashboard' }
    ]
  },
  '/login': {
    heading: 'Sign in',
    paragraphs: [
      'Sign in to access stock price charts, market heatmaps, historical OHLC downloads, watchlists, and Odin trading signals.'
    ],
    links: [
      { href: '/signup', label: 'Create free account' },
      { href: '/forgot-password', label: 'Reset password' },
      { href: '/market', label: 'Browse market dashboard' }
    ]
  },
  '/signup': {
    heading: 'Create account',
    paragraphs: [
      'Register for free access to U.S. equity OHLC data, sector heatmaps, index returns, and ticker analytics on Odin500.'
    ],
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/market', label: 'Market dashboard' }
    ]
  },
  '/forgot-password': {
    heading: 'Reset password',
    paragraphs: [
      'Recover access to your Odin500 account to continue using stock charts, signals, and historical market data.'
    ],
    links: [
      { href: '/login', label: 'Return to sign in' },
      { href: '/signup', label: 'Create account' }
    ]
  },
  '/auth/callback': {
    heading: 'Completing sign in',
    paragraphs: ['OAuth authentication callback — you will be redirected to your dashboard shortly.']
  },
  '/signup/username': {
    heading: 'Choose your username',
    paragraphs: [
      'Pick a display name for your Odin500 account to access stock charts, market heatmaps, and trading signals.'
    ],
    links: [
      { href: '/signup', label: 'Back to signup' },
      { href: '/login', label: 'Sign in' }
    ]
  },
  '/signup/verify-email': {
    heading: 'Verify your email',
    paragraphs: [
      'Confirm your email address to activate your Odin500 account and access U.S. equity OHLC data and analytics.'
    ],
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/signup', label: 'Create account' }
    ]
  },
  '/signup/enter-code': {
    heading: 'Enter verification code',
    paragraphs: [
      'Enter the verification code sent to your email to complete Odin500 account registration.'
    ],
    links: [
      { href: '/signup/verify-email', label: 'Resend verification' },
      { href: '/login', label: 'Sign in' }
    ]
  }
};
