'use client';
const HIGHLIGHT_MS = 2200;

export function scrollToStrategyAnchor(anchor) {
  window.requestAnimationFrame(() => {
    const el = document.querySelector(`[data-strategy-anchor="${anchor}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

/**
 * Scroll to rule row(s) in Active rules and briefly highlight all of them.
 * @param {string|string[]} ruleIds
 */
export function scrollToStrategyRules(ruleIds) {
  const ids = (Array.isArray(ruleIds) ? ruleIds : [ruleIds]).filter(Boolean);
  if (!ids.length) return;

  window.requestAnimationFrame(() => {
    const elements = ids
      .map((id) => document.querySelector(`[data-strategy-rule-id="${id}"]`))
      .filter(Boolean);

    if (!elements.length) {
      scrollToStrategyAnchor('rules-list');
      return;
    }

    elements[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    for (const el of elements) {
      el.classList.add('paper-strategy-rules-list__item--highlight');
    }

    window.setTimeout(() => {
      for (const el of elements) {
        el.classList.remove('paper-strategy-rules-list__item--highlight');
      }
    }, HIGHLIGHT_MS);
  });
}

/** @param {string} ruleId */
export function scrollToStrategyRule(ruleId) {
  scrollToStrategyRules(ruleId ? [ruleId] : []);
}
