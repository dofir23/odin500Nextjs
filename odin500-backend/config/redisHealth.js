/**
 * Redis health probe (separate module so it works even when config/redis exports null).
 */
const redis = require('./redis');

function hasUpstashEnv() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * @returns {Promise<{ ok: boolean, configured: boolean, mode: string, latencyMs: number|null, ping?: unknown, writeOk?: boolean, error?: string }>}
 */
async function checkRedisHealth() {
  const configured = !!(process.env.REDIS_URL || hasUpstashEnv());
  if (!configured || !redis) {
    return {
      ok: false,
      configured: false,
      mode: 'none',
      latencyMs: null,
      error: 'REDIS_URL / Upstash env not set — cache is disabled (every API miss hits BigQuery)'
    };
  }

  const started = Date.now();
  const timeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000);
  try {
    const pong = await withTimeout(
      typeof redis.ping === 'function' ? redis.ping() : Promise.resolve('PONG'),
      timeoutMs,
      'redis ping'
    );
    if (pong == null || String(pong).toUpperCase() !== 'PONG') {
      return {
        ok: false,
        configured: true,
        mode: 'error',
        latencyMs: Date.now() - started,
        ping: pong,
        error: pong == null ? 'Ping returned null (client unreachable)' : `Unexpected ping: ${String(pong)}`
      };
    }

    const probeKey = `__odin500_health_${Date.now()}__`;
    await withTimeout(redis.set(probeKey, { ok: true }, { ex: 30 }), timeoutMs, 'redis set');
    const got = await withTimeout(redis.get(probeKey), timeoutMs, 'redis get');
    const writeOk = !!(got && (got.ok === true || got === true));
    const latencyMs = Date.now() - started;

    return {
      ok: writeOk,
      configured: true,
      mode: process.env.REDIS_URL ? 'tcp' : 'upstash-rest',
      latencyMs,
      ping: pong,
      writeOk,
      error: writeOk ? undefined : 'SET/GET probe failed — cache writes may not persist'
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      mode: 'error',
      latencyMs: Date.now() - started,
      error: err?.message || String(err)
    };
  }
}

module.exports = { checkRedisHealth };
