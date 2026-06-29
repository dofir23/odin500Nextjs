import type { NewsletterWeek } from './newsletterWeek';
import {
  fetchNewsletterContext,
  formatContextForPrompt,
  type NewsletterGenerationContext
} from './fetchNewsletterContext';
import {
  generateNewsletterTemplate,
  type GeneratedNewsletterContent,
  type NewsletterGeneratorSource
} from './generateNewsletterTemplate';

export type NewsletterGenerationResult = {
  content: GeneratedNewsletterContent;
  source: NewsletterGeneratorSource;
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 60_000;

function stripCodeFence(text: string) {
  return text
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseAiJson(raw: string): GeneratedNewsletterContent | null {
  const cleaned = stripCodeFence(raw);
  try {
    const data = JSON.parse(cleaned) as Record<string, unknown>;
    const title = String(data.title || '').trim();
    const description = String(data.description || '').trim();
    const body = String(data.body || '').trim();
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    if (!title || !description || !body) return null;
    return { title, description, tags, body };
  } catch {
    return null;
  }
}

async function callOpenAi(
  week: NewsletterWeek,
  ctx: NewsletterGenerationContext
): Promise<GeneratedNewsletterContent | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_NEWSLETTER_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.OPENAI_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const system = `You write Odin500 Weekly — an insightful U.S. stock market newsletter in Markdown for investors and researchers.
Output ONLY valid JSON (no markdown fences) with keys: title, description, tags (string array), body.
body must be Markdown only (no YAML frontmatter) and include:
- 1 substantive intro paragraph (what moved markets this week and why it matters)
- ## Executive summary (5-7 bullets with **bold** labels; cite specific % moves and signal counts from the data)
- ## Sector & breadth read (interpret rotation: what led, what lagged, and what it implies)
- ## Signals & setups (how Odin signal counts tilt bullish/bearish; link to /odin-signals)
- ## What to watch next week (3 concrete bullets)
- internal links to /market, /odin-signals, /heatmap, /return-table, /indices/sp500, /market-movers
- closing disclaimer: *Not investment advice. Data from Odin500 daily OHLC and signal models.*
Tone: clear, specific, data-driven. Do not invent numbers — use only provided data. Prefer weekly (1W) figures when present.`;

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
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[newsletter] OpenAI error:', res.status, errText.slice(0, 200));
      return null;
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseAiJson(content);
  } catch (err) {
    console.warn('[newsletter] OpenAI request failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** AI-generated content with template fallback. */
export async function generateNewsletterContent(
  week: NewsletterWeek,
  ctx?: NewsletterGenerationContext | null
): Promise<NewsletterGenerationResult> {
  const context = ctx ?? (await fetchNewsletterContext());
  if (!context) {
    throw new Error('Failed to fetch market data for newsletter generation');
  }

  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  if (hasKey) {
    console.log('[newsletter] OPENAI_API_KEY detected — requesting AI draft…');
  } else {
    console.warn('[newsletter] OPENAI_API_KEY not set — will use template fallback.');
  }

  const ai = hasKey ? await callOpenAi(week, context) : null;
  if (ai) {
    if (!ai.tags.length) {
      ai.tags = generateNewsletterTemplate(week, context).tags;
    }
    console.log('[newsletter] ✓ AI draft accepted.');
    return { content: { ...ai, generator: 'ai' }, source: 'ai' };
  }

  console.warn('[newsletter] Using template fallback (no key, API error, or invalid AI response).');
  const tpl = generateNewsletterTemplate(week, context);
  return { content: { ...tpl, generator: 'template' }, source: 'template' };
}
