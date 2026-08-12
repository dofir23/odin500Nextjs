const fetch = require('node-fetch');

/**
 * Normalizes chat + tool-calling across OpenAI, Anthropic, and Gemini so callers
 * (portfolio creator, daily rebalance job) never branch on provider.
 *
 * Canonical message shape (what callers build/consume):
 *   { role: 'user',      content: string }
 *   { role: 'assistant', content: string|null, tool_calls?: [{ id, name, arguments }] }
 *   { role: 'tool',      tool_call_id, name, content: string }   // content = JSON.stringify(result)
 *
 * `tools` is always OpenAI-style function definitions (same shape already used by
 * services/paper/portfolioAssistant.js's TOOL_DEFINITIONS): [{ type:'function', function:{ name, description, parameters } }]
 *
 * Return shape: { content: string|null, toolCalls: [{ id, name, arguments }], raw }
 */

const DEFAULT_TIMEOUT_MS = 60_000;

const ENGINES = {
  chatgpt: {
    label: 'ChatGPT',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnvVars: ['OPENAI_PORTFOLIO_CHAT_MODEL', 'OPENAI_PORTFOLIO_SUMMARY_MODEL', 'OPENAI_NEWSLETTER_MODEL'],
    // Verify against OpenAI's current model list before relying on this default in production.
    defaultModel: 'gpt-4o-mini',
    call: callOpenAi
  },
  claude: {
    label: 'Claude',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    modelEnvVars: ['ANTHROPIC_PORTFOLIO_MODEL'],
    // Verify against Anthropic's current model list before relying on this default in production.
    defaultModel: 'claude-sonnet-4-5-20250929',
    call: callAnthropic
  },
  gemini: {
    label: 'Gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    modelEnvVars: ['GEMINI_PORTFOLIO_MODEL'],
    // Verify against Google's current model list before relying on this default in production.
    // Google retires older models (2.0-flash, 2.5-flash both 404 now), so keep this current.
    defaultModel: 'gemini-3.6-flash',
    call: callGemini
  }
};

function listEngines() {
  return Object.entries(ENGINES).map(([id, e]) => ({ id, label: e.label, configured: hasEngineKey(id) }));
}

function hasEngineKey(engine) {
  const cfg = ENGINES[engine];
  if (!cfg) return false;
  return Boolean(process.env[cfg.apiKeyEnv]?.trim());
}

function engineConfig(engine) {
  const cfg = ENGINES[engine];
  if (!cfg) {
    const err = new Error(`Unknown AI engine: ${engine}`);
    err.status = 400;
    err.code = 'UNKNOWN_ENGINE';
    throw err;
  }
  const apiKey = process.env[cfg.apiKeyEnv]?.trim() || '';
  if (!apiKey) {
    const err = new Error(`${cfg.label} is not configured on the server (${cfg.apiKeyEnv} missing).`);
    err.status = 503;
    err.code = 'ENGINE_MISSING';
    throw err;
  }
  const model = cfg.modelEnvVars.map((k) => process.env[k]?.trim()).find(Boolean) || cfg.defaultModel;
  const timeoutMs = Number(process.env.AI_PROVIDER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return { apiKey, model, timeoutMs, label: cfg.label };
}

function providerError(label, status, bodyText) {
  const err = new Error(`${label} error ${status}: ${String(bodyText || '').slice(0, 200)}`);
  err.status = 502;
  err.code = 'PROVIDER_ERROR';
  return err;
}

function safeJsonParse(str) {
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

async function callAiProvider({ engine, systemPrompt, messages, tools }) {
  const cfg = ENGINES[engine];
  if (!cfg) {
    const err = new Error(`Unknown AI engine: ${engine}`);
    err.status = 400;
    err.code = 'UNKNOWN_ENGINE';
    throw err;
  }
  const { apiKey, model, timeoutMs } = engineConfig(engine);
  return cfg.call({ apiKey, model, timeoutMs, systemPrompt, messages: messages || [], tools: tools || [] });
}

// ---------------------------------------------------------------------------
// OpenAI — https://platform.openai.com/docs/api-reference/chat
// ---------------------------------------------------------------------------

function toOpenAiMessages(systemPrompt, messages) {
  const out = [{ role: 'system', content: systemPrompt }];
  for (const m of messages) {
    if (m.role === 'assistant' && m.tool_calls?.length) {
      out.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments || {}) }
        }))
      });
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.tool_call_id, content: m.content });
    } else {
      out.push({ role: m.role, content: m.content || '' });
    }
  }
  return out;
}

async function callOpenAi({ apiKey, model, timeoutMs, systemPrompt, messages, tools }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: toOpenAiMessages(systemPrompt, messages),
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? 'auto' : undefined
      }),
      signal: controller.signal
    });
    if (!res.ok) throw providerError('OpenAI', res.status, await res.text().catch(() => ''));
    const payload = await res.json();
    const choice = payload?.choices?.[0]?.message;
    if (!choice) throw providerError('OpenAI', 502, 'empty response');
    const toolCalls = (Array.isArray(choice.tool_calls) ? choice.tool_calls : []).map((call) => ({
      id: call.id,
      name: call.function?.name,
      arguments: safeJsonParse(call.function?.arguments)
    }));
    return { content: choice.content || null, toolCalls, raw: payload };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Anthropic — https://docs.anthropic.com/en/api/messages
// ---------------------------------------------------------------------------

function toAnthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'assistant') {
      const content = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const tc of m.tool_calls || []) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments || {} });
      }
      out.push({ role: 'assistant', content: content.length ? content : [{ type: 'text', text: '' }] });
    } else if (m.role === 'tool') {
      out.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }]
      });
    } else {
      out.push({ role: 'user', content: m.content || '' });
    }
  }
  return out;
}

function toAnthropicTools(tools) {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters
  }));
}

async function callAnthropic({ apiKey, model, timeoutMs, systemPrompt, messages, tools }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.3,
        system: systemPrompt,
        messages: toAnthropicMessages(messages),
        tools: tools.length ? toAnthropicTools(tools) : undefined
      }),
      signal: controller.signal
    });
    if (!res.ok) throw providerError('Anthropic', res.status, await res.text().catch(() => ''));
    const payload = await res.json();
    const blocks = Array.isArray(payload?.content) ? payload.content : [];
    const textBlock = blocks.find((b) => b.type === 'text');
    const toolCalls = blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, arguments: b.input || {} }));
    return { content: textBlock?.text || null, toolCalls, raw: payload };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Gemini — https://ai.google.dev/api/generate-content
// Gemini has no tool-call id concept (correlates by function name instead), and
// uses role 'model' (not 'assistant'). We still emit synthetic ids on the way out
// so the canonical shape stays uniform for logging/dedup across all three engines.
// ---------------------------------------------------------------------------

/** Gemini's schema parser rejects some JSON Schema keys OpenAI/Anthropic accept. */
function sanitizeSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini);
  const { additionalProperties, ...rest } = schema;
  const out = {};
  for (const [key, value] of Object.entries(rest)) {
    out[key] = value && typeof value === 'object' ? sanitizeSchemaForGemini(value) : value;
  }
  return out;
}

function toGeminiContents(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'assistant') {
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.tool_calls || []) {
        const part = { functionCall: { name: tc.name, args: tc.arguments || {} } };
        // Gemini 3+ rejects a follow-up turn whose functionCall parts don't echo back the
        // thought signature it issued with them (400 "missing a thought_signature").
        if (tc.thoughtSignature) part.thoughtSignature = tc.thoughtSignature;
        parts.push(part);
      }
      out.push({ role: 'model', parts: parts.length ? parts : [{ text: '' }] });
    } else if (m.role === 'tool') {
      out.push({
        role: 'user',
        parts: [{ functionResponse: { name: m.name, response: safeJsonParse(m.content) } }]
      });
    } else {
      out.push({ role: 'user', parts: [{ text: m.content || '' }] });
    }
  }
  return out;
}

function toGeminiTools(tools) {
  if (!tools.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: sanitizeSchemaForGemini(t.function.parameters)
      }))
    }
  ];
}

async function callGemini({ apiKey, model, timeoutMs, systemPrompt, messages, tools }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: toGeminiContents(messages),
        tools: toGeminiTools(tools),
        generationConfig: { temperature: 0.3 }
      }),
      signal: controller.signal
    });
    if (!res.ok) throw providerError('Gemini', res.status, await res.text().catch(() => ''));
    const payload = await res.json();
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p) => typeof p.text === 'string' && p.text);
    const toolCalls = parts
      .filter((p) => p.functionCall)
      .map((p, i) => ({
        id: `gemini_${p.functionCall.name}_${i}_${Date.now()}`,
        name: p.functionCall.name,
        arguments: p.functionCall.args || {},
        // Replayed verbatim by toGeminiContents on the next round; the tool loop pushes these
        // objects straight back into the convo, and the other providers ignore the extra field.
        thoughtSignature: p.thoughtSignature
      }));
    return { content: textPart?.text || null, toolCalls, raw: payload };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  callAiProvider,
  listEngines,
  hasEngineKey,
  engineConfig
};
