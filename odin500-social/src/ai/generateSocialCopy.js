const fetch = require('node-fetch');
const { config } = require('../config');
const { log } = require('../utils/log');

const SYSTEM_PROMPT = `You write social posts for Odin500, a U.S. stock market data and trading signals platform.

Tone & compliance:
- Educational and analytical. Never promise returns or give buy/sell advice.
- Ground every post in the specific numbers provided (symbol, prices, % changes, dates, index moves).
- Explain what the chart/data suggests in plain language — momentum, range, relative strength, context.
- Do NOT include the disclaimer in your JSON — it is appended automatically after generation.

Format rules:
- twitter: Max 250 characters of body (hook + 2 tight insight sentences referencing the data). Dense, informative, no filler. No link, no hashtags, no disclaimer in your output.
- linkedin: 5–8 sentences across 2–3 short paragraphs. Open with the headline move, add context (what period, magnitude, what traders watch next), mention Odin500 charts/signals naturally once. No link, no disclaimer in your output.
- instagram: 4–6 short lines separated by line breaks. Conversational but professional. End with 3–5 relevant hashtags on the last line. No link, no disclaimer in your output.

Return strict JSON only: { "twitter": "...", "linkedin": "...", "instagram": "..." }`;

function buildTemplateCopy({ hook, bullets = [], link, tags, disclaimer, context = {} }) {
  const symbol = context.symbol ? `$${context.symbol}` : '';
  const detail = bullets.length ? bullets.join(' · ') : '';
  const twitterBody = [hook, detail].filter(Boolean).join('\n');
  const twitter = [twitterBody, disclaimer, `→ ${link}`, tags].filter(Boolean).join('\n\n');

  const linkedinBody = [
    hook,
    bullets.length ? bullets.map((b) => `• ${b}`).join('\n') : '',
    symbol
      ? `The ${symbol} chart on Odin500 shows how price has traded across this window — useful for spotting trend vs. consolidation.`
      : 'Explore live OHLC charts, market dashboards, and Odin signals on Odin500.',
    'For traders tracking U.S. equities, pairing price action with return tables helps frame risk and momentum.'
  ]
    .filter(Boolean)
    .join('\n\n');

  const linkedin = [linkedinBody, disclaimer, link].filter(Boolean).join('\n\n');

  const igTags = tags || (symbol ? `#stocks #trading #marketdata #Odin500 ${symbol.replace('$', '#')}` : '#stocks #trading #Odin500');
  const instagram = [
    hook,
    bullets[0] || '',
    bullets[1] || '',
    'Charts & signals on Odin500',
    igTags
  ]
    .filter(Boolean)
    .join('\n\n');

  return { twitter, linkedin, instagram };
}

function parseAiCopy(raw) {
  const cleaned = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const data = JSON.parse(cleaned);
    const twitter = String(data.twitter || '').trim();
    const linkedin = String(data.linkedin || '').trim();
    const instagram = String(data.instagram || data.instagram_caption || '').trim();
    if (!twitter || !linkedin) return null;
    return { twitter, linkedin, instagram: instagram || linkedin };
  } catch {
    return null;
  }
}

function stripFromBody(body, { disclaimer, link, tags }) {
  let s = String(body || '').trim();
  if (disclaimer) {
    while (s.includes(disclaimer)) s = s.replace(disclaimer, '');
  }
  if (link) {
    s = s.replace(`→ ${link}`, '').replace(link, '');
  }
  if (tags) s = s.replace(tags, '');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

function appendCopyFields({ parsed, link, tags, disclaimer }) {
  const twitterBody = stripFromBody(parsed.twitter, { disclaimer, link, tags });
  const linkedinBody = stripFromBody(parsed.linkedin, { disclaimer, link, tags });
  const instagramBody = stripFromBody(parsed.instagram, { disclaimer, link, tags });

  const twitter = [twitterBody, disclaimer, `→ ${link}`, tags].filter(Boolean).join('\n\n');
  const linkedin = [linkedinBody, disclaimer, link].filter(Boolean).join('\n\n');
  const instagram = [instagramBody, disclaimer, link, tags].filter(Boolean).join('\n\n');
  return { twitter, linkedin, instagram };
}

/**
 * @param {object} opts
 * @param {string} opts.campaign
 * @param {string} opts.hook
 * @param {string[]} [opts.bullets]
 * @param {string} opts.link
 * @param {string} opts.tags
 * @param {Record<string, unknown>} [opts.context]
 */
async function generateSocialCopy(opts) {
  const { campaign, hook, bullets = [], link, tags, context = {} } = opts;
  const disclaimer = config.disclaimer;
  const template = buildTemplateCopy({ hook, bullets, link, tags, disclaimer, context });

  const apiKey = config.openaiApiKey;
  if (!apiKey) {
    log.warn('ai', 'OPENAI_API_KEY not set — using template copy');
    return {
      copy: template,
      source: 'template',
      model: null,
      reason: 'missing_api_key'
    };
  }

  log.info('ai', `Starting OpenAI copy for campaign="${campaign}" model=${config.openaiModel}`);

  const userPayload = {
    campaign,
    hook,
    bullets,
    link,
    tags,
    disclaimer,
    extra: context
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.openaiTimeoutMs);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Write Twitter, LinkedIn, and Instagram copy for this Odin500 social post. Use every number in the data below.

Data:
${JSON.stringify(userPayload, null, 2)}

Return JSON only — no disclaimer, links, or hashtags in the fields (added later).`
          }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      log.error('ai', `OpenAI HTTP ${res.status}`, errText.slice(0, 400));
      return {
        copy: template,
        source: 'template',
        model: config.openaiModel,
        reason: `openai_http_${res.status}`
      };
    }

    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      log.warn('ai', 'OpenAI returned empty content — using template');
      return {
        copy: template,
        source: 'template',
        model: config.openaiModel,
        reason: 'empty_response'
      };
    }

    const parsed = parseAiCopy(content);
    if (!parsed) {
      log.warn('ai', 'Failed to parse OpenAI JSON — using template', content.slice(0, 200));
      return {
        copy: template,
        source: 'template',
        model: config.openaiModel,
        reason: 'invalid_json'
      };
    }

    const copy = appendCopyFields({ parsed, link, tags, disclaimer });

    log.info('ai', `OpenAI copy OK for "${campaign}"`, {
      twitterLen: copy.twitter.length,
      linkedinLen: copy.linkedin.length,
      instagramLen: copy.instagram.length,
      usage: payload?.usage
    });

    return {
      copy,
      source: 'openai',
      model: config.openaiModel,
      reason: null
    };
  } catch (err) {
    log.error('ai', 'OpenAI request failed — using template', err?.message || err);
    return {
      copy: template,
      source: 'template',
      model: config.openaiModel,
      reason: err?.name === 'AbortError' ? 'timeout' : 'request_error'
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generateSocialCopy, buildTemplateCopy };
