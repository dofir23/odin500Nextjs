const fs = require('fs');
const path = require('path');
const { config } = require('../config');

function fileExists(p) {
  return Boolean(p && fs.existsSync(p));
}

/** Resolve a Chromium binary: env → Puppeteer cache → system Chrome/Edge. */
function resolveChromeExecutable() {
  if (fileExists(config.puppeteerExecutablePath)) {
    return config.puppeteerExecutablePath;
  }

  try {
    const puppeteer = require('puppeteer');
    const bundled = puppeteer.executablePath();
    if (fileExists(bundled)) return bundled;
  } catch {
    /* puppeteer not installed */
  }

  const candidates = [];
  if (process.platform === 'win32') {
    const pf = process.env.PROGRAMFILES;
    const pf86 = process.env['PROGRAMFILES(X86)'];
    const local = process.env.LOCALAPPDATA;
    if (pf) candidates.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    if (pf86) candidates.push(path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    if (local) candidates.push(path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    if (pf) candidates.push(path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    if (pf86) candidates.push(path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }

  return null;
}

module.exports = { resolveChromeExecutable };
