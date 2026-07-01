# Odin500 Social Media Promotion & Automated Posts Plan

A practical roadmap to grow traffic for [Odin500](https://odin500.com) through frequent, data-driven social posts — charts, short copy, and deep links back to the product.

---

## 1. Goals

| Goal | Target (90 days) | How we measure |
|------|------------------|----------------|
| **Traffic** | +30–50% sessions from social referrers | GA4 / Plausible: `utm_source` |
| **Signups** | 5–10% of social clicks → registration | `utm_campaign` on `/signup` |
| **Newsletter** | 2–5% of engaged followers subscribe | `/newsletter` conversions |
| **Brand** | Consistent “market intelligence” positioning | Saves, shares, reposts |
| **SEO support** | Social amplifies indexable URLs | Clicks to `/ticker/*`, `/indices/*`, `/newsletter/*` |

**North-star message:** *Odin500 is a modern U.S. equity research platform — dashboards, Odin Signals, paper trading, and weekly recaps in one place.*

---

## 2. Audience & Channels

### Primary audience
- Active / swing traders researching U.S. stocks & ETFs  
- Retail investors comparing sectors and indices  
- Quant-curious users who like signals, heatmaps, and charts  
- Paper-trading learners testing strategies without risk  

### Channel priority

| Channel | Priority | Why | Post frequency |
|---------|----------|-----|----------------|
| **X (Twitter)** | P0 | Finance-native; charts perform well | 2–4/day |
| **LinkedIn** | P1 | Credibility, B2C investors & researchers | 1/day |
| **Instagram** | P1 | Carousel charts, Reels hooks | 1/day + 3 Stories/week |
| **Threads** | P2 | Cross-post from X with light edits | 1–2/day |
| **Reddit** | P2 | Value posts only (no spam); r/stocks, r/investing, r/algotrading | 2–3/week |
| **YouTube Shorts / TikTok** | P3 | Optional later; screen recordings of dashboard | 2/week |

**Start with X + LinkedIn.** Add Instagram once chart export pipeline is stable.

---

## 3. Content Pillars (map to product)

Every post should tie to a **live URL** on Odin500.

| Pillar | Product surface | Example hook |
|--------|-----------------|--------------|
| **Market pulse** | `/market`, sector heatmaps | “S&P sectors today — tech vs energy” |
| **Odin Signals** | `/odin-signals`, `/ticker/{sym}` | “New L2 signal on $AAPL — context inside” |
| **Ticker spotlight** | `/ticker/{sym}`, reports | “$NVDA: 1Y return vs QQQ in one chart” |
| **Index & ETF** | `/indices/sp500`, `/sector-data/*` | “Nasdaq-100 breadth this week” |
| **Movers & screeners** | `/market-movers` | “Top gainers / losers — Odin500 screener” |
| **Paper trading** | `/paper-trading`, public portfolios | “Test this strategy with $100k virtual cash” |
| **Weekly newsletter** | `/newsletter`, `/newsletter/{slug}` | “Sunday recap: indices, signals, setups” |
| **Education** | Blog-style tips | “How we calculate Odin Signals (L1–L3)” |
| **Product / Pro** | `/premium`, `/signup` | “Free tier vs Pro — full platform for $10/mo” |

**Rule:** 70% value (data/chart/insight), 20% product discovery, 10% direct CTA.

---

## 4. Post Formats (charts + short text)

### Format A — Single chart + caption (X, LinkedIn)
- **Visual:** 1200×675 (X) or 1200×1200 (LinkedIn) PNG  
- **Copy:** 1 hook line + 2 bullets + link + 2–3 hashtags  
- **Chart sources:** Market dashboard, ticker OHLC, sector heatmap, signal marker chart  

**Template:**
```
[Hook — one line, e.g. "Tech led the S&P today."]

• [Data point 1 from Odin500]
• [Data point 2]

Full chart + signals → odin500.com/ticker/xxx?utm_source=twitter&utm_medium=social&utm_campaign=daily_pulse

#stocks #trading #marketdata
```

### Format B — Carousel (Instagram, LinkedIn PDF)
- 4–6 slides: title → chart → 2 insights → CTA  
- Slide 1: Bold headline + Odin500 logo  
- Slides 2–4: Charts (sector rotation, index performance, top signal)  
- Last slide: “Free at odin500.com” + QR optional  

### Format C — Thread (X)
- Tweet 1: Hook + chart  
- Tweets 2–4: Bullet insights from newsletter or ticker report  
- Final tweet: Link to full article `/newsletter/{slug}` or `/ticker-report/{sym}`  

### Format D — “Signal alert” (high frequency)
- Mini chart with signal marker (last 90 days)  
- Text: symbol, signal type, date, link to ticker page  
- Post when new signals fire (automated; see §6)  

### Format E — Weekly recap (Sunday / Monday)
- Reuse newsletter content + 1 hero chart (indices normalized performance)  
- CTA: “Read the full weekly recap” → `/newsletter/{slug}`  

### Format F — Paper trading / social proof
- Screenshot or chart of public portfolio performance (with permission / aggregate)  
- CTA: `/paper-trading/public`  

---

## 5. Posting Cadence (recommended)

### Daily rhythm (X as anchor)

| Time (ET) | Post type | Pillar |
|-----------|-----------|--------|
| **Pre-market** 7:30 | Futures / overnight context or prior close recap | Market pulse |
| **Open** 9:45 | Sector heatmap or movers | Market pulse |
| **Midday** 12:30 | Ticker spotlight (rotating watchlist) | Ticker |
| **Close** 4:15 | Index performance chart (SPY, QQQ, DIA) | Index & ETF |
| **Evening** 7:00 | Signal alert or education snippet | Signals / Education |

### Weekly rhythm

| Day | Focus |
|-----|--------|
| **Mon** | Week ahead + index weekly returns |
| **Tue** | Odin Signals roundup (top 3 symbols) |
| **Wed** | Sector deep-dive (`/sector-data/...`) |
| **Thu** | Paper trading tip or public portfolio |
| **Fri** | Week in review chart |
| **Sat** | Evergreen: “How to use Odin500” carousel |
| **Sun** | Newsletter promo + link to latest issue |

### Monthly
- 1× Pro feature highlight (`/premium`)  
- 1× “What we shipped” product update  
- 1× User question / poll → drive replies  

---

## 6. Automation Architecture

Goal: **generate post assets from Odin500 data**, queue for review (or auto-publish), track UTM links.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Odin500 Backend │────▶│ Post Generator   │────▶│ Asset Store     │
│ (API / BQ)      │     │ (script / worker)│     │ (S3 / GCS)      │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ Copy + metadata  │     │ Chart renderer  │
                        │ (JSON per post)  │     │ (Puppeteer/     │
                        └────────┬─────────┘     │  Playwright)    │
                                 │               └─────────────────┘
                                 ▼
                        ┌──────────────────┐
                        │ Scheduler        │
                        │ (cron / GitHub   │
                        │  Actions / n8n)  │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
         Buffer /           X API v2          LinkedIn API
         Later              (or Typefully)     (optional)
```

### Phase 1 — Manual-assisted (weeks 1–2)
- Export charts from existing UI (market page, ticker charts — reuse `ChartSnapshotExportModal` pattern).  
- Store copy templates in a spreadsheet or Notion.  
- Schedule via **Buffer**, **Typefully**, or **Hootsuite**.  

### Phase 2 — Semi-automated (weeks 3–6)
Build `odin500-social` worker (Node or Python) in the monorepo or separate repo:

1. **Data pulls** (authenticated or internal):
   - `GET /api/tickers/groups` — universe for rotation  
   - `GET /api/market/...` — heatmap, movers  
   - `GET /api/ticker/{sym}/...` — OHLC + signals for chart  
   - Newsletter summaries from existing BigQuery / `listNewsletterSummaries`  

2. **Chart generation:**
   - Headless browser: open internal “social chart” route (e.g. `/internal/social-chart?ticker=AAPL&range=3m`)  
   - Or server-side: **QuickChart**, **matplotlib**, or **vega-lite** JSON → PNG  
   - Brand kit: dark theme default, logo watermark, font Inter/Arial  

3. **Copy generation:**
   - **Template-first** (deterministic): fill slots from API JSON  
   - **LLM optional** (OpenAI): rewrite hook line only; never invent prices — numbers must come from API  
   - Output: `{ platform, text, imagePath, link, utm, scheduledAt }`  

4. **Review queue:**
   - Slack / Discord webhook with preview image + “Approve / Skip”  
   - Or write to `social_posts` table: `draft | approved | published | failed`  

### Phase 3 — Fully automated (weeks 7–12)
- Cron jobs aligned to market calendar (skip holidays).  
- X API posting for signal alerts + close recap.  
- Auto-thread from weekly newsletter markdown → thread splitter.  
- Rate limits + dedup: max 1 post per symbol per 24h unless major signal.  

### Suggested repo layout (future)
```
odin500-social/
  jobs/
    daily-pulse.js
    signal-alerts.js
    weekly-newsletter-promo.js
    ticker-spotlight.js
  templates/
    x-single-chart.hbs
    linkedin-carousel.json
  render/
    chartScreenshot.js
  publish/
    buffer.js
    twitter.js
  config/
    hashtags.json
    utm.json
```

---

## 7. Chart & Image Specs

| Platform | Size | Format | Notes |
|----------|------|--------|-------|
| X | 1200×675 | PNG | Text safe zone: center 80% |
| LinkedIn | 1200×627 or 1080×1080 | PNG | Less text on image |
| Instagram feed | 1080×1080 | PNG | Carousel 1080×1350 optional |
| Instagram Story | 1080×1920 | PNG | Link sticker to URL |
| Open Graph | 1200×630 | PNG | Reuse for link previews |

**Brand elements on every chart:**
- Odin500 wordmark (corner)  
- Subtle “odin500.com” URL  
- Date / “As of [date] ET” on data posts  
- Disclaimer line on signal posts: *“Not financial advice. For research only.”*  

---

## 8. UTM & Landing Pages

Standardize tracking:

```
?utm_source={twitter|linkedin|instagram}
 &utm_medium=social
 &utm_campaign={daily_pulse|signal_alert|newsletter|ticker_spotlight}
 &utm_content={YYYYMMDD}_{symbol}_{post_type}
```

**Default landing pages by campaign:**
| Campaign | URL |
|----------|-----|
| daily_pulse | `/market` |
| signal_alert | `/ticker/{sym}` |
| newsletter | `/newsletter/{slug}` |
| ticker_spotlight | `/ticker/{sym}` |
| paper_trading | `/paper-trading` |
| pro_cta | `/premium` |
| signup | `/signup` |

---

## 9. Compliance & Risk (required)

Financial social content must stay on the right side of marketing rules:

1. **Disclaimer** on every signal / performance post:  
   *“For informational and educational purposes only. Not investment advice.”*  
2. **No guaranteed returns** language.  
3. **Paper trading** labeled as simulated, not live results.  
4. **Charts** show source date; avoid misleading cropped axes.  
5. **Reddit:** follow subreddit rules; no drive-by link dumps.  
6. Keep a **human approval step** for automated signal posts until copy QA is proven (30 days).  

---

## 10. Content Calendar — First 30 Days (starter)

| Week | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 1 | Market dashboard tour | $AAPL signal chart | Sector heatmap | Paper trading intro | SPY week chart | Carousel: 5 features | Newsletter #1 promo |
| 2 | Nasdaq movers | $MSFT spotlight | Energy sector | Public portfolio | QQQ vs SPY | How to read Odin Signals | Newsletter |
| 3 | Pre-market routine | $NVDA chart | Financials sector | Strategy rules demo | Index recap | Sign up free CTA | Newsletter |
| 4 | Month recap chart | Top 3 signals week | ETF spotlight (SPY) | Pro features ($10) | User poll | Evergreen thread | Newsletter |

Rotate symbols from a fixed **watchlist of 20 liquid names** (AAPL, MSFT, NVDA, AMZN, META, GOOGL, TSLA, JPM, XOM, etc.) plus index ETFs (SPY, QQQ, DIA, IWM).

---

## 11. Tools Stack (recommended)

| Function | Tool options |
|----------|----------------|
| Scheduling | Buffer, Typefully, Hootsuite |
| Design (manual) | Figma templates matching dark UI |
| Chart automation | Playwright + internal chart URL; or QuickChart |
| Copy AI (optional) | OpenAI API with strict JSON schema + fact guardrails |
| Orchestration | GitHub Actions cron, Railway worker, or n8n |
| Analytics | GA4 + UTM; Bitly for short links optional |
| Asset storage | S3, Cloudflare R2, or `odin500-social/assets/` |
| Approval | Slack webhook, Linear, or simple admin UI later |

---

## 12. KPIs & Review Cadence

**Weekly review (15 min):**
- Top 5 posts by clicks (UTM)  
- Signups attributed to social  
- Follower growth vs prior week  
- Which pillar / format won  

**Monthly review:**
- Double down on top 2 formats  
- Pause low-performing pillars  
- Refresh hashtag set  
- A/B test CTA: `/signup` vs deep link to ticker  

---

## 13. Implementation Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| **0 — Foundation** | Week 1 | Brand templates, UTM scheme, Buffer accounts, disclaimer copy |
| **1 — Manual cadence** | Weeks 2–3 | 2 posts/day on X; 1/week LinkedIn; measure baselines |
| **2 — Chart export** | Weeks 4–6 | Automated PNG from 3 chart types (ticker, heatmap, index) |
| **3 — Post generator** | Weeks 7–9 | JSON post queue + Slack approval |
| **4 — Signal automation** | Weeks 10–12 | Signal alert job + dedup + publish to X |
| **5 — Scale** | Month 4+ | Instagram carousels, newsletter thread bot, optional paid boost |

---

## 14. Example Automated Post Spec (JSON)

```json
{
  "id": "2026-04-01-aapl-signal-l2",
  "platforms": ["twitter", "linkedin"],
  "scheduledAt": "2026-04-01T16:15:00-04:00",
  "pillar": "odin_signals",
  "data": {
    "symbol": "AAPL",
    "signalType": "L2",
    "signalDate": "2026-04-01",
    "close": 198.42,
    "return90d": 12.4
  },
  "chart": {
    "template": "ticker-signals-90d",
    "outputPath": "assets/2026/04/01-aapl-signals.png"
  },
  "copy": {
    "twitter": "New Odin L2 signal on $AAPL — 90-day context in the chart.\n\nNot financial advice. Research only.\n\n→ odin500.com/ticker/aapl?utm_source=twitter&utm_medium=social&utm_campaign=signal_alert&utm_content=20260401_aapl_l2\n\n#AAPL #stocks #trading",
    "linkedin": "Odin500 flagged an L2 signal on Apple (AAPL) at today's close.\n\nSee the full OHLC chart, signal history, and return analytics on Odin500 (free tier available).\n\nLink in comments. Not investment advice."
  },
  "link": "https://odin500.com/ticker/aapl",
  "status": "draft"
}
```

---

## 15. Success Criteria (6 months)

- [ ] 500+ organic clicks/month from social (UTM-attributed)  
- [ ] 50+ signups/month from social campaigns  
- [ ] 3+ posts/day on X with &lt;20% manual effort per post  
- [ ] Weekly newsletter issue promoted on 3+ channels every Sunday  
- [ ] Documented playbook: any team member can approve a day’s queue in &lt;10 minutes  

---

## 16. Next Steps (immediate)

1. Create **Figma / PNG templates** (single chart, carousel, story).  
2. Set up **X + LinkedIn** business profiles with consistent bio linking to `/market` and `/newsletter`.  
3. Configure **UTM parameters** in GA4 custom reports.  
4. Pick **20 tickers + 3 indices** for the first automation rotation.  
5. Spike **one chart screenshot job** from `/ticker/aapl` for pipeline proof.  
6. Run **manual posting for 2 weeks** before enabling auto-publish.  

---

*Document owner: Growth / Product*  
*Last updated: April 2026*  
*Related: [SEO.md](./SEO.md), weekly newsletter at `/newsletter`*
