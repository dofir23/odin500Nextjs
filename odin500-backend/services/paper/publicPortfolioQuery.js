/**
 * Server-side filter / sort / paginate for the published-portfolios list.
 *
 * The list itself is built and cached wholesale by publicPortfolio.listPublishedPortfolios()
 * (one BigQuery price scan for every published book), so paging happens over that cached
 * array rather than by re-querying Supabase per page.
 *
 * Tagging mirrors odin500-frontend/src/utils/aiPortfolioTags.js: accounts created by the AI
 * portfolio creator carry structured ai_engine / ai_index_focus / ai_direction columns, and
 * older manually-published books fall back to the same text heuristics the UI uses — so a
 * filter means the same thing on both sides.
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

const SHORT_RE = /\b(short(?:ing)?|bear(?:ish)?|inverse)\b/i;
const GENERIC_AI_RE =
  /\b(ai[-\s]?generated|ai[-\s]?portfolio|ai[-\s]?strateg|artificial\s+intelligence)\b/i;

const DIRECTION_LABELS = { long: 'Long', short: 'Short', long_short: 'Long-Short' };

/**
 * `avg_monthly_return_pct` is deliberately absent: it is still computed and returned on every
 * row, but it extrapolates a few days of performance into a monthly figure, so ranking on it
 * put days-old books at the top of the leaderboard. Sorting is on total return until that
 * metric is either age-gated or replaced.
 */
const SORT_KEYS = new Set(['total_return_pct', 'equity', 'positions_count', 'published_at']);

const DEFAULT_SORT_KEY = 'total_return_pct';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function textBlob(p) {
  return [p?.name, p?.owner_label, p?.publish_description, p?.publish_strategy]
    .map((x) => String(x || ''))
    .join(' ');
}

/** Derives { engine, index, direction } tag ids for one portfolio row. */
function tagsFor(p) {
  if (p?.ai_managed) {
    const engine = ENGINE_PATTERNS.find((e) => e.id === p.ai_engine);
    return {
      engineId: engine?.id || p.ai_engine || 'ai',
      engineLabel: engine?.label || p.ai_engine || 'AI',
      indexId: INDEX_PATTERNS.find((i) => i.id === p.ai_index_focus)?.id || null,
      directionId: p.ai_direction || 'long'
    };
  }
  const blob = textBlob(p);
  const engine = ENGINE_PATTERNS.find((e) => e.re.test(blob));
  const engineId = engine?.id || (GENERIC_AI_RE.test(blob) ? 'ai' : null);
  return {
    engineId,
    engineLabel: engine?.label || (engineId ? 'AI' : null),
    indexId: INDEX_PATTERNS.find((i) => i.re.test(blob))?.id || null,
    directionId: SHORT_RE.test(blob) ? 'short' : 'long'
  };
}

function compare(a, b, key, dir) {
  const mul = dir === 'asc' ? 1 : -1;
  const av = a?.[key];
  const bv = b?.[key];

  if (key === 'published_at') {
    const am = Date.parse(String(av || ''));
    const bm = Date.parse(String(bv || ''));
    const aOk = Number.isFinite(am);
    const bOk = Number.isFinite(bm);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1; // nulls last regardless of direction
    if (!bOk) return -1;
    return (am - bm) * mul;
  }

  const an = av == null || av === '' ? null : Number(av);
  const bn = bv == null || bv === '' ? null : Number(bv);
  const aOk = an != null && Number.isFinite(an);
  const bOk = bn != null && Number.isFinite(bn);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  if (an === bn) return 0;
  return an < bn ? -1 * mul : 1 * mul;
}

function toInt(raw, fallback) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {object[]} all the full cached list from listPublishedPortfolios()
 * @param {object} opts query params (already string-typed, straight off req.query)
 * @returns {{ portfolios: object[], pagination: object, facets: object }}
 */
function queryPublishedPortfolios(all, opts = {}) {
  const list = Array.isArray(all) ? all : [];
  const aiOnly = opts.ai_only === '1' || opts.ai_only === 'true' || opts.aiOnly === true;

  const tagged = list.map((p) => ({ row: p, tags: tagsFor(p) }));
  const aiFiltered = aiOnly ? tagged.filter((t) => t.tags.engineId) : tagged;

  // `owner=admin|user` splits the AI galleries: Odin's own books vs. ones members published.
  // Applied before the facet scan so each gallery's engine dropdown only offers engines that
  // actually appear in that gallery.
  const owner = String(opts.owner || '').trim().toLowerCase();
  const base =
    owner === 'admin'
      ? aiFiltered.filter((t) => t.row?.owner_is_admin === true)
      : owner === 'user'
        ? aiFiltered.filter((t) => t.row?.owner_is_admin !== true)
        : aiFiltered;

  // Engine facet comes from the pre-filter set so the dropdown keeps every engine on offer
  // even after the user narrows by index/direction.
  const facetEngines = [];
  const seenEngines = new Set();
  for (const { tags } of base) {
    if (!tags.engineId || seenEngines.has(tags.engineId)) continue;
    seenEngines.add(tags.engineId);
    facetEngines.push({ id: tags.engineId, label: tags.engineLabel || tags.engineId });
  }
  const knownOrder = ENGINE_PATTERNS.map((e) => e.id);
  facetEngines.sort((a, b) => {
    const ai = knownOrder.indexOf(a.id);
    const bi = knownOrder.indexOf(b.id);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  const engine = String(opts.engine || '').trim();
  const index = String(opts.index || '').trim();
  const direction = String(opts.direction || '').trim();
  const isAll = (v) => !v || v === '__all__';

  const filtered = base.filter(
    ({ tags }) =>
      (isAll(engine) || tags.engineId === engine) &&
      (isAll(index) || tags.indexId === index) &&
      (isAll(direction) || tags.directionId === direction)
  );

  const sortKey = SORT_KEYS.has(String(opts.sort)) ? String(opts.sort) : DEFAULT_SORT_KEY;
  const sortDir = String(opts.dir) === 'asc' ? 'asc' : 'desc';
  const rows = filtered.map((t) => t.row).sort((a, b) => compare(a, b, sortKey, sortDir));

  const pageSize = Math.min(Math.max(toInt(opts.page_size ?? opts.pageSize, DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(toInt(opts.page, 1), 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    portfolios: rows.slice(start, start + pageSize),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
      has_prev: page > 1,
      has_next: page < totalPages
    },
    facets: { engines: facetEngines }
  };
}

module.exports = {
  queryPublishedPortfolios,
  tagsFor,
  ENGINE_PATTERNS,
  INDEX_PATTERNS,
  DIRECTION_LABELS
};
