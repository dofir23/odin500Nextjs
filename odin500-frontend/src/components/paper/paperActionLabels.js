'use client';
/** Display labels for paper_trade_action enum values (API still uses BTO/STO/BTC/STC). */

export const PAPER_ACTION_OPTIONS = [
  { id: 'BTO', label: 'Buy', hint: 'Open long' },
  { id: 'STO', label: 'Short', hint: 'Open short' },
  { id: 'STC', label: 'Sell', hint: 'Close long' },
  { id: 'BTC', label: 'Cover', hint: 'Close short' }
];

export function paperActionLabel(action, { withHint = false } = {}) {
  const id = String(action || '').toUpperCase();
  const opt = PAPER_ACTION_OPTIONS.find((o) => o.id === id);
  if (!opt) return id || '—';
  return withHint && opt.hint ? `${opt.label} (${opt.hint})` : opt.label;
}

export function isOpeningPaperAction(action) {
  const a = String(action || '').toUpperCase();
  return a === 'BTO' || a === 'STO';
}

export function isClosingPaperAction(action) {
  const a = String(action || '').toUpperCase();
  return a === 'STC' || a === 'BTC';
}
