/**
 * Fetch for @supabase/supabase-js on Node 18+.
 * Avoids node-fetch v2 Gunzip "Premature close" on Railway ↔ Supabase.
 */

const RETRY_RE =
  /premature close|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|network|aborted/i;

const nativeFetch = globalThis.fetch;
if (typeof nativeFetch !== 'function') {
  throw new Error('Node 18+ required: global fetch is missing');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 */
async function supabaseFetch(input, init = {}) {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await nativeFetch(input, init);
      // 204/205/304 are "null body" statuses: the Response constructor throws a
      // TypeError if given any body (even an empty ArrayBuffer). Supabase/PostgREST
      // returns 204 for writes without `return=representation`, so guard against it.
      const nullBodyStatus =
        res.status === 204 || res.status === 205 || res.status === 304;
      const body = nullBodyStatus ? null : await res.arrayBuffer();
      return new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers
      });
    } catch (err) {
      lastError = err;
      const message = String(err?.message || err || '');
      if (attempt >= maxAttempts || !RETRY_RE.test(message)) {
        throw err;
      }
      await sleep(200 * attempt);
    }
  }

  throw lastError;
}

module.exports = { supabaseFetch };
