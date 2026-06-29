'use client';
import {
  isClosingPaperAction,
  isOpeningPaperAction,
  paperActionLabel,
  PAPER_ACTION_OPTIONS
} from './paperActionLabels.js';

export const RULE_TYPE_OPTIONS = [
  { id: 'price_above', label: 'Price above' },
  { id: 'price_below', label: 'Price below' },
  { id: 'always', label: 'Always (every run)' },
  { id: 'signal_side_long', label: 'Odin signal: Long (L1–L3)' },
  { id: 'signal_side_short', label: 'Odin signal: Short (S1–S3)' },
  { id: 'signal_side_neutral', label: 'Odin signal: Neutral (N)' },
  { id: 'signal_bucket', label: 'Odin signal: Exact Signals' }
];

export const SIGNAL_BUCKETS = ['L1', 'L2', 'L3', 'S1', 'S2', 'S3', 'N'];
export const LONG_SIGNAL_BUCKETS = ['L1', 'L2', 'L3'];
export const SHORT_SIGNAL_BUCKETS = ['S1', 'S2', 'S3'];

function ruleIdentity(rule) {
  return rule?.id ?? rule?._localId ?? null;
}

function normalizeTickerSet(tickers) {
  return new Set(
    (tickers || []).map((t) => String(t || '').trim().toUpperCase()).filter(Boolean)
  );
}

/** Long buckets an entry (buy) rule fires on. */
export function longBucketsFromRule(rule) {
  const ui = apiRuleToUiType(rule);
  if (ui === 'signal_side_long') return new Set(LONG_SIGNAL_BUCKETS);
  if (ui === 'signal_bucket') {
    return new Set(parseRuleSignalBuckets(rule).filter((b) => LONG_SIGNAL_BUCKETS.includes(b)));
  }
  return new Set();
}

/** Short buckets an entry (short) rule fires on. */
export function shortBucketsFromRule(rule) {
  const ui = apiRuleToUiType(rule);
  if (ui === 'signal_side_short') return new Set(SHORT_SIGNAL_BUCKETS);
  if (ui === 'signal_bucket') {
    return new Set(parseRuleSignalBuckets(rule).filter((b) => SHORT_SIGNAL_BUCKETS.includes(b)));
  }
  return new Set();
}

export function normalizeSignalBucketCode(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase();
  return SIGNAL_BUCKETS.includes(s) ? s : '';
}

/** @param {object} rule */
export function parseRuleSignalBuckets(rule) {
  if (apiRuleToUiType(rule) !== 'signal_bucket') return [];
  const params = rule?.params || {};
  const raw = Array.isArray(params.buckets)
    ? params.buckets
    : params.bucket != null && params.bucket !== ''
      ? [params.bucket]
      : [];
  return [...new Set(raw.map(normalizeSignalBucketCode).filter(Boolean))];
}

/**
 * Buckets already used by other exact-signal rules for the given ticker(s).
 * @param {object[]} rules
 * @param {string[]} tickers
 * @param {string|null} [excludeRuleId]
 */
export function getClaimedSignalBuckets(rules, tickers, excludeRuleId = null) {
  const tickerSet = normalizeTickerSet(tickers);
  if (!tickerSet.size) return new Set();

  const claimed = new Set();
  for (const rule of rules || []) {
    if (excludeRuleId != null && ruleIdentity(rule) === excludeRuleId) continue;
    const sym = ruleTickerKey(rule);
    if (!tickerSet.has(sym)) continue;
    for (const bucket of parseRuleSignalBuckets(rule)) {
      claimed.add(bucket);
    }
  }
  return claimed;
}

/**
 * Sell cannot reuse buy entry signals; cover cannot reuse short entry signals.
 * @returns {{ blockedRuleTypes: Set<string>, blockedBuckets: Set<string> }}
 */
export function getExitSignalRestrictions(rules, tickers, closeAction, excludeRuleId = null) {
  const action = String(closeAction || '').toUpperCase();
  const entryAction = action === 'STC' ? 'BTO' : action === 'BTC' ? 'STO' : null;
  const blockedRuleTypes = new Set();
  const blockedBuckets = new Set();
  if (!entryAction) return { blockedRuleTypes, blockedBuckets };

  const tickerSet = normalizeTickerSet(tickers);
  if (!tickerSet.size) return { blockedRuleTypes, blockedBuckets };

  let blockLongSideRule = false;
  let blockShortSideRule = false;

  for (const rule of rules || []) {
    if (excludeRuleId != null && ruleIdentity(rule) === excludeRuleId) continue;
    const sym = ruleTickerKey(rule);
    if (!tickerSet.has(sym)) continue;
    if (String(rule.action || '').toUpperCase() !== entryAction) continue;

    if (entryAction === 'BTO') {
      const longBuckets = longBucketsFromRule(rule);
      if (apiRuleToUiType(rule) === 'signal_side_long' || longBuckets.size > 0) {
        blockLongSideRule = true;
      }
      for (const b of longBuckets) blockedBuckets.add(b);
    } else if (entryAction === 'STO') {
      const shortBuckets = shortBucketsFromRule(rule);
      if (apiRuleToUiType(rule) === 'signal_side_short' || shortBuckets.size > 0) {
        blockShortSideRule = true;
      }
      for (const b of shortBuckets) blockedBuckets.add(b);
    }
  }

  if (action === 'STC' && blockLongSideRule) {
    blockedRuleTypes.add('signal_side_long');
  }
  if (action === 'BTC' && blockShortSideRule) {
    blockedRuleTypes.add('signal_side_short');
  }

  return { blockedRuleTypes, blockedBuckets };
}

/** Union of bucket + exit-restriction disables for the rule form. */
export function getDisabledSignalBuckets(rules, tickers, action, excludeRuleId = null) {
  const disabled = getClaimedSignalBuckets(rules, tickers, excludeRuleId);
  if (isClosingPaperAction(action)) {
    const { blockedBuckets } = getExitSignalRestrictions(rules, tickers, action, excludeRuleId);
    for (const b of blockedBuckets) disabled.add(b);
  }
  return disabled;
}

export function buildRuleTypeOptions(rules, tickers, action, excludeRuleId = null) {
  const { blockedRuleTypes } = isClosingPaperAction(action)
    ? getExitSignalRestrictions(rules, tickers, action, excludeRuleId)
    : { blockedRuleTypes: new Set() };

  const entryHint =
    String(action).toUpperCase() === 'STC'
      ? 'Already used by your Buy entry rule for this ticker'
      : String(action).toUpperCase() === 'BTC'
        ? 'Already used by your Short entry rule for this ticker'
        : 'Unavailable';

  return RULE_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    disabled: blockedRuleTypes.has(opt.id),
    disabledTitle: blockedRuleTypes.has(opt.id) ? entryHint : undefined
  }));
}

/** Actions valid for a rule type (hidden options are omitted from the form). */
export function getAllowedActionsForRuleType(uiRuleType, signalBuckets = []) {
  const all = ['BTO', 'STO', 'STC', 'BTC'];
  const type = String(uiRuleType || 'always');

  if (type === 'signal_side_long') return ['BTO', 'STC'];
  if (type === 'signal_side_short') return ['STO', 'BTC'];
  if (type === 'signal_side_neutral') return ['STC', 'BTC'];

  if (type === 'signal_bucket') {
    const buckets = normalizeSignalBucketList(signalBuckets);
    if (!buckets.length) return all;
    const allowed = new Set();
    for (const b of buckets) {
      if (LONG_SIGNAL_BUCKETS.includes(b)) {
        allowed.add('BTO');
        allowed.add('STC');
      }
      if (SHORT_SIGNAL_BUCKETS.includes(b)) {
        allowed.add('STO');
        allowed.add('BTC');
      }
      if (b === 'N') {
        allowed.add('STC');
        allowed.add('BTC');
      }
    }
    return allowed.size ? [...allowed] : all;
  }

  return all;
}

export function defaultActionForRuleType(uiRuleType, signalBuckets = []) {
  const allowed = getAllowedActionsForRuleType(uiRuleType, signalBuckets);
  const preferred = {
    signal_side_long: 'BTO',
    signal_side_short: 'STO',
    signal_side_neutral: 'STC',
    signal_bucket: 'BTO'
  };
  const type = String(uiRuleType || 'always');
  const pick = preferred[type] || 'BTO';
  if (allowed.includes(pick)) return pick;
  return allowed[0] || 'BTO';
}

export function coalesceActionForRuleType(uiRuleType, signalBuckets, currentAction) {
  const action = String(currentAction || 'BTO').toUpperCase();
  const allowed = getAllowedActionsForRuleType(uiRuleType, signalBuckets);
  if (allowed.includes(action)) return action;
  return defaultActionForRuleType(uiRuleType, signalBuckets);
}

export function buildActionOptions(uiRuleType, signalBuckets = []) {
  const allowed = new Set(getAllowedActionsForRuleType(uiRuleType, signalBuckets));
  return PAPER_ACTION_OPTIONS.filter((opt) => allowed.has(opt.id));
}

export { PAPER_ACTION_OPTIONS as ACTION_OPTIONS } from './paperActionLabels.js';

export function uiRuleTypeToApi(uiType) {
  if (uiType === 'signal_side_long') return { rule_type: 'signal_side', params: { side: 'long' } };
  if (uiType === 'signal_side_short') return { rule_type: 'signal_side', params: { side: 'short' } };
  if (uiType === 'signal_side_neutral') return { rule_type: 'signal_side', params: { side: 'neutral' } };
  if (uiType === 'signal_bucket') return { rule_type: 'signal_bucket', params: {} };
  return { rule_type: uiType, params: {} };
}

export function apiRuleToUiType(rule) {
  const t = String(rule?.rule_type || '').toLowerCase();
  const params = rule?.params || {};
  if (t === 'signal_side') {
    const side = String(params.side || '').toLowerCase();
    if (side === 'long') return 'signal_side_long';
    if (side === 'short') return 'signal_side_short';
    return 'signal_side_neutral';
  }
  if (t === 'signal_bucket') return 'signal_bucket';
  return t || 'always';
}

function buildSingleRulePayload(form, ticker) {
  const uiType = form.uiRuleType || form.rule_type || 'always';
  const { rule_type, params } = uiRuleTypeToApi(uiType);
  const action = String(form.action || 'BTO').toUpperCase();
  const closeAll = Boolean(form.closeAll) && isClosingPaperAction(action);

  const payload = {
    rule_type,
    ticker: String(ticker || '').toUpperCase(),
    action,
    qty: closeAll ? 1 : Number(form.qty),
    params: { ...params },
    is_active: form.is_active !== false
  };

  if (closeAll) {
    payload.params.close_all = true;
  }

  if (isOpeningPaperAction(action)) {
    const maxPos = Number(form.maxPositionQty);
    if (Number.isFinite(maxPos) && maxPos > 0) {
      payload.params.max_position_qty = maxPos;
    }
    const maxVal = Number(form.maxPositionValue);
    if (Number.isFinite(maxVal) && maxVal > 0) {
      payload.params.max_position_value = maxVal;
    }
    if (form.bracketEnabled) {
      const sl = Number(form.bracketStopLoss);
      const tp = Number(form.bracketTakeProfit);
      const bracket = {};
      if (Number.isFinite(sl) && sl > 0) bracket.stopLoss = sl;
      if (Number.isFinite(tp) && tp > 0) bracket.takeProfit = tp;
      if (Object.keys(bracket).length) payload.params.bracket = bracket;
    }
  }

  if (rule_type === 'signal_bucket') {
    const buckets = normalizeSignalBucketList(form.signalBuckets ?? form.signalBucket);
    if (buckets.length === 1) {
      payload.params.bucket = buckets[0];
    }
    payload.params.buckets = buckets;
  }
  if (rule_type === 'price_above' || rule_type === 'price_below') {
    payload.threshold_value = Number(form.threshold_value);
  }
  return payload;
}

/** One API rule per ticker when multiple symbols are selected. */
export function buildRulePayloads(form) {
  const tickers = Array.isArray(form.tickers)
    ? form.tickers.map((t) => String(t || '').trim().toUpperCase()).filter(Boolean)
    : [String(form.ticker || '').trim().toUpperCase()].filter(Boolean);

  const unique = [...new Set(tickers)];
  return unique.map((ticker) => buildSingleRulePayload(form, ticker));
}

export function buildRulePayload(form) {
  const payloads = buildRulePayloads(form);
  return payloads[0];
}

export function validateRuleForm(form, context = {}) {
  const { existingRules = [], excludeRuleId = null } = context;
  const tickers = Array.isArray(form.tickers)
    ? form.tickers.map((t) => String(t || '').trim()).filter(Boolean)
    : [String(form.ticker || '').trim()].filter(Boolean);
  if (!tickers.length) return 'Select at least one ticker';

  const action = String(form.action || 'BTO').toUpperCase();
  const closeAll = Boolean(form.closeAll) && isClosingPaperAction(action);

  if (!closeAll) {
    const qty = Number(form.qty);
    if (!Number.isFinite(qty) || qty <= 0) return 'Quantity must be greater than 0';
  }

  if (isOpeningPaperAction(action)) {
    const maxPos = Number(form.maxPositionQty);
    if (!Number.isFinite(maxPos) || maxPos <= 0) {
      return 'Max shares owned is required for Buy and Short rules';
    }
    const maxValRaw = form.maxPositionValue;
    if (maxValRaw !== '' && maxValRaw != null) {
      const maxVal = Number(maxValRaw);
      if (!Number.isFinite(maxVal) || maxVal <= 0) {
        return 'Max dollar limit must be greater than 0';
      }
    }
    const qty = Number(form.qty);
    if (Number.isFinite(qty) && qty > maxPos) {
      return 'Shares per trade cannot exceed max shares owned';
    }
    if (form.bracketEnabled) {
      const sl = Number(form.bracketStopLoss);
      const tp = Number(form.bracketTakeProfit);
      const hasSl = Number.isFinite(sl) && sl > 0;
      const hasTp = Number.isFinite(tp) && tp > 0;
      if (!hasSl && !hasTp) {
        return 'Enter a stop-loss and/or take-profit price for auto-exits';
      }
    }
  }

  const uiType = form.uiRuleType || form.rule_type || 'always';
  if (uiType === 'price_above' || uiType === 'price_below') {
    const th = Number(form.threshold_value);
    if (!Number.isFinite(th) || th <= 0) return 'Threshold price is required';
  }
  if (uiType === 'signal_bucket') {
    const buckets = normalizeSignalBucketList(form.signalBuckets ?? form.signalBucket);
    if (!buckets.length) return 'Select at least one signal bucket';
    const disabled = getDisabledSignalBuckets(existingRules, tickers, action, excludeRuleId);
    for (const b of buckets) {
      if (disabled.has(b)) return `Signal ${b} is not available for this ticker and action`;
    }
  }

  if (isClosingPaperAction(action)) {
    const { blockedRuleTypes } = getExitSignalRestrictions(
      existingRules,
      tickers,
      action,
      excludeRuleId
    );
    if (blockedRuleTypes.has(uiType)) {
      return String(action).toUpperCase() === 'STC'
        ? 'Sell cannot use the same Odin long signals as your Buy entry rule'
        : 'Cover cannot use the same Odin short signals as your Short entry rule';
    }
  }

  return '';
}

function normalizeSignalBucketList(raw) {
  const list = Array.isArray(raw) ? raw : raw != null && raw !== '' ? [raw] : [];
  return [...new Set(list.map(normalizeSignalBucketCode).filter(Boolean))];
}

function formatBucketsLabel(buckets) {
  if (!buckets?.length) return '';
  return ` (${buckets.join(', ')})`;
}

export function formatRuleQty(rule) {
  if (rule?.params?.close_all) return 'ALL';
  const q = Number(rule.qty);
  return Number.isFinite(q) ? String(q) : '—';
}

/** @param {object} [params] */
export function parseRuleBracket(params) {
  const b = params?.bracket;
  if (!b || typeof b !== 'object') return null;
  const stopLoss =
    b.stopLoss != null ? Number(b.stopLoss) : b.stop_loss != null ? Number(b.stop_loss) : null;
  const takeProfit =
    b.takeProfit != null ? Number(b.takeProfit) : b.take_profit != null ? Number(b.take_profit) : null;
  if ((!stopLoss || stopLoss <= 0) && (!takeProfit || takeProfit <= 0)) return null;
  return {
    stopLoss: stopLoss != null && stopLoss > 0 ? stopLoss : null,
    takeProfit: takeProfit != null && takeProfit > 0 ? takeProfit : null
  };
}

/** @param {ReturnType<typeof parseRuleBracket>} bracket */
export function formatBracketNote(bracket) {
  if (!bracket) return '';
  const parts = [];
  if (bracket.stopLoss != null) parts.push(`stop $${Number(bracket.stopLoss).toFixed(0)}`);
  if (bracket.takeProfit != null) parts.push(`target $${Number(bracket.takeProfit).toFixed(0)}`);
  return parts.length ? ` · Auto-exits: ${parts.join(' / ')}` : '';
}

function pluralShares(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return 'shares';
  return Math.abs(n) === 1 ? 'share' : 'shares';
}

function formatTriggerPhrase(uiType, formOrRule) {
  const buckets = normalizeSignalBucketList(formOrRule.signalBuckets ?? parseRuleSignalBuckets(formOrRule));
  const th = formOrRule.threshold_value;
  const thNum = Number(th);

  if (uiType === 'signal_side_long') return 'Odin signal is Long (L1–L3)';
  if (uiType === 'signal_side_short') return 'Odin signal is Short (S1–S3)';
  if (uiType === 'signal_side_neutral') return 'Odin signal is Neutral (N)';
  if (uiType === 'signal_bucket') {
    return buckets.length ? `Odin signal is ${buckets.join(', ')}` : 'Odin signal matches your picks';
  }
  if (uiType === 'price_above' && Number.isFinite(thNum) && thNum > 0) {
    return `price rises above $${thNum.toFixed(2)}`;
  }
  if (uiType === 'price_below' && Number.isFinite(thNum) && thNum > 0) {
    return `price falls below $${thNum.toFixed(2)}`;
  }
  if (uiType === 'always') return 'each scheduled market check';
  return 'your rule condition is met';
}

function formatActionVerb(action, closeAll) {
  const a = String(action || '').toUpperCase();
  if (closeAll && isClosingPaperAction(a)) return a === 'STC' ? 'SELL ALL' : 'COVER ALL';
  if (a === 'BTO') return 'BUY';
  if (a === 'STO') return 'SHORT';
  if (a === 'STC') return 'SELL';
  if (a === 'BTC') return 'COVER';
  return paperActionLabel(a).toUpperCase();
}

/** Starter presets for the strategy account wizard. */
export const RULE_FORM_TEMPLATES = {
  dip: {
    uiRuleType: 'signal_bucket',
    signalBuckets: ['L1'],
    action: 'BTO',
    qty: '1',
    maxPositionQty: '10',
    maxPositionValue: '',
    closeAll: false,
    threshold_value: '',
    bracketEnabled: false,
    bracketStopLoss: '',
    bracketTakeProfit: ''
  },
  trend: {
    uiRuleType: 'signal_bucket',
    signalBuckets: ['L2', 'L3'],
    action: 'BTO',
    qty: '1',
    maxPositionQty: '10',
    maxPositionValue: '',
    closeAll: false,
    threshold_value: '',
    bracketEnabled: false,
    bracketStopLoss: '',
    bracketTakeProfit: ''
  }
};

/**
 * Plain-English mad-libs preview for the rule form or API rule.
 * @param {object} formOrRule
 * @returns {string}
 */
export function buildRuleNaturalLanguagePreview(formOrRule) {
  const uiType = formOrRule.uiRuleType || apiRuleToUiType(formOrRule);
  const action = String(formOrRule.action || 'BTO').toUpperCase();
  const closeAll = Boolean(formOrRule.closeAll ?? formOrRule.params?.close_all);
  const tickers = Array.isArray(formOrRule.tickers)
    ? formOrRule.tickers.map((t) => String(t || '').trim().toUpperCase()).filter(Boolean)
    : [String(formOrRule.ticker || '').trim().toUpperCase()].filter(Boolean);
  const tickerLabel = tickers.length
    ? tickers.length <= 3
      ? tickers.join(', ')
      : `${tickers.length} tickers`
    : 'your ticker';

  const qtyRaw = closeAll && isClosingPaperAction(action) ? 'ALL' : formatRuleQty(formOrRule);
  const qtyNum = Number(formOrRule.qty);
  const qtyPhrase =
    qtyRaw === 'ALL'
      ? 'your full position'
      : `${qtyRaw} ${pluralShares(qtyNum)}`;

  const trigger = formatTriggerPhrase(uiType, formOrRule);
  const verb = formatActionVerb(action, closeAll);
  const isBuySide = action === 'BTO' || action === 'STC';
  const lead = isBuySide ? '🟢 WHEN' : '🔴 WHEN';

  let sentence = `${lead} ${trigger}, ${verb} ${qtyPhrase} of ${tickerLabel} every hour.`;

  if (isOpeningPaperAction(action)) {
    const limits = [];
    const maxPos = Number(formOrRule.maxPositionQty ?? formOrRule.params?.max_position_qty);
    const maxVal = Number(formOrRule.maxPositionValue ?? formOrRule.params?.max_position_value);
    if (Number.isFinite(maxPos) && maxPos > 0) {
      limits.push(`you own ${maxPos} ${pluralShares(maxPos)}`);
    }
    if (Number.isFinite(maxVal) && maxVal > 0) {
      limits.push(`position value reaches $${maxVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    }
    if (limits.length) {
      sentence += ` STOP when ${limits.join(' or ')}.`;
    }

    const bracketFromParams = parseRuleBracket(formOrRule.params || formOrRule);
    const bracketFromForm =
      formOrRule.bracketEnabled &&
      (formOrRule.bracketStopLoss || formOrRule.bracketTakeProfit)
        ? {
            stopLoss: Number(formOrRule.bracketStopLoss) > 0 ? Number(formOrRule.bracketStopLoss) : null,
            takeProfit: Number(formOrRule.bracketTakeProfit) > 0 ? Number(formOrRule.bracketTakeProfit) : null
          }
        : null;
    const bracketNote = formatBracketNote(bracketFromParams || bracketFromForm);
    if (bracketNote) sentence += bracketNote.replace(' · ', ' ') + '.';
  }

  return sentence;
}

/**
 * Chip labels for saved rules list.
 * @param {object} rule
 * @returns {{ ifLabel: string, actionLabel: string, tickerLabel: string, limitLabel: string | null, bracketLabel: string | null }}
 */
export function buildRuleChips(rule) {
  const ui = apiRuleToUiType(rule);
  const action = String(rule.action || 'BTO').toUpperCase();
  const closeAll = Boolean(rule.params?.close_all);

  let ifLabel = 'IF ';
  if (ui === 'signal_side_long') ifLabel += 'Odin: L1–L3';
  else if (ui === 'signal_side_short') ifLabel += 'Odin: S1–S3';
  else if (ui === 'signal_side_neutral') ifLabel += 'Odin: N';
  else if (ui === 'signal_bucket') {
    const buckets = parseRuleSignalBuckets(rule);
    ifLabel += buckets.length ? `Odin: ${buckets.join(', ')}` : 'Odin signals';
  } else if (ui === 'price_above') {
    const th = Number(rule.threshold_value);
    ifLabel += Number.isFinite(th) ? `Price > $${th.toFixed(0)}` : 'Price above';
  } else if (ui === 'price_below') {
    const th = Number(rule.threshold_value);
    ifLabel += Number.isFinite(th) ? `Price < $${th.toFixed(0)}` : 'Price below';
  } else ifLabel += 'Every check';

  const qty = formatRuleQty(rule);
  const verb = formatActionVerb(action, closeAll);
  const actionLabel =
    qty === 'ALL' ? `${verb}` : `${verb} ${qty} ${pluralShares(qty)}`;

  const tickerLabel = String(rule.ticker || '—').toUpperCase();

  let limitLabel = null;
  const maxPos = rule.params?.max_position_qty;
  const maxVal = rule.params?.max_position_value;
  if (isOpeningPaperAction(action)) {
    const parts = [];
    if (maxPos != null && Number.isFinite(Number(maxPos))) {
      parts.push(`Max ${Number(maxPos)} shares`);
    }
    if (maxVal != null && Number.isFinite(Number(maxVal))) {
      parts.push(`$${Number(maxVal).toLocaleString('en-US', { maximumFractionDigits: 0 })} cap`);
    }
    if (parts.length) limitLabel = parts.join(' · ');
  }

  const bracket = parseRuleBracket(rule.params);
  const bracketLabel = bracket
    ? [
        bracket.stopLoss != null ? `Stop $${Number(bracket.stopLoss).toFixed(0)}` : null,
        bracket.takeProfit != null ? `Target $${Number(bracket.takeProfit).toFixed(0)}` : null
      ]
        .filter(Boolean)
        .join(' · ') || null
    : null;

  return { ifLabel, actionLabel, tickerLabel, limitLabel, bracketLabel };
}

export function ruleSummary(rule) {
  const ui = apiRuleToUiType(rule);
  const opt = RULE_TYPE_OPTIONS.find((o) => o.id === ui);
  const typeLabel = opt?.label || rule.rule_type;
  const th =
    rule.threshold_value != null && Number.isFinite(Number(rule.threshold_value))
      ? ` @ $${Number(rule.threshold_value).toFixed(2)}`
      : '';
  const bucket = formatBucketsLabel(parseRuleSignalBuckets(rule));
  const actionLabel = paperActionLabel(rule.action);
  const qtyLabel = formatRuleQty(rule);
  const maxPos = rule.params?.max_position_qty;
  const maxVal = rule.params?.max_position_value;
  const maxNote =
    maxPos != null && Number.isFinite(Number(maxPos))
      ? ` · max ${Number(maxPos)} sh`
      : '';
  const maxValueNote =
    maxVal != null && Number.isFinite(Number(maxVal))
      ? ` · max $${Number(maxVal).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : '';
  const bracketNote = formatBracketNote(parseRuleBracket(rule.params));
  return `${typeLabel}${th}${bucket} · ${rule.ticker} · ${actionLabel} ×${qtyLabel}${maxNote}${maxValueNote}${bracketNote}`;
}

/** Shorter summary for watchlist rows (ticker shown separately). */
export function ruleSummaryInline(rule) {
  const ui = apiRuleToUiType(rule);
  const opt = RULE_TYPE_OPTIONS.find((o) => o.id === ui);
  let typeLabel = opt?.label || rule.rule_type;
  if (ui === 'signal_side_long') typeLabel = 'Long L1–L3';
  else if (ui === 'signal_side_short') typeLabel = 'Short S1–S3';
  else if (ui === 'signal_side_neutral') typeLabel = 'Neutral N';
  else if (ui === 'signal_bucket') {
    const buckets = parseRuleSignalBuckets(rule);
    typeLabel = buckets.length ? `Signals ${buckets.join(',')}` : 'Signals';
  } else if (ui === 'always') typeLabel = 'Always';
  else if (ui === 'price_above') typeLabel = 'Price above';
  else if (ui === 'price_below') typeLabel = 'Price below';

  const th =
    rule.threshold_value != null && Number.isFinite(Number(rule.threshold_value))
      ? ` $${Number(rule.threshold_value).toFixed(0)}`
      : '';
  const actionLabel = paperActionLabel(rule.action);
  const qtyLabel = formatRuleQty(rule);
  const bracketNote = formatBracketNote(parseRuleBracket(rule.params));
  return `${typeLabel}${th} · ${actionLabel} ×${qtyLabel}${bracketNote}`;
}

/** Map API rule → StrategyRuleForm state (single ticker). */
export function ruleToForm(rule) {
  const params = rule?.params || {};
  return {
    uiRuleType: apiRuleToUiType(rule),
    tickers: [String(rule.ticker || '').trim().toUpperCase()].filter(Boolean),
    action: String(rule.action || 'BTO').toUpperCase(),
    qty: String(rule.qty ?? '1'),
    maxPositionQty:
      params.max_position_qty != null && Number.isFinite(Number(params.max_position_qty))
        ? String(params.max_position_qty)
        : '10',
    maxPositionValue:
      params.max_position_value != null && Number.isFinite(Number(params.max_position_value))
        ? String(params.max_position_value)
        : '',
    closeAll: Boolean(params.close_all),
    threshold_value:
      rule.threshold_value != null && Number.isFinite(Number(rule.threshold_value))
        ? String(rule.threshold_value)
        : '',
    signalBuckets: parseRuleSignalBuckets(rule),
    bracketEnabled: Boolean(parseRuleBracket(params)),
    bracketStopLoss: (() => {
      const b = parseRuleBracket(params);
      return b?.stopLoss != null ? String(b.stopLoss) : '';
    })(),
    bracketTakeProfit: (() => {
      const b = parseRuleBracket(params);
      return b?.takeProfit != null ? String(b.takeProfit) : '';
    })()
  };
}

/** Default rule payload when adding from watchlist long/short leaderboards. */
export function buildWatchlistQuickRule(ticker, side) {
  const sym = String(ticker || '').trim().toUpperCase();
  const isLong = side === 'long';
  return {
    rule_type: 'signal_side',
    ticker: sym,
    action: isLong ? 'BTO' : 'STO',
    qty: 1,
    params: {
      side: isLong ? 'long' : 'short',
      max_position_qty: 10
    },
    is_active: true
  };
}

export function ruleTickerKey(rule) {
  return String(rule?.ticker || '').trim().toUpperCase();
}
