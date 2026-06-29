const CHUNK_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed/i;

/**
 * Wrap a dynamic import so a one-time full reload can recover after deploys
 * when index.html and lazy chunks are briefly out of sync.
 */
export function lazyWithRetry(importFn, { retries = 1 } = {}) {
  return importFn().catch((error) => {
    const message = String(error?.message || error || '');
    if (!CHUNK_RE.test(message)) throw error;

    const key = 'odin_chunk_reload';
    try {
      if (!sessionStorage.getItem(key) && retries > 0) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(key);
    } catch {
      /* ignore storage errors */
    }

    throw error;
  });
}
