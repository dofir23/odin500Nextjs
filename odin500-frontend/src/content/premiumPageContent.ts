export type PricingFeature = {
  text: string;
  included: boolean;
};

export type PricingPlan = {
  id: 'free' | 'pro';
  name: string;
  price: number;
  description: string;
  cta: string;
  ctaHref: string;
  highlighted: boolean;
  badge?: string;
  features: PricingFeature[];
};

export const PRICING_HERO = {
  eyebrow: 'Trade smarter',
  title: 'Simple pricing',
  subtitle:
    'Start free with core market data, or unlock the full Odin500 platform for $10/month — every signal, index, ETF, and analytics tool in one place.'
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Explore U.S. equities with dashboards and basic signal coverage.',
    cta: 'Start free',
    ctaHref: '/signup',
    highlighted: false,
    features: [
      { text: 'Market dashboard & sector heatmaps', included: true },
      { text: 'Market movers screener', included: true },
      { text: 'Basic ticker signals', included: true },
      { text: 'Ticker pages & OHLC charts', included: true },
      { text: 'Market news hub', included: true },
      { text: 'Virtual portfolio (limited)', included: true },
      { text: 'Dow Jones index signals', included: false },
      { text: 'Nasdaq-100 index signals', included: false },
      { text: 'S&P 500 index signals', included: false },
      { text: 'Selected ETF signals', included: false },
      { text: 'Full Odin trading signals', included: false },
      { text: 'Historical OHLC bulk downloads', included: false },
      { text: 'Return tables & statistic data', included: false },
      { text: 'Ticker research reports', included: false },
      { text: 'Relative performance analytics', included: false }
    ]
  },
  {
    id: 'pro',
    name: 'Odin500 Pro',
    price: 10,
    description: 'Full platform access — every signal, dataset, and analytics workflow.',
    cta: 'Get full access',
    ctaHref: '/signup',
    highlighted: true,
    badge: 'All features',
    features: [
      { text: 'Market dashboard & sector heatmaps', included: true },
      { text: 'Market movers screener', included: true },
      { text: 'Basic ticker signals', included: true },
      { text: 'Ticker pages & OHLC charts', included: true },
      { text: 'Market news hub', included: true },
      { text: 'Virtual portfolio simulator', included: true },
      { text: 'Dow Jones index signals', included: true },
      { text: 'Nasdaq-100 index signals', included: true },
      { text: 'S&P 500 index signals', included: true },
      { text: 'Selected ETF signals (SPY, QQQ, sectors & more)', included: true },
      { text: 'Full Odin trading signals (L1–L3 / S1–S3)', included: true },
      { text: 'Historical OHLC bulk downloads', included: true },
      { text: 'Return tables & statistic data', included: true },
      { text: 'Ticker research reports', included: true },
      { text: 'Relative performance analytics', included: true },
      { text: 'Index & sector hub pages', included: true },
      { text: 'Stock split calendar', included: true },
      { text: 'Multi-timeframe return analytics', included: true },
      { text: 'Priority access to new data releases', included: true }
    ]
  }
];

export const PRICING_WHY_FEATURES = [
  'Daily actionable signals across major U.S. indices and ETFs',
  'Systematic, data-driven signal methodology',
  'Designed to complement buy-and-hold and active strategies',
  'Long and short signals for different market conditions',
  'Coverage across S&P 500, Nasdaq-100, Dow Jones, and key ETFs',
  'Integrated dashboards, analytics, and research in one platform'
] as const;
