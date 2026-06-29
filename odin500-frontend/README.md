# Trading Frontend (Next.js)

React + Next.js 15 App Router port of the Odin500 trading dashboard.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production

```bash
npm run build
npm start
```

## Environment variables

Create `odin500-frontend/.env`:

| Variable | Purpose |
|----------|---------|
| `API_ORIGIN` | Backend API base URL (server-side) |
| `NEXT_PUBLIC_API_ORIGIN` | Backend API base URL (client fallback) |
| `AUTH_DISABLED` / `NEXT_PUBLIC_AUTH_DISABLED` | Bypass login middleware (`true` for local dev / crawlers) |
| `FINNHUB_TOKEN` / `NEXT_PUBLIC_FINNHUB_TOKEN` | Finnhub news API |
| `COMPANY_PROFILE_DATA_KEY` | Alpha Vantage company profile key |

## Architecture

- **App Router** — `src/app/` with `(auth)` and `(protected)` route groups
- **Views** — `src/views/` (screen components; renamed from `pages/` to avoid Next.js Pages Router conflict)
- **Auth** — httpOnly cookies via `/api/auth/*` + `middleware.ts`
- **API** — Client calls `/api/proxy/*` BFF; public routes rewrite to `API_ORIGIN`
- **SEO** — `generateMetadata` via `src/seo/metadata.ts`, `app/sitemap.ts`, `app/robots.ts`

## Google sign-in (Supabase OAuth)

- **Supabase → Redirect URLs:** `http://localhost:3000/auth/callback` and production `https://<domain>/auth/callback`
- **Google OAuth client:** redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`

## Legacy URL redirects

Configured in `next.config.ts` (e.g. `/tickers` → `/odin-signals`, `/ticker-annual/:symbol` → `/statistic/ticker-annual/:symbol`).
