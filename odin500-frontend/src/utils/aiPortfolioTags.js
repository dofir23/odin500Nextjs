/**
 * Heuristics to tag published virtual portfolios as AI-engine / index-focused
 * until structured metadata (ai_engine, index_focus) exists on paper accounts.
 */

const ENGINE_PATTERNS = [
  { id: 'claude', label: 'Claude', re: /\b(claude|anthropic)\b/i },
  { id: 'chatgpt', label: 'ChatGPT', re: /\b(chatgpt|chat\s*gpt|openai|\bgpt-?\d*\b|\bgpt\b)/i },
  { id: 'gemini', label: 'Gemini', re: /\b(gemini|google\s*ai|\bbard\b)/i }
];

const INDEX_PATTERNS = [
  { id: 'sp500', label: 'S&P 500', re: /\b(s\s*&\s*p\s*500|sp\s*500|sp500|\bspx\b|\bspy\b)\b/i },
  { id: 'dow', label: 'Dow Jones', re: /\b(dow\s*jones|\bdjia\b|\bdow\b|\bdia\b)\b/i },
  { id: 'nasdaq', label: 'Nasdaq-100', re: /\b(nasdaq[\s-]*100|\bndx\b|\bqqq\b|nasdaq)\b/i }
];

const GENERIC_AI_RE = /\b(ai[-\s]?generated|ai[-\s]?portfolio|ai[-\s]?strateg|artificial\s+intelligence)\b/i;

/** Optional comma-separated account IDs forced into the AI teaser. */
function curatedIds() {
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_AI_PORTFOLIO_IDS || '' : '';
  return new Set(
    String(raw)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function blobFromPortfolio(p) {
  return [p?.name, p?.owner_label, p?.publish_description, p?.publish_strategy, p?.strategy_label]
    .map((x) => String(x || ''))
    .join(' ');
}

export function detectAiEngine(text) {
  const t = String(text || '');
  for (const eng of ENGINE_PATTERNS) {
    if (eng.re.test(t)) return { id: eng.id, label: eng.label };
  }
  if (GENERIC_AI_RE.test(t)) return { id: 'ai', label: 'AI' };
  return null;
}

export function detectIndexFocus(text) {
  const t = String(text || '');
  for (const idx of INDEX_PATTERNS) {
    if (idx.re.test(t)) return { id: idx.id, label: idx.label };
  }
  return null;
}

export function isAiTaggedPortfolio(p) {
  const id = String(p?.id || '').trim().toLowerCase();
  if (id && curatedIds().has(id)) return true;
  const blob = blobFromPortfolio(p);
  return Boolean(detectAiEngine(blob));
}

/**
 * Prefer true AI-tagged portfolios; fall back to top public rows for the teaser.
 * @returns {{ rows: object[], source: 'ai' | 'public-fallback' }}
 */
export function pickHomeAiPortfolioTeaser(portfolios, limit = 6) {
  const list = Array.isArray(portfolios) ? portfolios : [];
  const curated = curatedIds();

  const enriched = list.map((p) => {
    const blob = blobFromPortfolio(p);
    const engine = detectAiEngine(blob) || (curated.has(String(p?.id || '').toLowerCase())
      ? { id: 'ai', label: 'AI' }
      : null);
    const indexFocus = detectIndexFocus(blob);
    return { ...p, ai_engine: engine, index_focus: indexFocus };
  });

  const aiRows = enriched.filter((p) => p.ai_engine);
  // Prefer diversity: one slot per engine first, then fill by return.
  const byEngine = new Map();
  for (const row of aiRows) {
    const key = row.ai_engine?.id || 'ai';
    const prev = byEngine.get(key);
    if (!prev || Number(row.total_return_pct) > Number(prev.total_return_pct)) {
      byEngine.set(key, row);
    }
  }
  const diverse = [...byEngine.values()];
  const rest = aiRows
    .filter((r) => !diverse.some((d) => d.id === r.id))
    .sort((a, b) => Number(b.total_return_pct) - Number(a.total_return_pct));
  const pickedAi = [...diverse, ...rest].slice(0, limit);
  if (pickedAi.length) return { rows: pickedAi, source: 'ai' };

  const fallback = [...enriched]
    .sort((a, b) => Number(b.total_return_pct) - Number(a.total_return_pct))
    .slice(0, Math.min(limit, 3));
  return { rows: fallback, source: 'public-fallback' };
}
