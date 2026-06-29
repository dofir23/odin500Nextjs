# Odin500 frontend SEO

## Stack

- **Next.js 15 App Router** — server `metadata` / `generateMetadata` per route
- **Open Graph + Twitter** — default `og-default.png` + dynamic `opengraph-image.tsx` (ticker, historical, indices, sectors)
- **SSR page shell** — `ServerPageContent` (tables + SVG charts in initial HTML)
- **Progressive enhancement** — SSR shell visible until hydrate, then hidden via `HydrationMarker`
- **JSON-LD** — Organization, WebSite, WebPage, BreadcrumbList, FinancialProduct
- **Internal links** — `SeoInternalLinks` on ticker, index, sector, and market hub routes
- **Sitemap / robots** — chunked dynamic sitemap, robots.txt
- **Google Analytics** — GA4 via `src/seo/GoogleAnalytics.tsx`

## SSR architecture

```
page.tsx (server) → fetchPageData → PageServerShell
  ├── JSON-LD
  ├── SeoCrawlerSummary (sr-only)
  ├── ServerPageContent (tables + SVG charts)  ← in first HTML
  ├── SeoInternalLinks
  └── Client view (charts hydrate on top)
```

After JS loads, `html[data-app-hydrated="true"]` hides `.ssr-page-shell` and `.ssr-internal-links`.

Canvas charts (Lightweight Charts, Chart.js, heatmap treemap) still require JavaScript.

## Titles

Page titles are **keyword-first** (how users search on Google): ticker symbols, “stock price”, “historical OHLC”, “returns”, “heatmap”, etc. Brand name appears in `og:site_name` only, not in titles.

Enriched metadata (live returns, company names) is generated in `src/seo/routeMetadataHelpers.ts` for ticker, index, sector, statistic, and historical routes.

```bash
npm run gen:routes      # Regenerate route shells
npm run gen:og-image    # Regenerate public/og-default.png
npm run build
npx tsc --noEmit
```

## Env

| Variable | Purpose |
|----------|---------|
| `API_ORIGIN` / `NEXT_PUBLIC_API_ORIGIN` | Full sitemap ticker list + SSR data |
| `SSR_API_ORIGIN` | Optional server-only API override |
| `SITEMAP_TICKERS` / `SITEMAP_USE_API` | Sitemap overrides |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 (default `G-08S7EJ6FTT`) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console HTML tag verification |
| `OPENAI_API_KEY` | Weekly newsletter AI generation (GitHub Actions secret) |
| `OPENAI_NEWSLETTER_MODEL` | Optional OpenAI model (default `gpt-4o-mini`) |
| `API_ORIGIN` | Newsletter generator market context (CI variable) |

## Newsletter automation

Weekly issues are generated as markdown in `src/content/newsletter/`:

- **Schedule:** GitHub Actions `weekly-newsletter.yml` — Sundays 12:00 UTC
- **CLI:** `npm run newsletter:generate` (see `src/content/newsletter/README.md`)
- **Editorial:** OpenAI with template fallback; live return tables appended at SSR via `newsletterEnrich.server.ts`
- **Latest issue:** Sorted by `publishedAt` in `newsletter.server.ts`


- **Blocked from crawlers:** `/login`, `/signup`, `/auth/callback` (`noindex` + robots disallow)
- **All other routes:** `index, follow` — including about, accounts, paper-trading, forgot-password
- `/` → redirects to `/market` (canonical `/market`)

## Search Console (manual)

1. Add property `https://www.odin500.com`
2. Verify with `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` or DNS
3. Submit sitemap: `https://www.odin500.com/sitemap.xml`
