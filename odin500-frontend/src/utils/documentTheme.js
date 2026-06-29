export function getDocumentTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/** Stable SSR / hydration snapshot — must match server-rendered markup. */
export function getServerDocumentTheme() {
  return 'dark';
}

export function applyDocumentTheme(theme) {
  if (typeof document === 'undefined') return;
  const next = theme === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== next) {
    root.setAttribute('data-theme', next);
  }
  try {
    localStorage.setItem('odin_theme', next);
  } catch {
    /* ignore */
  }
}

export function subscribeDocumentTheme(callback) {
  if (typeof document === 'undefined') return () => {};
  let last = getDocumentTheme();
  const obs = new MutationObserver(() => {
    const next = getDocumentTheme();
    if (next === last) return;
    last = next;
    callback();
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
}
