# Odin500 weekly newsletter

Markdown issues in this folder power `/newsletter` and SEO. Most issues are **auto-generated every Sunday**; you can still add or edit files manually.

## Automatic generation

Every **Sunday 12:00 UTC**, GitHub Actions runs [`/.github/workflows/weekly-newsletter.yml`](../../.github/workflows/weekly-newsletter.yml) to create the recap for the **completed Mon–Sun week** (published on that Sunday).

### Local / manual commands

```bash
cd odin500-frontend
npm run newsletter:generate                    # last completed week
npm run newsletter:generate -- --week 2026-06-28   # specific Sunday
npm run newsletter:generate -- --week 2026-06-28 --force  # overwrite with AI/template
npm run newsletter:generate -- --backfill        # fill gaps since newest issue
```

**Note:** `npm run newsletter:generate` loads `odin500-frontend/.env` itself. Next.js env vars do **not** apply to this CLI — you must regenerate after adding `OPENAI_API_KEY`. Check frontmatter `generator: ai` vs `generator: template`.

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Recommended | AI-written editorial (template fallback if missing) |
| `OPENAI_NEWSLETTER_MODEL` | Optional | Default `gpt-4o-mini` |
| `OPENAI_API_TIMEOUT_MS` | Optional | Default `60000` |
| `API_ORIGIN` | Yes | Odin500 API for market context |

Set `OPENAI_API_KEY` in `.env` locally and in GitHub Actions **secrets**. Set `API_ORIGIN` in GitHub **variables** for CI.

### Slug convention (auto-generated)

| Field | Rule |
|-------|------|
| `publishedAt` | Sunday ending the week (`YYYY-MM-DD`) |
| `weekLabel` | `Week of June 22–28, 2026` (Mon–Sun) |
| Filename | `{publishedAt}-weekly-market-recap.md` |

Live index/sector **tables** are appended at render time from the API ([`newsletterEnrich.server.ts`](../../lib/newsletterEnrich.server.ts)) — generated `.md` files contain editorial copy only.

## Manual issues

Filename: `YYYY-MM-DD-short-topic.md` → `/newsletter/{slug}`

### Frontmatter (required)

```yaml
---
title: "Odin500 Weekly: S&P 500 recap & signal highlights"
description: "Weekly U.S. equity recap with index performance, sector rotation, and Odin signal spotlights."
publishedAt: "2026-04-14"
weekLabel: "Week of April 14, 2026"
tags:
  - market-recap
  - sp500
  - signals
author: Odin500
---
```

### Body

Write in Markdown. Link to product pages for SEO:

- `/market` — dashboard
- `/heatmap` — sector heatmap
- `/odin-signals` — signal screener
- `/ticker-report/aapl` — monthly ticker reports
- `/indices/sp500` — index pages

After adding a file, rebuild or wait for ISR — the issue appears on `/newsletter` and in `sitemap.xml`.

## Generator source files

- [`src/lib/newsletter/newsletterWeek.ts`](../../lib/newsletter/newsletterWeek.ts) — week calendar
- [`src/lib/newsletter/fetchNewsletterContext.ts`](../../lib/newsletter/fetchNewsletterContext.ts) — API snapshot for AI
- [`src/lib/newsletter/generateNewsletterAi.ts`](../../lib/newsletter/generateNewsletterAi.ts) — OpenAI + fallback
- [`scripts/generate-weekly-newsletter.ts`](../../scripts/generate-weekly-newsletter.ts) — CLI entry
