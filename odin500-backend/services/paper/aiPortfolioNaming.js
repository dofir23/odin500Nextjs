// Deterministic names for AI-created portfolios: <Admin->?<User>-<index>-<direction>-<engine>.
//
// The model used to invent the name ("Dow Momentum Five"), which meant the same configuration
// produced a different name on every run and varied by engine, and nothing in the name said whose
// book it was. Composing it here instead makes the name reproducible and self-describing, and it
// removes the naming instruction from the prompt entirely — there is no model output left to drift.

const supabaseService = require('../../config/supabaseService');

/** Slugs are chosen to read well in a name, not to match the internal config keys. */
const INDEX_NAME_SLUGS = {
  dow: 'dowjones',
  nasdaq: 'nasdaq100',
  sp500: 'sp500'
};

const DIRECTION_NAME_SLUGS = {
  long: 'long',
  short: 'short',
  long_short: 'longshort'
};

const ENGINE_NAME_SLUGS = {
  claude: 'claude',
  chatgpt: 'chatgpt',
  gemini: 'gemini'
};

/** Keeps the owner's own capitalisation ("Gautam") but drops anything that would blur the
 *  hyphen-delimited structure — spaces, punctuation, and existing hyphens. */
function slugifyOwner(raw) {
  const cleaned = String(raw || '').replace(/[^A-Za-z0-9]+/g, '');
  return cleaned.slice(0, 24);
}

/**
 * Display name if the profile has one, otherwise the local part of the account email
 * (`sp500bm@gmail.com` -> `sp500bm`), which beats showing a whole address in a portfolio name.
 *
 * @returns {Promise<{ owner: string, isAdmin: boolean }>}
 */
async function resolveOwnerNamePart(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return { owner: 'User', isAdmin: false };

  const { data: profile } = await supabaseService
    .from('user_profiles')
    .select('display_name, is_admin')
    .eq('id', uid)
    .maybeSingle();

  const isAdmin = Boolean(profile?.is_admin);
  const displayName = slugifyOwner(profile?.display_name);
  if (displayName) return { owner: displayName, isAdmin };

  try {
    const { data, error } = await supabaseService.auth.admin.getUserById(uid);
    const email = !error ? String(data?.user?.email || '') : '';
    const local = slugifyOwner(email.split('@')[0]);
    if (local) return { owner: local, isAdmin };
  } catch {
    // Fall through to the generic label — a naming lookup must never block portfolio creation.
  }

  return { owner: 'User', isAdmin };
}

/**
 * Appends -2, -3, ... when the owner already has a book with this name.
 *
 * Scoped to the one user on purpose: two different people can both hold
 * "Gautam-dowjones-long-claude" without either being forced into a suffix, and the public
 * leaderboard already disambiguates them by owner column.
 */
async function ensureUniqueForUser(userId, baseName) {
  const { data, error } = await supabaseService
    .from('paper_accounts')
    .select('name')
    .eq('user_id', userId)
    .ilike('name', `${baseName}%`);

  // A failed lookup should cost a duplicate name, never a failed creation.
  if (error || !Array.isArray(data) || !data.length) return baseName;

  const taken = new Set(data.map((r) => String(r.name || '').trim().toLowerCase()));
  if (!taken.has(baseName.toLowerCase())) return baseName;

  for (let n = 2; n <= 999; n += 1) {
    const candidate = `${baseName}-${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${baseName}-${Date.now()}`;
}

/**
 * @param {{ userId: string, indexFocus: string, direction: string, engine: string }} input
 * @returns {Promise<string>} e.g. "Gautam-dowjones-long-claude" or "Admin-Gautam-sp500-longshort-gemini"
 */
async function buildAiPortfolioName({ userId, indexFocus, direction, engine }) {
  const { owner, isAdmin } = await resolveOwnerNamePart(userId);
  const parts = [
    isAdmin ? 'Admin' : null,
    owner,
    INDEX_NAME_SLUGS[indexFocus] || String(indexFocus || 'index'),
    DIRECTION_NAME_SLUGS[direction] || String(direction || 'long'),
    ENGINE_NAME_SLUGS[engine] || String(engine || 'ai')
  ].filter(Boolean);

  return ensureUniqueForUser(userId, parts.join('-'));
}

module.exports = {
  buildAiPortfolioName,
  INDEX_NAME_SLUGS,
  DIRECTION_NAME_SLUGS,
  ENGINE_NAME_SLUGS
};
