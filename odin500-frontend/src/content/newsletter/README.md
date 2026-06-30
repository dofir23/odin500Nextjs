# Odin500 weekly newsletter

Newsletter issues are stored in **BigQuery** (`weekly_newsletter`) and served by **odin500-backend**. The Next.js app fetches them at SSR — no markdown files in git.

## Backend

| Task | Command |
|------|---------|
| Migrate legacy `.md` | `cd odin500-backend && npm run newsletter:migrate-md` |
| Generate new issue | `cd odin500-backend && npm run newsletter:generate` |
| Force regenerate | `npm run newsletter:generate -- --week 2026-06-28 --force` |

- **API:** `GET /api/public/newsletter`, `GET /api/public/newsletter/:slug`
- **Cron:** `ENABLE_WEEKLY_NEWSLETTER_JOB=1` (Sundays 12:00 UTC)
- **OpenAI prompt:** `odin500-backend/docs/NEWSLETTER_OPENAI_PROMPT.md`

## Frontend

- `src/lib/newsletter.api.server.ts` — fetches from `API_ORIGIN`
- `src/lib/newsletterEnrich.server.ts` — appends live return tables at render time

## Env

Backend: `OPENAI_API_KEY`, `ENABLE_WEEKLY_NEWSLETTER_JOB=1`  
Frontend: `API_ORIGIN` pointing at the backend only.
