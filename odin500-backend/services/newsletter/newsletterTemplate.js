const { formatReturnPct, primaryReturn } = require('./newsletterContext');

function monthTag(weekEnd) {
  const m = Number(String(weekEnd).slice(5, 7));
  const names = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  return `${names[m - 1] || 'market'}-${String(weekEnd).slice(0, 4)}`;
}

function generateNewsletterTemplate(week, ctx) {
  const spx = ctx.indices.find((r) => r.ticker === 'SPX');
  const ndx = ctx.indices.find((r) => r.ticker === 'NDX');
  const spy = ctx.indices.find((r) => r.ticker === 'SPY');
  const top = ctx.topSectors[0];
  const bottom = ctx.bottomSectors[0];
  const spxRet = primaryReturn(spx || ctx.indices[0]);
  const tone = spxRet != null && spxRet >= 0 ? 'constructive' : spxRet != null && spxRet < 0 ? 'cautious' : 'mixed';

  const signalLine = ctx.signals
    ? `Odin Signals on the S&P 500 screen showed **${ctx.signals.longL1 + ctx.signals.longL2}** bullish (L1/L2) vs **${ctx.signals.shortS1 + ctx.signals.shortS2}** bearish (S1/S2) among **${ctx.signals.total}** names.`
    : 'Screen live conviction on [Odin Signals](/odin-signals).';

  const fmt = (r) => (r == null ? 'mixed' : formatReturnPct(r));
  const empty = { lastWeek: null, lastMonth: null, ytd: null };

  const title = `Odin500 Weekly: U.S. equities ${tone} — ${week.weekLabel.replace('Week of ', '')}`;
  const description = `${week.weekLabel} recap — index, sector, and Odin signal context from Odin500 data (as of ${ctx.asOfDate}).`;

  const body = `This week's U.S. equity tape was **${tone}**. Recap for ${week.weekLabel}; live return tables appear on the published issue page.

## Executive summary

- **S&P 500** — ${fmt(primaryReturn(spx || empty))}; **Nasdaq-100** ${fmt(primaryReturn(ndx || empty))}
- **ETF proxies** — **SPY** ${fmt(primaryReturn(spy || empty))}, **QQQ** ${fmt(primaryReturn(ctx.indices.find((r) => r.ticker === 'QQQ') || empty))}
- **Sector leadership** — ${top ? `${top.label} (${fmt(primaryReturn(top))})` : 'See heatmap'} led; ${bottom ? `${bottom.label} (${fmt(primaryReturn(bottom))})` : 'laggards mixed'} lagged
- **Signals** — ${signalLine}

## Sector & breadth read

Review rotation on the [heatmap](/heatmap) and [return table](/return-table). Compare index rails on [market](/market).

## Signals & setups

Track conviction on [Odin Signals](/odin-signals) and [S&P 500 hub](/indices/sp500).

## What to watch next week

- Whether sector leadership persists or reverts to mega-cap concentration
- Signal upgrades on [Odin Signals](/odin-signals)
- Earnings volatility in [market movers](/market-movers)

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

const OPENAI_SYSTEM_PROMPT = `You write Odin500 Weekly — an insightful U.S. stock market newsletter in Markdown for investors and researchers.
Output ONLY valid JSON (no markdown fences) with keys: title, description, tags (string array), body.
body must be Markdown only (no YAML frontmatter) and include:
- 1 substantive intro paragraph (what moved markets this week and why it matters)
- ## Executive summary (5-7 bullets with **bold** labels; cite specific % moves and signal counts from the data)
- ## Sector & breadth read (interpret rotation: what led, what lagged, and what it implies)
- ## Signals & setups (how Odin signal counts tilt bullish/bearish; link to /odin-signals)
- ## What to watch next week (3 concrete bullets)
- internal links using relative paths: /market, /odin-signals, /heatmap, /return-table, /indices/sp500, /market-movers
- closing disclaimer: *Not investment advice. Data from Odin500 daily OHLC and signal models.*
Tone: clear, specific, data-driven. Do not invent numbers — use only provided data. Prefer weekly (1W) figures when present.`;

module.exports = { generateNewsletterTemplate, OPENAI_SYSTEM_PROMPT };
