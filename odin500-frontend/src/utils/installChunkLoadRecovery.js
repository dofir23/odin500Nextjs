import { isChunkLoadError } from './lazyWithRetry.js';

const SESSION_KEY = 'odin_chunk_reload';

/**
 * One-time full reload when a stale/missing webpack chunk crashes the app
 * (common after deploys or client navigations from auth → protected routes).
 */
export function installChunkLoadRecovery() {
  if (typeof window === 'undefined') return () => {};

  function tryReload(error) {
    if (!isChunkLoadError(error)) return;
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(SESSION_KEY, '1');
        window.location.reload();
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  const onError = (event) => {
    tryReload(event?.error || event?.message);
  };

  const onRejection = (event) => {
    tryReload(event?.reason);
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

/**
 * Hard navigation — avoids client-side chunk load races after login/session changes.
 * @param {string} path
 */
export function hardNavigate(path) {
  if (typeof window === 'undefined') return;
  const dest = path.startsWith('/') ? path : `/${path}`;
  window.location.replace(dest);
}
