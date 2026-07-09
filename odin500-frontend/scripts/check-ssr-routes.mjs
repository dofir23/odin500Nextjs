#!/usr/bin/env node
/**
 * SSR / CSR-bailout checker for Odin500 Next.js routes.
 *
 * 1. Runs `next build` and scans for BAILOUT / deopt warnings.
 * 2. Starts `next start` (or uses CHECK_SSR_BASE_URL) and fetches HTML for sitemap paths.
 * 3. Reports routes missing server-rendered markers.
 *
 * Env:
 *   CHECK_SSR_SKIP_BUILD=1     — skip build, use existing .next
 *   CHECK_SSR_SKIP_HTML=1      — build scan only
 *   CHECK_SSR_BASE_URL=http://… — test remote/prod instead of local next start
 *   CHECK_SSR_PORT=34567       — local server port (default 34567)
 *   CHECK_SSR_SAMPLE_TICKER=AAPL — ticker used for dynamic route samples
 */

import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDynamicSitemapPaths,
  SITEMAP_STATIC_PATHS
} from '../src/seo/sitemapRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SKIP_BUILD = process.env.CHECK_SSR_SKIP_BUILD === '1';
const SKIP_HTML = process.env.CHECK_SSR_SKIP_HTML === '1';
const BASE_URL_ENV = process.env.CHECK_SSR_BASE_URL?.replace(/\/$/, '') || '';
const PORT = Number(process.env.CHECK_SSR_PORT || 34567);
const SAMPLE_TICKER = (process.env.CHECK_SSR_SAMPLE_TICKER || 'AAPL').toUpperCase();

const SSR_MARKERS = [
  'data-ssr-primary',
  'ssr-page-content',
  'full-ssr-page__server',
  'data-ssr-nav',
  'ssr-app-chrome'
];

const BAILOUT_PATTERNS = [
  /BAILOUT_TO_CLIENT_SIDE_RENDERING/i,
  /deopted into client-side rendering/i,
  /Entire page .* deopted/i
];

function log(section, msg) {
  console.log(`\n=== ${section} ===\n${msg}`);
}

function runBuild() {
  log('BUILD', 'Running next build (this may take a few minutes)…');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  const out = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) {
    console.error(out);
    throw new Error(`next build failed with exit code ${result.status}`);
  }
  return out;
}

function parseBuildReport(buildOutput) {
  const bailoutLines = [];
  const routeLines = [];

  for (const line of buildOutput.split(/\r?\n/)) {
    if (BAILOUT_PATTERNS.some((re) => re.test(line))) bailoutLines.push(line.trim());
    if (/^\s*[○●ƒλ]\s+\//.test(line) || /^\s*├|└|┌/.test(line)) routeLines.push(line);
  }

  return { bailoutLines, routeLines };
}

function collectTestPaths() {
  const paths = buildDynamicSitemapPaths([SAMPLE_TICKER]);
  // Also spot-check a few auth/app routes not in sitemap (informational).
  const extra = ['/login', '/paper-trading', '/accounts', '/forgot-password'];
  return [...new Set([...paths, ...extra])];
}

async function waitForServer(url, maxMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      /* retry */
    }
    await sleep(1500);
  }
  return false;
}

function startNextServer(port) {
  return spawn('npm', ['run', 'start', '--', '-p', String(port)], {
    cwd: ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port) }
  });
}

async function fetchHtml(baseUrl, routePath) {
  const url = routePath === '/' ? `${baseUrl}/` : `${baseUrl}${routePath}`;
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'User-Agent': 'odin500-ssr-check/1.0' }
  });

  const location = res.headers.get('location');
  let html = '';
  if (res.status !== 301 && res.status !== 302 && res.status !== 307 && res.status !== 308) {
    html = await res.text();
  }

  return { status: res.status, location, html, url };
}

function analyzeHtml(html) {
  const hasSsrMarker = SSR_MARKERS.some((m) => html.includes(m));
  const hasBailoutPayload = /BAILOUT_TO_CLIENT_SIDE_RENDERING/i.test(html);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match
    ? h1Match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
    : '';
  const bodyLen = html.length;

  return { hasSsrMarker, hasBailoutPayload, h1Text, bodyLen };
}

async function checkHtmlRoutes(baseUrl, paths) {
  const results = [];

  for (const routePath of paths) {
    try {
      const { status, location, html, url } = await fetchHtml(baseUrl, routePath);
      const analysis = analyzeHtml(html);
      const redirected = status >= 300 && status < 400;

      let verdict = 'ok';
      if (redirected) {
        verdict = 'redirect';
      } else if (analysis.hasBailoutPayload && !analysis.hasSsrMarker) {
        verdict = 'bailout-in-html';
      } else if (!analysis.hasSsrMarker && analysis.bodyLen < 8000) {
        verdict = 'thin-html';
      } else if (!analysis.hasSsrMarker) {
        verdict = 'no-ssr-marker';
      } else if (analysis.hasBailoutPayload) {
        verdict = 'ok-bailout-payload-only';
      }

      results.push({
        path: routePath,
        url,
        status,
        location,
        verdict,
        ...analysis
      });
    } catch (err) {
      results.push({
        path: routePath,
        url: `${baseUrl}${routePath}`,
        status: 0,
        verdict: 'error',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return results;
}

function printHtmlReport(results) {
  const byVerdict = {};
  for (const r of results) {
    byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
  }

  const lines = [
    `Total routes checked: ${results.length}`,
    `Summary: ${Object.entries(byVerdict)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
    ''
  ];

  const problemVerdicts = new Set(['bailout-in-html', 'thin-html', 'no-ssr-marker', 'error']);
  const payloadNotes = results.filter((r) => r.verdict === 'ok-bailout-payload-only');

  const problems = results.filter((r) => problemVerdicts.has(r.verdict));

  if (payloadNotes.length) {
    lines.push(
      `Note: ${payloadNotes.length} route(s) contain BAILOUT in RSC flight data but have full SSR HTML (client subtree only) — not an SEO failure.`
    );
  }

  if (problems.length) {
    lines.push('--- Issues ---');
    for (const r of problems) {
      lines.push(
        `  ${r.path} → ${r.verdict} (HTTP ${r.status}${r.location ? ` → ${r.location}` : ''})` +
          (r.h1Text ? ` h1="${r.h1Text}"` : '') +
          (r.error ? ` err=${r.error}` : '') +
          (r.bodyLen != null ? ` bytes=${r.bodyLen}` : '')
      );
    }
  } else {
    lines.push('All checked routes passed SSR marker checks (or redirected as expected).');
  }

  lines.push('', '--- Static sitemap paths ---');
  for (const r of results.filter((x) => SITEMAP_STATIC_PATHS.includes(x.path))) {
    lines.push(`  ${r.path}: ${r.verdict} (HTTP ${r.status})${r.h1Text ? ` — ${r.h1Text}` : ''}`);
  }

  return lines.join('\n');
}

async function main() {
  console.log('Odin500 SSR / CSR bailout route checker\n');

  let buildOutput = '';
  if (!SKIP_BUILD) {
    buildOutput = runBuild();
  } else {
    log('BUILD', 'Skipped (CHECK_SSR_SKIP_BUILD=1)');
  }

  if (buildOutput) {
    const { bailoutLines, routeLines } = parseBuildReport(buildOutput);
    if (bailoutLines.length) {
      log('BUILD BAILOUT WARNINGS', bailoutLines.join('\n'));
    } else {
      log('BUILD BAILOUT WARNINGS', 'None found in build output.');
    }
    if (routeLines.length) {
      log('BUILD ROUTE TABLE (excerpt)', routeLines.slice(0, 80).join('\n'));
    }
  }

  if (SKIP_HTML) {
    log('HTML CHECK', 'Skipped (CHECK_SSR_SKIP_HTML=1)');
    return;
  }

  const paths = collectTestPaths();
  log('HTML CHECK', `Testing ${paths.length} paths (sample ticker: ${SAMPLE_TICKER})…`);

  let baseUrl = BASE_URL_ENV;
  let child = null;

  if (!baseUrl) {
    const ready = await waitForServer(`http://127.0.0.1:${PORT}`, 3000).catch(() => false);
    if (!ready) {
      child = startNextServer(PORT);
      const ok = await waitForServer(`http://127.0.0.1:${PORT}`);
      if (!ok) {
        child.kill();
        throw new Error(`next start did not become ready on port ${PORT}`);
      }
    }
    baseUrl = `http://127.0.0.1:${PORT}`;
    log('SERVER', `Using ${baseUrl}`);
  } else {
    log('SERVER', `Using CHECK_SSR_BASE_URL=${baseUrl}`);
  }

  try {
    const results = await checkHtmlRoutes(baseUrl, paths);
    log('HTML RESULTS', printHtmlReport(results));
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await sleep(500);
      if (!child.killed) child.kill('SIGKILL');
    }
  }

  const hasProblems = false; // informational script — non-zero only on thrown errors
  if (hasProblems) process.exit(1);
}

main().catch((err) => {
  console.error('\n[check-ssr-routes] FAILED:', err.message || err);
  process.exit(1);
});
