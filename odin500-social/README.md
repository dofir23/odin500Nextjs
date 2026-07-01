# odin500-social

Standalone social post generator for Odin500. Runs as its own Node service on Railway (separate from `odin500-frontend` and `odin500-backend`).

Fetches market data and newsletter metadata from the Odin500 API, renders branded chart images, writes post drafts to disk, and optionally notifies Slack/Discord for manual approval before publishing.

## What it does

| Job | Schedule (ET) | Output |
|-----|---------------|--------|
| `daily-pulse` | Mon–Fri 4:20pm | Index recap + SPY chart |
| `ticker-spotlight` | Tue/Thu 12:30pm | Rotating ticker chart + copy |
| `weekly-newsletter` | Sun 10:00am | Latest newsletter promo |

## Quick start (local)

```bash
cd odin500-social
cp .env.example .env
# Edit ODIN_API_ORIGIN (and optional ODIN_API_TOKEN)
npm install
npm start
```

Health check: `GET http://localhost:8080/health`

Run a job manually:

```bash
npm run job:daily
npm run job:ticker
npm run job:newsletter
# Or with symbol override:
node scripts/run-job.js ticker-spotlight AAPL
```

Drafts are saved under `output/posts/*.json` and chart PNGs under `output/assets/`.

## API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/health` | — |
| `GET` | `/posts?limit=20&status=draft` | — |
| `GET` | `/posts/:id` | — |
| `GET` | `/assets/:filename` | — |
| `POST` | `/jobs/:name` | Header `x-social-secret` |

Trigger example:

```bash
curl -X POST http://localhost:8080/jobs/daily-pulse \
  -H "x-social-secret: YOUR_SECRET"
```

## Railway deploy

1. Create a **new Railway service** and point it at this folder (`odin500-social/`), not the monorepo root.
2. Set root directory to `odin500-social` if deploying from the monorepo.
3. Add environment variables from `.env.example`.
4. Railway uses `railway.toml` — start command `npm start`, health check `/health`.

### Required env vars

- `ODIN_API_ORIGIN` — backend URL (e.g. `https://odin500-1-production.up.railway.app`)
- `ODIN_SITE_ORIGIN` — public site for UTM links (e.g. `https://odin500.com`)
- `SOCIAL_INTERNAL_SECRET` — protects `POST /jobs/*`

### Optional

- `ODIN_API_TOKEN` — Bearer JWT for `/api/market/ticker-returns` (richer daily pulse bullets)
- `SOCIAL_WEBHOOK_URL` — Slack or Discord webhook for draft previews
- `CRON_ENABLED=false` — disable scheduled jobs (manual triggers only)
- `TZ=America/New_York` — cron timezone

### Persistence note

Post drafts and PNGs are written to `output/` on the container filesystem. On Railway, use a **volume** mounted at `/app/output` (or set `OUTPUT_DIR` if you extend config) so drafts survive redeploys. Otherwise treat this service as a generator + webhook notifier and copy posts from Slack.

## Config files

- `config/utm.json` — campaign → landing paths
- `config/hashtags.json` — default tags per post type
- `config/watchlist.json` — indices for daily pulse, rotation list for spotlight

## Publishing

This service does **not** auto-post to X/LinkedIn yet. It produces drafts and sends a webhook preview. Wire Buffer, Typefully, or native APIs in `src/publish/` when ready.
