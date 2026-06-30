const fetch = require('node-fetch');
const { fetchNewsletterContext, formatContextForPrompt } = require('./newsletterContext');
const { generateNewsletterTemplate, OPENAI_SYSTEM_PROMPT } = require('./newsletterTemplate');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 60_000;

function parseAiJson(raw) {
  const cleaned = String(raw || '')
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const data = JSON.parse(cleaned);
    const title = String(data.title || '').trim();
    const description = String(data.description || '').trim();
    const body = String(data.body || '').trim();
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    if (!title || !description || !body) return null;
    return { title, description, tags, body, generator: 'ai' };
  } catch {
    return null;
  }
}

async function callOpenAi(week, ctx) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_NEWSLETTER_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.OPENAI_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const user = `Write the newsletter for ${week.weekLabel} (published ${week.publishedAt}).

Market data:
${formatContextForPrompt(ctx)}

Return JSON: { "title": "Odin500 Weekly: ...", "description": "...", "tags": ["market-recap", ...], "body": "..." }`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: OPENAI_SYSTEM_PROMPT },
          { role: 'user', content: user }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[newsletter-ai] OpenAI error:', res.status, errText.slice(0, 200));
      return null;
    }

    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseAiJson(content);
  } catch (err) {
    console.warn('[newsletter-ai] request failed:', err?.message || err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateNewsletterContent(week, ctx) {
  const context = ctx || (await fetchNewsletterContext());
  if (!context) throw new Error('Failed to fetch market data for newsletter');

  if (process.env.OPENAI_API_KEY?.trim()) {
    const ai = await callOpenAi(week, context);
    if (ai) {
      if (!ai.tags.length) ai.tags = generateNewsletterTemplate(week, context).tags;
      return { content: ai, source: 'ai' };
    }
    console.warn('[newsletter-ai] falling back to template');
  }

  const tpl = generateNewsletterTemplate(week, context);
  return { content: tpl, source: 'template' };
}

module.exports = { generateNewsletterContent, OPENAI_SYSTEM_PROMPT };
