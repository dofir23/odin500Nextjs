/** Crawler-visible copy for routes without API-backed SSR tables. */

export type StaticPageSeoBlock = {
  heading: string;
  paragraphs: string[];
  links?: Array<{ href: string; label: string }>;
};

export const STATIC_PAGE_SEO: Record<string, StaticPageSeoBlock> = {
  '/': {
    heading: 'Odin500 — U.S. stock market data and analytics platform',
    paragraphs: [
      'Odin500 provides U.S. equity market dashboards, sector heatmaps, OHLC historical prices, index and ETF return analytics, Odin trading signals, market news, statistic tables, stock split calendars, ticker research reports, premium data plans, and a paper-trading simulator.',
      'Sign up free to access charts and basic signals, or explore the market dashboard, indices, sectors, and ticker pages without an account on many public routes.'
    ],
    links: [
      { href: '/market', label: 'Market dashboard' },
      { href: '/odin-signals', label: 'Odin Signals' },
      { href: '/signup', label: 'Create free account' },
      { href: '/premium', label: 'Premium plans' }
    ]
  },
  '/about': {
    heading: 'Account profile and settings',
    paragraphs: [
      'Manage your Odin500 account profile, display name, contact details, avatar, email preferences, and security settings.',
      'Update subscription plan details and sign out from linked devices from this page.'
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
      { href: '/about', label: 'Profile settings' },
      { href: '/paper-trading', label: 'Paper trading' },
      { href: '/market', label: 'Market dashboard' }
    ]
  },
  '/paper-trading': {
    heading: 'Your paper portfolio',
    paragraphs: [
      'Practice U.S. stock trading with simulated portfolios, paper orders, and performance analytics without risking real capital.',
      'Publish a portfolio to share read-only holdings and performance on the public gallery.'
    ],
    links: [
      { href: '/paper-trading/public', label: 'Public portfolios' },
      { href: '/market', label: 'Live market dashboard' },
      { href: '/odin-signals', label: 'Trading signals screener' }
    ]
  },
  '/paper-trading/public': {
    heading: 'Public paper portfolios',
    paragraphs: [
      'Browse paper portfolios published by Odin500 users. View holdings, equity curves, closed trades, and sector allocation in read-only mode.',
      'Publish your own portfolio from Your Portfolio when you are ready to share.'
    ],
    links: [
      { href: '/paper-trading', label: 'Your portfolio' },
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
