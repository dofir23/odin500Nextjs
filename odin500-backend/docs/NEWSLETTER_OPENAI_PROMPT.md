# Odin500 Weekly — OpenAI prompt (backend)

Generation runs in `services/newsletter/newsletterAi.js` when `OPENAI_API_KEY` is set in **odin500-backend** `.env`.

## Environment

```env
OPENAI_API_KEY=sk-...
OPENAI_NEWSLETTER_MODEL=gpt-4o-mini
OPENAI_API_TIMEOUT_MS=60000
ENABLE_WEEKLY_NEWSLETTER_JOB=1
```

## System prompt

See `OPENAI_SYSTEM_PROMPT` in `services/newsletter/newsletterTemplate.js`.

## Manual generate

```bash
npm run newsletter:generate
npm run newsletter:generate -- --week 2026-06-28 --force
```

Or `POST /api/admin/newsletter/generate` with header `X-Newsletter-Admin-Secret` when `NEWSLETTER_ADMIN_SECRET` is set.
