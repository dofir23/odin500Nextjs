'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Wand2, Plus, Send, MessageCircleQuestion } from 'lucide-react';
import { useLocation, useNavigate } from '@/navigation/appRouterCompat.jsx';
import { ModalCloseIcon } from '../ModalCloseIcon.jsx';
import { apiUrl } from '../../utils/apiOrigin.js';
import { ThemedDropdown } from '../ThemedDropdown.jsx';
import { useAiEngines, useAiPortfolioCreator } from '../../hooks/useAiPortfolioCreator.js';
import { usePaperSessionStore } from '../../store/paperSessionStore.js';
import { useIsLoggedIn } from '../../hooks/useIsLoggedIn.js';
import { useLoginGateOptional } from '../../context/LoginGateContext.jsx';
import { useUiStore } from '../../store/uiStore.js';
/**
 * This component is mounted by ProtectedLayout, so it renders on every app page — but its
 * styles live in the paper stylesheet, which only the paper views imported. On /market and the
 * rest the launcher was shipping completely unstyled. Importing here ties the stylesheet to the
 * component that needs it; Next dedupes it on pages that already pull it in.
 */
import '../../styles/paper-trading.css';

const ENGINE_LABELS = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini' };
const ENGINE_ORDER = ['claude', 'chatgpt', 'gemini'];

/** Must stay in step with .paper-assistant__panel--closing in paper-trading.css. */
const PANEL_CLOSE_MS = 180;

/** How long the "choose your model" nudge sits over the engine picker after opening. */
const ENGINE_HINT_MS = 5600;

/**
 * Animations here are decorative, so honour the OS setting rather than forcing motion.
 * Read at call time, not at module load — the preference can change mid-session.
 */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const INDEX_OPTIONS = [
  { id: 'sp500', label: 'S&P 500' },
  { id: 'dow', label: 'Dow Jones' },
  { id: 'nasdaq', label: 'Nasdaq-100' }
];

const DIRECTION_OPTIONS = [
  { id: 'long', label: 'Long-only' },
  { id: 'short', label: 'Short-only' },
  { id: 'long_short', label: 'Long-Short' }
];

/** Mirrors the server-side bounds in services/paper/aiPositionSizing.js. */
const POSITION_COUNT_MIN = 1;
const POSITION_COUNT_MAX = 30;
const DEFAULT_POSITION_COUNT = { long: 5, short: 5, long_short: 10 };
const STARTING_CAPITAL = 100000;

const POSITION_COUNT_OPTIONS = [
  { id: '5', label: '5 positions' },
  { id: '10', label: '10 positions' },
  { id: '15', label: '15 positions' },
  { id: '20', label: '20 positions' }
];

/** Hints spell out the difference — "equal split" vs "equal capital" is not self-evident. */
const SIZING_OPTIONS = [
  { id: 'equal_split', label: 'Equal split', hint: 'same share count' },
  { id: 'equal_capital', label: 'Equal capital', hint: 'same $ each' },
  { id: '10', label: '10 shares each' },
  { id: '25', label: '25 shares each' },
  { id: '50', label: '50 shares each' }
];

const CRITERIA_OPTIONS = [
  { id: 'none', label: 'No specific criteria' },
  { id: 'news_momentum', label: 'News / momentum' },
  { id: 'fundamental', label: 'Fundamental analysis' },
  { id: 'technical', label: 'Technical analysis' }
];

const CADENCE_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' }
];

/** Long-Short always needs a name on each side, so it can never be a one-position book. */
function minPositionsFor(direction) {
  return direction === 'long_short' ? 2 : POSITION_COUNT_MIN;
}

/**
 * The AI model itself is picked via the dropdown in the composer, not asked here.
 * `prompt`/`retry` may be functions of the config so far — the position-count question depends
 * on the direction already chosen. Steps with `numeric` accept a typed number, not just a chip.
 */
const WIZARD_STEPS = [
  { key: 'indexFocus', prompt: 'Which index should it trade — S&P 500, Dow Jones, or Nasdaq-100?', options: INDEX_OPTIONS },
  { key: 'direction', prompt: 'Long, short, or both?', options: DIRECTION_OPTIONS },
  {
    key: 'positionCount',
    numeric: true,
    prompt: (cfg) =>
      `How many positions should it hold? Pick one below or type any number from ${minPositionsFor(cfg.direction)} to ${POSITION_COUNT_MAX}.`,
    retry: (cfg) => `I need a number of positions — anything from ${minPositionsFor(cfg.direction)} to ${POSITION_COUNT_MAX}.`,
    options: POSITION_COUNT_OPTIONS
  },
  {
    key: 'sizing',
    numeric: true,
    prompt: `And how big should each position be? Equal split buys the same number of shares of every pick; equal capital divides your $${STARTING_CAPITAL.toLocaleString('en-US')} evenly across the picks and buys whatever shares each slice affords. Or just type a share count.`,
    retry:
      'Pick "equal capital" (same dollars per position), "equal split" (same share count), or type a whole number of shares.',
    options: SIZING_OPTIONS
  },
  {
    key: 'criteria',
    prompt: 'Any particular stock-picking style — news/momentum, fundamentals, technical, or no preference?',
    options: CRITERIA_OPTIONS
  },
  { key: 'cadence', prompt: 'Last one — how often should it rebalance the picks: daily, weekly, or monthly?', options: CADENCE_OPTIONS }
];

/** Regex-based slot extraction so a free-text answer (or an opening message that already
 *  states everything) fills the wizard without forcing the user through every question. */
const SLOT_PATTERNS = {
  indexFocus: [
    { id: 'nasdaq', re: /nasdaq/i },
    { id: 'dow', re: /dow\s*jones|\bdow\b/i },
    { id: 'sp500', re: /s\s*&?\s*p\s*500|\bs&p\b|standard\s*&?\s*poor/i }
  ],
  direction: [
    { id: 'long_short', re: /long[\s-]*short|long\s+and\s+short|both\s+directions|long\/short|\bboth\b/i },
    { id: 'short', re: /short[\s-]*only|\bshorts?\b/i },
    { id: 'long', re: /long[\s-]*only|\blongs?\b/i }
  ],
  criteria: [
    { id: 'technical', re: /technical/i },
    { id: 'fundamental', re: /fundamental/i },
    { id: 'news_momentum', re: /\bnews\b|momentum/i },
    {
      id: 'none',
      re: /no\s+(specific\s+)?(criteria|preference)|any(thing)?(\s+is\s+fine)?|you\s+(choose|decide|pick)|your\s+(own\s+)?(judg?e?ment|call)/i
    }
  ],
  cadence: [
    { id: 'daily', re: /daily|every\s*day/i },
    { id: 'weekly', re: /weekly|every\s*week/i },
    { id: 'monthly', re: /monthly|every\s*month/i }
  ]
};

/** Message expresses intent to actually start building (vs. just chatting/asking questions). */
const BUILD_INTENT_RE =
  /\bportfolio\b.*\b(build|create|make|start|construct|generate|set\s*up)\b|\b(build|create|make|start|construct|generate|set\s*up)\b.*\bportfolio\b|^(let'?s\s+(build|go|do\s+this)|build\s+it|create\s+it|do\s+it|go\s+ahead)\.?$/i;

/** Blank importer template — public route, so a plain download link works. */
const TEMPLATE_URL = apiUrl('/api/public/paper/ai-portfolio-template.xlsx');

const SIZE_STORAGE_KEY = 'odin_ai_portfolio_creator_size_v1';
const ENGINE_STORAGE_KEY = 'odin_ai_portfolio_creator_engine_v1';
const DEFAULT_SIZE = { width: 440, height: 640 };
const MIN_W = 320;
const MIN_H = 380;
const INTRO_SUGGESTIONS = ['Build me a portfolio', 'How does this work?'];

const SUGGESTIONS = [
  'Build this portfolio',
  'Pick the strongest signals first',
  'Swap out your weakest pick',
  'Let me know which tickers you chose and explain why you chose these tickers'
];

function clampSize(next) {
  if (typeof window === 'undefined') {
    return {
      width: Math.max(MIN_W, Number(next.width) || DEFAULT_SIZE.width),
      height: Math.max(MIN_H, Number(next.height) || DEFAULT_SIZE.height)
    };
  }
  const maxW = Math.max(MIN_W, window.innerWidth - 24);
  const maxH = Math.max(MIN_H, window.innerHeight - 88);
  return {
    width: Math.min(maxW, Math.max(MIN_W, Number(next.width) || DEFAULT_SIZE.width)),
    height: Math.min(maxH, Math.max(MIN_H, Number(next.height) || DEFAULT_SIZE.height))
  };
}

function readStoredSize() {
  try {
    const raw = sessionStorage.getItem(SIZE_STORAGE_KEY);
    if (!raw) return DEFAULT_SIZE;
    return clampSize(JSON.parse(raw));
  } catch {
    return DEFAULT_SIZE;
  }
}

function readStoredEngine() {
  try {
    const raw = String(localStorage.getItem(ENGINE_STORAGE_KEY) || '').trim().toLowerCase();
    return ENGINE_ORDER.includes(raw) ? raw : '';
  } catch {
    return '';
  }
}

function persistEngine(id) {
  try {
    const clean = String(id || '').trim().toLowerCase();
    if (ENGINE_ORDER.includes(clean)) localStorage.setItem(ENGINE_STORAGE_KEY, clean);
  } catch {
    /* ignore */
  }
}

function matchOption(text, options) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  return (
    options.find((o) => o.id.toLowerCase() === t) ||
    options.find((o) => o.label.toLowerCase() === t) ||
    options.find((o) => o.label.toLowerCase().includes(t) || t.includes(o.label.toLowerCase())) ||
    null
  );
}

/** Common short all-caps words that would otherwise false-positive as tickers. */
const TICKER_STOPWORDS = new Set([
  'AI', 'OK', 'ETF', 'ETFS', 'CEO', 'CFO', 'USD', 'EPS', 'IPO', 'NYSE', 'SEC', 'GDP', 'US', 'USA', 'FAQ', 'API'
]);

/** Index names tokenize into ticker-looking fragments ("S&P 500" -> S, P) — drop them first. */
const INDEX_PHRASE_RE = /s\s*&\s*p(\s*500)?|dow\s*jones|nasdaq(\s*-?\s*100)?/gi;

/** Two or more ticker-looking tokens (AAPL, BRK.B, ...) means the user named exact holdings.
 *  Single letters are excluded — they're far more often stray capitals than real tickers. */
function mentionsExplicitTickers(text) {
  const matches = String(text).replace(INDEX_PHRASE_RE, ' ').match(/\b[A-Z]{2,5}(?:\.[A-Z])?\b/g) || [];
  const tickers = matches.filter((m) => !TICKER_STOPWORDS.has(m));
  return tickers.length >= 2;
}

/**
 * Sizing answers stated in passing ("a 12-stock book, 25 shares each"). Deliberately tighter
 * than what the awaited step accepts: a bare number anywhere in a message is far more likely
 * to be part of an index name than an answer, so a unit word is always required here.
 */
const FREE_TEXT_SIZE_PATTERNS = {
  positionCount: /\b(\d{1,2})\s*(?:positions?|stocks?|tickers?|names?|holdings?|picks?)\b/i,
  // Checked before equalSplit: "equal weight"/"equal amount" are dollar-sizing phrases in
  // finance, and "equal capital" would otherwise be caught by a looser "equal ..." pattern.
  equalCapital:
    /\bequal(?:ly)?\s*(?:capital|dollars?|money|values?|amounts?|weight(?:ed|ing)?|allocat\w*|budget)\b|\bsame\s*(?:\$|dollars?|amount|value)\b|\bequal[-\s]?weight\w*\b/i,
  equalSplit:
    /\bequal(?:ly)?\s*(?:split|shares?|share\s*counts?|sized?|qty|quantit\w*)\b|\bsplit\s*(?:it\s*)?equally\b|\bsame\s*(?:qty|quantity|number\s*of\s*shares|share\s*count)\b/i,
  positionQty: /\b(\d[\d,]*)\s*shares?\b/i
};

/**
 * "You pick" / "whatever you think" — only honoured while the step is actually being asked.
 * Deliberately excludes "no preference", which the criteria step already claims.
 */
const DEFER_TO_AI_RE = /\b(you\s*(decide|choose|pick|know\s*best)|your\s*(call|choice)|whatever|up\s*to\s*you)\b/i;

/** Answers that mean "as big as it can be" — the same thing equal split already does. */
const MAX_SIZE_RE = /\b(as\s*many\s*as\s*(possible|it\s*can|you\s*can)|max(imum)?|fill\s*(it|the\s*account)|use\s*(all|the\s*whole)|biggest|largest)\b/i;

/** First whole number in an answer ("about 12 stocks please" -> 12). */
function firstWholeNumber(text) {
  const m = String(text).match(/\d[\d,]*/);
  if (!m) return null;
  const n = Math.trunc(Number(m[0].replace(/,/g, '')));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Scans free text for any wizard slot values it already states, in step order. */
function parseSlotsFromText(text) {
  const found = {};
  for (const step of WIZARD_STEPS) {
    for (const { id, re } of SLOT_PATTERNS[step.key] || []) {
      if (re.test(text)) {
        found[step.key] = id;
        break;
      }
    }
  }

  const countMatch = text.match(FREE_TEXT_SIZE_PATTERNS.positionCount);
  if (countMatch) found.positionCount = Number(countMatch[1]);

  // Named modes first: "equal shares" would otherwise read as a quantity of shares.
  const qtyMatch = text.match(FREE_TEXT_SIZE_PATTERNS.positionQty);
  if (FREE_TEXT_SIZE_PATTERNS.equalCapital.test(text)) {
    found.sizing = 'equal_capital';
    found.positionQty = null;
  } else if (FREE_TEXT_SIZE_PATTERNS.equalSplit.test(text)) {
    found.sizing = 'equal_split';
    found.positionQty = null;
  } else if (qtyMatch) {
    found.sizing = 'fixed_qty';
    found.positionQty = Number(String(qtyMatch[1]).replace(/,/g, ''));
  }

  // Naming exact tickers ("build with AAPL, MSFT...") makes the picking-style question moot —
  // there's no "style" to pick when the user already said exactly what to buy.
  if (!found.criteria && mentionsExplicitTickers(text)) {
    found.criteria = 'none';
  }
  return found;
}

/**
 * Turns one answer to one step into a config patch. Numeric steps take a typed number or an
 * "equal split" phrase; everything else falls back to matching an option label.
 * @returns {{ patch?: object, error?: string } | null} null when nothing usable was found
 */
function resolveStepAnswer(step, text, config) {
  // A number carrying the *other* step's unit ("make it 12 positions") is answering that
  // step, not this one — leave it to the free-text scan rather than misreading it here.
  const namesPositions = FREE_TEXT_SIZE_PATTERNS.positionCount.test(text);
  const namesShares = FREE_TEXT_SIZE_PATTERNS.positionQty.test(text);

  if (step.key === 'positionCount') {
    const min = minPositionsFor(config.direction);
    if (DEFER_TO_AI_RE.test(text)) {
      return { patch: { positionCount: Math.max(min, DEFAULT_POSITION_COUNT[config.direction] || 5) } };
    }
    if (namesShares && !namesPositions) return null;
    const n = firstWholeNumber(text);
    if (n == null) return null;
    if (n < min || n > POSITION_COUNT_MAX) {
      return { error: `That has to be between ${min} and ${POSITION_COUNT_MAX} positions — try again.` };
    }
    return { patch: { positionCount: n } };
  }

  if (step.key === 'sizing') {
    if (FREE_TEXT_SIZE_PATTERNS.equalCapital.test(text)) {
      return { patch: { sizing: 'equal_capital', positionQty: null } };
    }
    // Equal split stays the default for a non-answer: "as big as possible" is literally what
    // it does, and "you decide" resolved here before equal capital existed.
    if (FREE_TEXT_SIZE_PATTERNS.equalSplit.test(text) || MAX_SIZE_RE.test(text) || DEFER_TO_AI_RE.test(text)) {
      return { patch: { sizing: 'equal_split', positionQty: null } };
    }
    if (namesPositions && !namesShares) return null;
    const n = firstWholeNumber(text);
    if (n == null) return null;
    return { patch: { sizing: 'fixed_qty', positionQty: n } };
  }

  const matched = matchOption(text, step.options.filter((o) => !o.disabled));
  return matched ? { patch: { [step.key]: matched.id } } : null;
}

/** Long-Short can't run on one name, so a count picked before the direction gets nudged up. */
function reconcileConfig(config) {
  const min = minPositionsFor(config.direction);
  if (config.positionCount && config.positionCount < min) return { ...config, positionCount: min };
  return config;
}

function missingStep(cfg) {
  return WIZARD_STEPS.find((s) => !cfg[s.key]) || null;
}

/** What to say when an answer didn't parse — numeric steps can't just list their chips. */
function retryPromptFor(step, cfg) {
  if (step.retry) return typeof step.retry === 'function' ? step.retry(cfg) : step.retry;
  const optionLabels = step.options.filter((o) => !o.disabled).map((o) => o.label).join(', ');
  return `Sorry, I didn't catch that — pick one: ${optionLabels}.`;
}

/** Small-talk / capability replies for messages that aren't answering a slot or asking to build yet. */
function genericAssistantReply(text) {
  const t = text.trim().toLowerCase();
  if (/^(hi|hello|hey|yo|sup|howdy)\b/.test(t)) {
    return "Hey! I build AI-managed virtual portfolios — S&P 500, Dow Jones, or Nasdaq-100, long or short, your pick of style. Say \"build me a portfolio\" whenever you're ready.";
  }
  if (/what can you do|how does this work|how do you work|\bhelp\b/.test(t)) {
    return "I build a brand-new AI-managed virtual portfolio: you tell me the index, direction, how many positions and how big each one should be, the stock-picking style, and the rebalance cadence — then I select the tickers and propose the full portfolio for you to confirm. Just say \"build me a portfolio\" to start.";
  }
  return "I'm set up to build AI-managed virtual portfolios here. Tell me you'd like to build one — or describe the index/direction/style you have in mind — and I'll take it from there.";
}

/** Sizing line for the confirm card — the exact share count is only known once orders are placed. */
function describeProposalSizing(proposal) {
  if (proposal.sizing === 'fixed_qty' && proposal.position_qty > 0) {
    return `${proposal.position_qty} shares each (reduced if that overruns the capital)`;
  }
  if (proposal.sizing === 'equal_capital') return 'equal capital — same dollar amount per pick';
  return 'equal split — same share count for every pick';
}

function ProposalCard({ proposal, busy, error, errorCode, onConfirm, onCancel, onRename }) {
  const nameInputRef = useRef(null);
  const longs = proposal.holdings.filter((h) => h.action === 'BTO');
  const shorts = proposal.holdings.filter((h) => h.action === 'STO');
  const nameConflict = errorCode === 'DUPLICATE_NAME';
  const trimmedName = proposal.name.trim();

  useEffect(() => {
    if (nameConflict) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [nameConflict]);

  return (
    <div className="paper-assistant__proposal">
      <label className="paper-assistant__proposal-name-label" htmlFor="ai-portfolio-proposal-name">
        Portfolio name
      </label>
      <input
        id="ai-portfolio-proposal-name"
        ref={nameInputRef}
        type="text"
        className={'paper-assistant__input ai-portfolio-creator__name-input' + (nameConflict ? ' has-error' : '')}
        value={proposal.name}
        maxLength={120}
        disabled={busy}
        onChange={(e) => onRename(e.target.value)}
      />
      {proposal.rationale ? <p className="paper-assistant__proposal-summary">{proposal.rationale}</p> : null}
      <ul className="paper-assistant__proposal-actions">
        {longs.length ? <li>Long: {longs.map((h) => h.ticker).join(', ')}</li> : null}
        {shorts.length ? <li>Short: {shorts.map((h) => h.ticker).join(', ')}</li> : null}
        <li>
          {proposal.holdings.length} position{proposal.holdings.length === 1 ? '' : 's'} ·{' '}
          {describeProposalSizing(proposal)}
        </li>
      </ul>
      {error ? (
        <p className="paper-assistant__error">
          {error}
          {nameConflict ? ' Pick a different name above and confirm again.' : ''}
        </p>
      ) : null}
      <div className="paper-assistant__proposal-btns">
        <button type="button" className="paper-btn paper-btn--ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="paper-btn paper-btn--submit-entry"
          disabled={busy || !trimmedName}
          onClick={onConfirm}
        >
          {busy ? 'Creating…' : 'Confirm & create'}
        </button>
      </div>
    </div>
  );
}

/** Floating chat that greets first, chats freely, and only asks its config questions once the
 *  user says they want to build a portfolio (skipping any of the four questions they've already
 *  answered in the conversation) — then hands off to the real AI to research and propose. */
export function AiPortfolioCreatorChat({ onCreated }) {
  const navigate = useNavigate();
  const loggedIn = useIsLoggedIn();
  const loginGate = useLoginGateOptional();
  // The AI Portfolios gallery is public, but building one still needs an account (the chat/
  // engines endpoints require auth) — the hook below is only enabled once logged in so a guest
  // visitor never sees a silently-broken, disabled model picker.
  const { engines, loading: enginesLoading } = useAiEngines({ enabled: loggedIn });

  const [open, setOpen] = useState(false);
  /** Kept mounted for one animation frame after `open` flips, so the panel can animate out. */
  const [closing, setClosing] = useState(false);
  const [showEngineHint, setShowEngineHint] = useState(false);
  const closeTimerRef = useRef(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const dragRef = useRef(null);
  const listRef = useRef(null);

  // Local, client-side turns shown before the real AI takes over (greeting, small talk, slot Q&A).
  const [wizardLog, setWizardLog] = useState([]); // [{id, role, content}]
  const [config, setConfig] = useState({
    engine: '',
    indexFocus: '',
    direction: '',
    positionCount: 0,
    sizing: '',
    positionQty: null,
    criteria: '',
    cadence: ''
  });
  const [awaitingSlotKey, setAwaitingSlotKey] = useState(null);
  const [draft, setDraft] = useState('');
  const greetedRef = useRef(false);
  const autoStartedRef = useRef(false);
  // Every user message typed during the wizard phase — not just the one that completes the last
  // slot — so specifics like exact tickers named early on ("build with AAPL, MSFT...") aren't
  // dropped once the AI takes over.
  const userNotesRef = useRef([]);
  const pendingKickoffRef = useRef('');

  const wizardComplete = WIZARD_STEPS.every((s) => config[s.key]);

  const {
    messages,
    sending,
    error,
    proposal,
    confirming,
    confirmError,
    confirmErrorCode,
    importing,
    importError,
    sendMessage,
    importHoldingsFile,
    confirmProposal,
    renameProposal,
    dismissProposal,
    clearThread
  } = useAiPortfolioCreator(config);

  const engineOptions = ENGINE_ORDER.filter((id) => engines.some((e) => e.id === id)).map((id) => {
    const meta = engines.find((e) => e.id === id);
    return { id, label: ENGINE_LABELS[id], hint: meta?.configured ? undefined: 'not configured', disabled: !meta?.configured };
  });
  const anyEngineConfigured = engines.some((e) => e.configured);

  const pushWizard = useCallback((role, content) => {
    setWizardLog((prev) => [...prev, { id: `${role}-${Date.now()}-${Math.random()}`, role, content }]);
  }, []);

  // Prefer the user's last model choice; otherwise default to the first configured engine.
  useEffect(() => {
    if (!engines.length) return;
    const isConfigured = (id) => Boolean(id && engines.find((e) => e.id === id)?.configured);
    const stored = readStoredEngine();
    if (isConfigured(stored)) {
      if (config.engine !== stored) setConfig((prev) => ({ ...prev, engine: stored }));
      return;
    }
    if (isConfigured(config.engine)) return;
    const firstConfigured = ENGINE_ORDER.find((id) => isConfigured(id));
    if (firstConfigured) setConfig((prev) => ({ ...prev, engine: firstConfigured }));
  }, [config.engine, engines]);

  // Open with a plain greeting — not a wizard question — once the panel opens and engines have loaded.
  useEffect(() => {
    if (!open || greetedRef.current || enginesLoading) return;
    greetedRef.current = true;
    if (anyEngineConfigured) {
      pushWizard('bot', "Hi! I'm the Odin500 AI portfolio builder — how can I help you today?");
    }
  }, [open, enginesLoading, anyEngineConfigured, pushWizard]);

  // Fires once all four config slots are resolved (from wizard answers or parsed free text) —
  // hands off to the real AI with whatever text completed the config.
  useEffect(() => {
    if (!wizardComplete || autoStartedRef.current) return;
    autoStartedRef.current = true;
    setAwaitingSlotKey(null);
    pushWizard('bot', "Great, I've got everything I need — let me start building this…");
    void sendMessage(pendingKickoffRef.current || 'Build this portfolio.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardComplete]);

  // If the session ends while the panel is open (e.g. logged out in another tab), close it —
  // the underlying engines/chat endpoints require auth and would otherwise fail silently.
  useEffect(() => {
    if (loggedIn) return;
    // Session is gone — drop the panel immediately rather than animating a dead surface out.
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosing(false);
    setOpen(false);
  }, [loggedIn]);

  useEffect(() => {
    setSize(readStoredSize());
  }, []);

  useEffect(() => {
    const onResize = () => setSize((prev) => clampSize(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !open) return;
    el.scrollTop = el.scrollHeight;
  }, [wizardLog, messages, sending, open, proposal]);

  /**
   * Close through the exit animation. `open` stays true until it finishes, so the panel is not
   * torn out of the DOM mid-transition; reduced-motion users skip straight to unmount.
   */
  const requestClose = useCallback(() => {
    if (closeTimerRef.current) return;
    if (prefersReducedMotion()) {
      setOpen(false);
      return;
    }
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      setOpen(false);
    }, PANEL_CLOSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  /**
   * On /virtual-portfolio the launcher is the single AI entry point, because two assistants live
   * there ("Create AI portfolio" and "Ask Odin AI") and two floating buttons crowd the screen.
   * Pressing it opens a two-item menu instead of going straight into the creator; on every other
   * route there is only one action, so it opens the creator directly with no extra tap.
   */
  const location = useLocation();
  const onPortfolioPage =
    String(location?.pathname || '').replace(/\/+$/, '') === '/virtual-portfolio';
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen);
  // Needed only so the launcher can get out of the way of the assistant's sheet on mobile.
  const assistantOpen = useUiStore((s) => s.assistantOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef(null);

  const launcherLabel = onPortfolioPage ? 'Odin AI' : 'Create AI Portfolio';

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // The menu only exists on the portfolio page; leaving must not strand it open.
  useEffect(() => {
    if (!onPortfolioPage) setMenuOpen(false);
  }, [onPortfolioPage]);

  const onLauncherClick = useCallback(() => {
    if (!loggedIn) {
      loginGate?.showLoginRequired({ returnTo: '/virtual-portfolio/ai' });
      return;
    }
    if (onPortfolioPage) {
      setMenuOpen((v) => !v);
      return;
    }
    if (open) requestClose();
    else setOpen(true);
  }, [loggedIn, loginGate, onPortfolioPage, open, requestClose]);

  /**
   * The model picker sits among the composer's icon buttons, where first-time users miss it.
   * Nudge it once per opening and then get out of the way — it is a hint, not a dialog.
   * Waits for engines to resolve, so it never points at a disabled control.
   */
  useEffect(() => {
    if (!open || !anyEngineConfigured || prefersReducedMotion()) {
      setShowEngineHint(false);
      return undefined;
    }
    setShowEngineHint(true);
    const t = window.setTimeout(() => setShowEngineHint(false), ENGINE_HINT_MS);
    return () => window.clearTimeout(t);
  }, [open, anyEngineConfigured]);

  const persistSize = useCallback((next) => {
    const clamped = clampSize(next);
    setSize(clamped);
    try {
      sessionStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const onResizePointerDown = useCallback(
    (edge) => (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = size.width;
      const startH = size.height;
      dragRef.current = { edge, startX, startY, startW, startH };
      document.body.classList.add('paper-assistant--resizing');

      const onMove = (ev) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        let width = drag.startW;
        let height = drag.startH;
        if (drag.edge.includes('w')) width = drag.startW - dx;
        if (drag.edge.includes('n')) height = drag.startH - dy;
        setSize(clampSize({ width, height }));
      };
      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.classList.remove('paper-assistant--resizing');
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        let width = drag.startW;
        let height = drag.startH;
        if (drag.edge.includes('w')) width = drag.startW - dx;
        if (drag.edge.includes('n')) height = drag.startH - dy;
        persistSize({ width, height });
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [persistSize, size.height, size.width]
  );

  function askStep(step, cfg) {
    setAwaitingSlotKey(step.key);
    pushWizard('bot', typeof step.prompt === 'function' ? step.prompt(cfg) : step.prompt);
  }

  /** Single entry point for anything the user sends — typed, chip click, or suggestion click. */
  async function handleUserUtterance(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return;

    // Config already resolved — this is a real turn with the AI, not local wizard logic.
    if (wizardComplete) {
      await sendMessage(text);
      return;
    }

    pushWizard('user', text);
    userNotesRef.current.push(text);

    const awaitingStepNow = WIZARD_STEPS.find((s) => s.key === awaitingSlotKey) || null;
    // A message can both answer the question just asked and mention other slots in passing
    // ("12 stocks, and make it nasdaq"), so take both — but let the awaited step own its key,
    // otherwise a phrase like "you decide" gets claimed by whichever slot pattern sees it first.
    const parsed = parseSlotsFromText(text);
    const awaited = awaitingStepNow ? resolveStepAnswer(awaitingStepNow, text, config) : null;
    const patch = { ...parsed, ...(awaited?.patch || {}) };

    let nextConfig = config;
    if (Object.keys(patch).length) {
      nextConfig = reconcileConfig({ ...config, ...patch });
      setConfig(nextConfig);
    }

    const gainedSlot = nextConfig !== config;
    const stillMissing = missingStep(nextConfig);

    if (!stillMissing) {
      // Every slot resolved — hand off everything the user said during setup (not just this
      // last message) so specifics like exact tickers named earlier aren't lost. The effect
      // watching `wizardComplete` sends this off to the AI.
      pendingKickoffRef.current = userNotesRef.current.join('\n');
      setAwaitingSlotKey(null);
      return;
    }

    // Out-of-range answer to the question still on the table — explain instead of re-asking.
    if (awaited?.error && stillMissing.key === awaitingStepNow?.key) {
      pushWizard('bot', awaited.error);
      return;
    }

    if (gainedSlot) {
      askStep(stillMissing, nextConfig);
      return;
    }

    if (awaitingStepNow) {
      pushWizard('bot', retryPromptFor(awaitingStepNow, nextConfig));
      return;
    }

    if (BUILD_INTENT_RE.test(text)) {
      askStep(stillMissing, nextConfig);
      return;
    }

    pushWizard('bot', genericAssistantReply(text));
  }

  function resetAll() {
    clearThread();
    setWizardLog([]);
    const keptEngine = readStoredEngine();
    setConfig({
      engine: keptEngine,
      indexFocus: '',
      direction: '',
      positionCount: 0,
      sizing: '',
      positionQty: null,
      criteria: '',
      cadence: ''
    });
    setAwaitingSlotKey(null);
    autoStartedRef.current = false;
    userNotesRef.current = [];
    pendingKickoffRef.current = '';
    // Panel stays open across a reset, so the mount effect won't re-fire — post the greeting directly.
    greetedRef.current = true;
    if (anyEngineConfigured) {
      pushWizard('bot', "Hi! I'm the Odin500 AI portfolio builder — how can I help you today?");
    }
  }

  async function handleSend(text) {
    const value = String(text ?? draft).trim();
    if (!value || sending) return;
    setDraft('');
    await handleUserUtterance(value);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const imported = await importHoldingsFile(file);
    if (!imported) return;
    // The file carried its own config — adopt it so the thread is live and the proposal can be
    // confirmed. Mark the build as already started so the wizard-complete effect doesn't kick
    // off a fresh AI run that would overwrite the proposal we just got back.
    autoStartedRef.current = true;
    setAwaitingSlotKey(null);
    setConfig((prev) => {
      const next = {
        engine: imported.engine || prev.engine,
        indexFocus: imported.index_focus || prev.indexFocus,
        direction: imported.direction || prev.direction,
        // The file's own row count wins here — it's what was actually proposed.
        positionCount: imported.position_count || prev.positionCount,
        sizing: imported.sizing || prev.sizing,
        positionQty: imported.position_qty ?? prev.positionQty,
        criteria: imported.criteria || prev.criteria,
        cadence: imported.cadence || prev.cadence
      };
      if (next.engine) persistEngine(next.engine);
      return next;
    });
  }

  async function handleConfirm() {
    const account = await confirmProposal();
    if (account) {
      resetAll();
      setOpen(false);
      onCreated?.(account);
      // The launcher lives in ProtectedLayout now, so pages that want to refresh after a
      // portfolio is created can no longer be handed a callback — they listen for this instead.
      window.dispatchEvent(new CustomEvent('odin-ai-portfolio-created', { detail: account }));
      // Not published yet (that's an explicit later step) — go to the private dashboard,
      // not the public detail page, since the public page 404s until it's published.
      usePaperSessionStore.getState().setActiveAccountId(account.id);
      navigate('/virtual-portfolio');
    }
  }

  const awaitingStep = WIZARD_STEPS.find((s) => s.key === awaitingSlotKey) || null;
  const showIntroSuggestions =
    !wizardComplete && !awaitingStep && anyEngineConfigured && wizardLog.length <= 1 && messages.length === 0;

  return (
    <div
      className={
        'paper-assistant ai-portfolio-creator' +
        (open ? ' paper-assistant--open' : '') +
        (assistantOpen ? ' is-assistant-open' : '')
      }
    >
      <div
        className="paper-assistant__toggle ai-portfolio-creator__toggle"
        role="group"
        aria-label={onPortfolioPage ? 'Odin AI' : 'Create AI portfolio'}
        ref={menuWrapRef}
      >
        {menuOpen ? (
          <div className="ai-portfolio-creator__menu" role="menu" aria-label="Odin AI actions">
            <button
              type="button"
              role="menuitem"
              className="ai-portfolio-creator__menu-item"
              onClick={() => {
                setMenuOpen(false);
                setAssistantOpen(false);
                setOpen(true);
              }}
            >
              <Wand2 size={16} strokeWidth={2.25} aria-hidden />
              Create AI portfolio
            </button>
            <button
              type="button"
              role="menuitem"
              className="ai-portfolio-creator__menu-item"
              onClick={() => {
                setMenuOpen(false);
                if (open) requestClose();
                setAssistantOpen(true);
              }}
            >
              <MessageCircleQuestion size={16} strokeWidth={2.25} aria-hidden />
              Ask Odin AI
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className={
            'paper-assistant__toggle-btn' +
            (open || menuOpen ? ' paper-assistant__toggle-btn--active' : '')
          }
          aria-expanded={onPortfolioPage ? menuOpen : open}
          aria-haspopup={onPortfolioPage ? 'menu' : undefined}
          aria-controls={onPortfolioPage ? undefined : 'ai-portfolio-creator-panel'}
          title={onPortfolioPage ? 'Odin AI' : 'Create AI Portfolio'}
          onClick={onLauncherClick}
        >
          {/* Wand + label on desktop; a bare + on narrow screens, where the pill's text made it
              span most of the viewport. CSS swaps them so there is no breakpoint state in JS. */}
          <Wand2 className="paper-assistant__toggle-sparkle" strokeWidth={2.25} aria-hidden />
          <Plus
            className="paper-assistant__toggle-sparkle ai-portfolio-creator__toggle-plus"
            strokeWidth={2.5}
            aria-hidden
          />
          <span className="paper-assistant__toggle-text">{launcherLabel}</span>
        </button>
      </div>

      {open || closing ? (
        <section
          id="ai-portfolio-creator-panel"
          className={
            'paper-assistant__panel wl-manage-modal' +
            (closing ? ' paper-assistant__panel--closing' : '')
          }
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-portfolio-creator-title"
          style={{ width: size.width, height: size.height }}
        >
          <div
            className="paper-assistant__resize paper-assistant__resize--n"
            onPointerDown={onResizePointerDown('n')}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize height"
            title="Drag to resize height"
          />
          <div
            className="paper-assistant__resize paper-assistant__resize--w"
            onPointerDown={onResizePointerDown('w')}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize width"
            title="Drag to resize width"
          />
          <div
            className="paper-assistant__resize paper-assistant__resize--nw"
            onPointerDown={onResizePointerDown('nw')}
            role="separator"
            aria-label="Resize"
            title="Drag to resize"
          />

          <header className="paper-assistant__head wl-manage-modal__head">
            <div className="paper-assistant__head-text">
              <h2 id="ai-portfolio-creator-title" className="paper-assistant__title wl-manage-modal__title">
                Create AI Portfolio
              </h2>
              <p className="paper-assistant__sub">
                {wizardComplete
                  ? `${ENGINE_LABELS[config.engine]} · building a new portfolio`
                  : awaitingStep
                    ? 'A few quick questions'
                    : 'Ask me anything'}
              </p>
            </div>
            <div className="paper-assistant__head-actions">
              <button type="button" className="paper-btn paper-btn--ghost paper-assistant__clear" onClick={resetAll}>
                Start over
              </button>
              <button
                type="button"
                className="wl-manage-modal__close"
                onClick={requestClose}
                aria-label="Close"
              >
                <ModalCloseIcon className="wl-manage-modal__close-icon" />
              </button>
            </div>
          </header>

          {!enginesLoading && !anyEngineConfigured ? (
            <p className="paper-assistant__banner paper-assistant__banner--warn">
              No AI engines are configured on the server yet — add an API key (Claude, ChatGPT, or Gemini) to
              enable portfolio creation.
            </p>
          ) : (
            <p className="paper-assistant__banner">
              Simulated paper trading only — not investment advice. Published for everyone once you confirm.
            </p>
          )}

          <div ref={listRef} className="paper-assistant__messages" role="log" aria-live="polite">
            {wizardLog.map((m) => (
              <div
                key={m.id}
                className={'paper-assistant__msg' + (m.role === 'user' ? ' paper-assistant__msg--user' : ' paper-assistant__msg--bot')}
              >
                <p className="paper-assistant__msg-text">{m.content}</p>
              </div>
            ))}

            {showIntroSuggestions ? (
              <>
                <div className="paper-assistant__chips" aria-label="Suggested prompts">
                  {INTRO_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="paper-assistant__chip"
                      onClick={() => void handleUserUtterance(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="ai-portfolio-creator__template-hint">
                  Already know your picks? Fill in the{' '}
                  <a
                    className="ai-portfolio-creator__template-link"
                    href={TEMPLATE_URL}
                    download
                  >
                    portfolio template (.xlsx)
                  </a>{' '}
                  and upload it with the <strong>+</strong> button — it carries your settings, so
                  no questions needed.
                </p>
              </>
            ) : null}

            {!wizardComplete && awaitingStep && anyEngineConfigured ? (
              <div className="paper-assistant__chips" aria-label={`Choose ${awaitingStep.key}`}>
                {awaitingStep.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="paper-assistant__chip"
                    disabled={opt.disabled}
                    title={opt.disabled ? 'No API key configured on the server yet' : undefined}
                    onClick={() => !opt.disabled && void handleUserUtterance(opt.label)}
                  >
                    {opt.label}
                    {opt.hint ? ` (${opt.hint})` : ''}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Upload works before the wizard is answered, so its status lives outside it. */}
            {importing ? <p className="paper-assistant__typing">Reading file…</p> : null}
            {importError ? <p className="paper-assistant__error">{importError}</p> : null}

            {wizardComplete ? (
              <>
                <div className="paper-assistant__chips" aria-label="Suggested prompts">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="paper-assistant__chip"
                      disabled={sending}
                      onClick={() => void handleSend(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      'paper-assistant__msg' +
                      (m.role === 'user' ? ' paper-assistant__msg--user' : ' paper-assistant__msg--bot') +
                      (m.isError ? ' paper-assistant__msg--err' : '')
                    }
                  >
                    <p className="paper-assistant__msg-text">{m.content}</p>
                  </div>
                ))}
              </>
            ) : null}

            {proposal ? (
              <ProposalCard
                proposal={proposal}
                busy={confirming}
                error={confirmError}
                errorCode={confirmErrorCode}
                onCancel={dismissProposal}
                onConfirm={() => void handleConfirm()}
                onRename={renameProposal}
              />
            ) : null}
            {sending ? <p className="paper-assistant__typing">Thinking…</p> : null}
          </div>

          {error ? <p className="paper-assistant__error">{error}</p> : null}

          <form
            className="paper-assistant__composer ai-portfolio-creator__composer"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            {/* Wrapper exists to anchor the hint bubble; ThemedDropdown positions its own menu
                against .app-dropdown, so the extra element does not disturb it. */}
            <div
              className={
                'ai-portfolio-creator__engine-wrap' + (showEngineHint ? ' is-hinting' : '')
              }
            >
              <ThemedDropdown
                size="sm"
                className="ai-portfolio-creator__engine-dd"
                value={config.engine}
                options={engineOptions}
                onChange={(id) => {
                  persistEngine(id);
                  setConfig((prev) => ({ ...prev, engine: id }));
                  // Once they have found it, stop nudging.
                  setShowEngineHint(false);
                }}
                title="AI model"
                ariaLabelPrefix="AI model"
                labelFallback="Model"
                disabled={!engineOptions.length}
              />
              {showEngineHint ? (
                <span className="ai-portfolio-creator__engine-tip ml-2" role="status">
                  Choose your AI model
                </span>
              ) : null}
            </div>
            <label
              className={'ai-portfolio-creator__attach-btn' + (importing ? ' is-disabled' : '')}
              title="Upload a filled template (.xlsx)"
              aria-label="Upload a filled template (.xlsx)"
            >
              <Plus size={18} strokeWidth={2.25} aria-hidden />
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                disabled={importing}
                style={{ display: 'none' }}
              />
            </label>
            <label className="sr-only" htmlFor="ai-portfolio-creator-input">
              Message
            </label>
            <textarea
              id="ai-portfolio-creator-input"
              className="paper-assistant__input"
              rows={1}
              value={draft}
              disabled={!anyEngineConfigured || sending}
              placeholder={
                !anyEngineConfigured
                  ? 'No AI engine configured'
                  : wizardComplete
                    ? 'Ask the AI to build your portfolio…'
                    : 'Type a message…'
              }
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="submit"
              className="paper-btn paper-btn--submit-entry ai-portfolio-creator__send-btn"
              aria-label="Send"
              title="Send"
              disabled={!anyEngineConfigured || sending || !draft.trim()}
            >
              <Send size={17} strokeWidth={2.25} aria-hidden />
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
