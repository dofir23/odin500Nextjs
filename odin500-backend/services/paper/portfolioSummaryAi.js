const fetch = require('node-fetch');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You write short, clear summaries for published virtual (paper) trading portfolios on Odin500.
Rules:
- 4 sentences max, under 220 characters total.
- Neutral research tone. No advice like "buy" or "invest now".
- Mention strategy flavor (AI engine / index / long-short / automated) when present.
- Mention total return. You may mention average monthly return only if days_elapsed is at least 14; otherwise skip avg monthly or call it an early normalized rate.
- NEVER write fractional months like "0.28 months". If under 30 days, say "about N days" (use days_elapsed, rounded). If under 7 days, say "published recently".
- Plain prose only — no markdown, bullets, quotes, or labels.`;

/** In-memory cache: key -> { summary, at } */
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 60 * 1000;

function cacheKey(p) {
  const id = String(p?.id || '');
  const avg = Number(p?.avg_monthly_return_pct);
  const tot = Number(p?.total_return_pct);
  const eq = Math.round(Number(p?.equity) || 0);
  const days = Number(p?.days_elapsed);
  const desc = String(p?.publish_description || '').slice(0, 80);
  return `${id}|${avg}|${tot}|${eq}|${days}|${desc}`;
}

function agePhrase(p) {
  const days = Number(p?.days_elapsed);
  const months = Number(p?.months_elapsed);
  if (Number.isFinite(days) && days < 30) {
    const d = Math.max(1, Math.round(days));
    return d === 1 ? 'about 1 day' : `about ${d} days`;
  }
  if (Number.isFinite(months) && months >= 1) {
    const m = Math.round(months * 10) / 10;
    return m === 1 ? 'about 1 month' : `about ${m} months`;
  }
  return null;
}

function heuristicSummary(p) {
  const engine = String(p?.ai_engine_label || '').trim();
  const index = String(p?.index_focus_label || '').trim();
  const auto = p?.strategy_mode && p.strategy_mode !== 'manual';
  const avg = p?.avg_monthly_return_pct;
  const total = p?.total_return_pct;
  const days = Number(p?.days_elapsed);
  const age = agePhrase(p);

  const bits = [];
  if (engine && index) bits.push(`${engine}-assisted book focused on the ${index}`);
  else if (engine) bits.push(`${engine}-assisted virtual portfolio`);
  else if (index) bits.push(`Virtual portfolio oriented around the ${index}`);
  else bits.push('Published virtual portfolio on Odin500');
  if (auto) bits.push('with automated trading rules');

  if (total != null && Number.isFinite(Number(total))) {
    const totStr = `${Number(total) >= 0 ? '+' : ''}${Number(total).toFixed(2)}%`;
    bits.push(`with ${totStr} total return`);
  }

  if (
    avg != null &&
    Number.isFinite(Number(avg)) &&
    Number.isFinite(days) &&
    days >= 14
  ) {
    const avgStr = `${Number(avg) >= 0 ? '+' : ''}${Number(avg).toFixed(2)}%`;
    bits.push(`(${avgStr} average monthly${age ? ` over ${age}` : ''})`);
  } else if (age) {
    bits.push(`tracked for ${age}`);
  }

  return `${bits.join(' ')}.`;
}

function portfolioPayloadForPrompt(p) {
  return {
    name: p.name,
    owner: p.owner_label,
    publish_description: p.publish_description || '',
    publish_strategy: p.publish_strategy || '',
    strategy_mode: p.strategy_mode || 'manual',
    ai_engine: p.ai_engine_label || null,
    index_focus: p.index_focus_label || null,
    equity: p.equity,
    total_return_pct: p.total_return_pct,
    avg_monthly_return_pct: p.avg_monthly_return_pct,
    months_elapsed: p.months_elapsed,
    days_elapsed: p.days_elapsed,
    age_label: agePhrase(p),
    positions_count: p.positions_count
  };
}

async function callOpenAiBatch(portfolios) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model =
    process.env.OPENAI_PORTFOLIO_SUMMARY_MODEL?.trim() ||
    process.env.OPENAI_NEWSLETTER_MODEL?.trim() ||
    DEFAULT_MODEL;
  const timeoutMs = Number(process.env.OPENAI_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const user = `Write a short summary for each portfolio. Return JSON:
{ "summaries": [ { "id": "<portfolio id>", "summary": "..." } ] }

Portfolios:
${JSON.stringify(portfolios.map((p) => ({ id: p.id, ...portfolioPayloadForPrompt(p) })), null, 2)}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[portfolio-summary-ai] OpenAI error:', res.status, errText.slice(0, 200));
      return null;
    }

    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return null;

    const cleaned = String(content)
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const data = JSON.parse(cleaned);
    const rows = Array.isArray(data?.summaries) ? data.summaries : [];
    const out = {};
    for (const row of rows) {
      const id = String(row?.id || '').trim();
      const summary = String(row?.summary || '').trim();
      if (id && summary) out[id] = summary.slice(0, 320);
    }
    return Object.keys(out).length ? out : null;
  } catch (err) {
    console.warn('[portfolio-summary-ai] request failed:', err?.message || err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object[]} portfolios list rows (must include id)
 * @returns {Promise<{ summaries: Record<string,string>, source: 'ai'|'fallback' }>}
 */
async function generatePortfolioSummaries(portfolios) {
  const list = Array.isArray(portfolios) ? portfolios.filter((p) => p?.id) : [];
  const summaries = {};
  const needAi = [];

  for (const p of list) {
    const key = cacheKey(p);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      summaries[p.id] = hit.summary;
      continue;
    }
    needAi.push(p);
  }

  let source = 'fallback';
  if (needAi.length) {
    const aiMap = await callOpenAiBatch(needAi);
    if (aiMap) {
      source = 'ai';
      for (const p of needAi) {
        const text = aiMap[p.id] || heuristicSummary(p);
        summaries[p.id] = text;
        cache.set(cacheKey(p), { summary: text, at: Date.now() });
      }
    } else {
      for (const p of needAi) {
        const desc = String(p.publish_description || '').trim();
        const text = desc
          ? desc.length > 280
            ? `${desc.slice(0, 277).trim()}…`
            : desc
          : heuristicSummary(p);
        summaries[p.id] = text;
        cache.set(cacheKey(p), { summary: text, at: Date.now() });
      }
    }
  } else if (Object.keys(summaries).length) {
    source = 'cache';
  }

  return { summaries, source };
}

module.exports = { generatePortfolioSummaries, heuristicSummary };
