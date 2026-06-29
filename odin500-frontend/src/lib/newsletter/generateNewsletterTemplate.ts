import type { NewsletterWeek } from './newsletterWeek';
import type { NewsletterGenerationContext } from './fetchNewsletterContext';
import { formatReturnPct } from '@/seo/performanceSnippet';

export type NewsletterGeneratorSource = 'ai' | 'template';

export type GeneratedNewsletterContent = {
  title: string;
  description: string;
  tags: string[];
  body: string;
  generator?: NewsletterGeneratorSource;
};

function fmt(r: number | null) {
  return r == null ? 'mixed' : formatReturnPct(r);
}

function primaryReturn(row: { lastWeek: number | null; lastMonth: number | null; ytd: number | null }) {
  return row.lastWeek ?? row.lastMonth ?? row.ytd;
}

function monthTag(weekEnd: string) {
  const m = Number(weekEnd.slice(5, 7));
  const names = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december'
  ];
  return `${names[m - 1] || 'market'}-${weekEnd.slice(0, 4)}`;
}

/** Deterministic newsletter body when OpenAI is unavailable. */
export function generateNewsletterTemplate(
  week: NewsletterWeek,
  ctx: NewsletterGenerationContext
): GeneratedNewsletterContent {
  const spx = ctx.indices.find((r) => r.ticker === 'SPX');
  const ndx = ctx.indices.find((r) => r.ticker === 'NDX');
  const spy = ctx.indices.find((r) => r.ticker === 'SPY');
  const top = ctx.topSectors[0];
  const bottom = ctx.bottomSectors[0];
  const spxRet = primaryReturn(spx || ctx.indices[0]);
  const tone =
    spxRet != null && spxRet >= 0
      ? 'constructive'
      : spxRet != null && spxRet < 0
        ? 'cautious'
        : 'mixed';

  const signalLine = ctx.signals
    ? `Odin Signals on the S&P 500 screen showed **${ctx.signals.longL1 + ctx.signals.longL2}** bullish (L1/L2) vs **${ctx.signals.shortS1 + ctx.signals.shortS2}** bearish (S1/S2) states among **${ctx.signals.total}** names sampled.`
    : 'Screen live conviction levels on the [Odin Signals](/odin-signals) hub.';

  const title = `Odin500 Weekly: U.S. equities ${tone} — ${week.weekLabel.replace('Week of ', '')}`;
  const description = `${week.weekLabel} recap — S&P 500 and Nasdaq-100 performance, sector ETF rotation, and Odin signal context from Odin500 data (as of ${ctx.asOfDate}).`;

  const body = `This week's U.S. equity tape was **${tone}** as large-cap indices and sector ETFs moved on macro and earnings flow. Below is a concise recap for ${week.weekLabel}; live return tables are appended from Odin500 market data.

## Executive summary

- **S&P 500 (${spx?.ticker || 'SPX'})** — ${fmt(primaryReturn(spx || { lastWeek: null, lastMonth: null, ytd: null }))} over the primary window; **Nasdaq-100** ${fmt(primaryReturn(ndx || { lastWeek: null, lastMonth: null, ytd: null }))}.
- **ETF proxies** — **SPY** ${fmt(primaryReturn(spy || { lastWeek: null, lastMonth: null, ytd: null }))}, **QQQ** ${fmt(primaryReturn(ctx.indices.find((r) => r.ticker === 'QQQ') || { lastWeek: null, lastMonth: null, ytd: null }))}.
- **Sector leadership** — ${top ? `${top.label} (${fmt(primaryReturn(top))})` : 'See heatmap'} led; ${bottom ? `${bottom.label} (${fmt(primaryReturn(bottom))})` : 'laggards mixed'} lagged on a relative basis.
- **Signals** — ${signalLine}

## Index & sector focus

Review index rails on the [market dashboard](/market) and [heatmap](/heatmap) for breadth. Compare horizons on the [return table](/return-table).

| Focus | Odin500 page |
| --- | --- |
| S&P 500 | [SP500 hub](/indices/sp500) |
| Nasdaq-100 | [Nasdaq-100 hub](/indices/nasdaq-100) |
| Signals | [Odin Signals screener](/odin-signals) |

## What to watch next week

- Whether index ETFs confirm sector rotation or revert to mega-cap concentration
- Signal upgrades/downgrades on [Odin Signals](/odin-signals)
- Earnings-related volatility in [market movers](/market-movers)

## Explore Odin500

- [Market dashboard](/market) · [Heatmap](/heatmap) · [Ticker report example](/ticker-report/aapl) · [Paper trading](/paper-trading)

---

*Not investment advice. Data from Odin500 daily OHLC and signal models.*`;

  return {
    title,
    description,
    tags: ['market-recap', monthTag(week.weekEnd), 'sp500', 'odin-signals'],
    body,
    generator: 'template'
  };
}
