/**
 * Install Puppeteer Chrome when missing (best-effort; system Chrome/Edge also works).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const { resolveChromeExecutable } = require('../src/render/resolveChrome');

if (resolveChromeExecutable()) {
  console.log('[odin500-social] Chromium already available for snapshots');
  process.exit(0);
}

try {
  console.log('[odin500-social] Installing Puppeteer Chrome for page snapshots…');
  execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
} catch (err) {
  console.warn('[odin500-social] Puppeteer Chrome install skipped:', err?.message || err);
  console.warn('[odin500-social] Set PUPPETEER_EXECUTABLE_PATH or install Google Chrome / Edge.');
}

if (!resolveChromeExecutable()) {
  console.warn('[odin500-social] No Chromium binary found yet — page snapshots will fall back to QuickChart.');
}
