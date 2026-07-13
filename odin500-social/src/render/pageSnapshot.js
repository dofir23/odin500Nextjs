const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { config, ensureDirs } = require('../config');
const { log } = require('../utils/log');
const { resolveChromeExecutable } = require('./resolveChrome');

function absolutePageUrl(pagePath) {
  const base = config.odinSiteOrigin.replace(/\/$/, '');
  const p = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  const url = new URL(p, `${base}/`);
  url.searchParams.set('socialCapture', '1');
  return url.toString();
}

async function launchBrowser() {
  const executablePath = resolveChromeExecutable();
  if (!executablePath) {
    throw new Error(
      'No Chromium found for page snapshots. Run: cd odin500-social && npx puppeteer browsers install chrome'
    );
  }

  log.info('snapshot', `Using Chromium at ${executablePath}`);

  return puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--hide-scrollbars'
    ],
    defaultViewport: {
      width: config.snapshotViewportWidth,
      height: config.snapshotViewportHeight,
      deviceScaleFactor: config.snapshotDeviceScale
    }
  });
}

async function waitForChartPaint(page, selector) {
  await page
    .waitForFunction(
      (sel) => {
        const root = document.querySelector(sel);
        if (!root) return false;
        if (
          root.classList.contains('ticker-annual-figma__chart-card--skeleton') ||
          root.classList.contains('ticker-annual-figma__chart-card--empty') ||
          root.classList.contains('market-movers-page__bar-frame--skeleton')
        ) {
          return false;
        }
        const rect = root.getBoundingClientRect();
        if (rect.width < 80 || rect.height < 80) return false;
        const canvas = root.querySelector('canvas');
        if (canvas) return canvas.width > 0 && canvas.height > 0;
        const svg = root.querySelector('svg');
        if (svg) {
          const box = svg.getBoundingClientRect();
          return box.width > 40 && box.height > 40;
        }
        return true;
      },
      { timeout: 60000 },
      selector
    )
    .catch(() => {
      log.warn('snapshot', 'Chart paint wait timed out — using settle delay');
    });
}

async function pickCaptureTarget(page, selector, fallbackSelector) {
  const handle = await page.evaluateHandle(
    (primary, fallback) => {
      const isUsable = (el) => {
        if (!el) return false;
        if (
          el.classList.contains('ticker-annual-figma__chart-card--skeleton') ||
          el.classList.contains('ticker-annual-figma__chart-card--empty') ||
          el.classList.contains('market-movers-page__bar-frame--skeleton')
        ) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width >= 80 && rect.height >= 80;
      };

      const trySel = (sel) => {
        if (!sel) return null;
        const nodes = Array.from(document.querySelectorAll(sel));
        return nodes.find(isUsable) || null;
      };

      return trySel(primary) || trySel(fallback) || document.body;
    },
    selector,
    fallbackSelector
  );
  return handle.asElement();
}

/**
 * Screenshot a region of a live Odin500 page.
 */
async function capturePageSnapshot({ pagePath, selector, outBasename, fallbackSelector }) {
  if (config.snapshotEnabled === false) {
    throw new Error('Page snapshots disabled (SNAPSHOT_ENABLED=false)');
  }

  ensureDirs();
  const url = absolutePageUrl(pagePath);
  const waitSelector = selector || fallbackSelector || 'body';
  log.info('snapshot', `Capturing ${url}`, { selector: waitSelector });

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(config.snapshotTimeoutMs);
    page.setDefaultTimeout(config.snapshotTimeoutMs);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.snapshotTimeoutMs });

    await page
      .waitForFunction(() => document.documentElement.dataset.socialCapture === '1', {
        timeout: 20000
      })
      .catch(() => {
        log.warn('snapshot', 'socialCapture marker not seen — continuing');
      });

    await page
      .waitForFunction(() => document.documentElement.dataset.appHydrated === 'true', {
        timeout: 45000
      })
      .catch(() => {
        log.warn('snapshot', 'Hydration marker not seen — continuing anyway');
      });

    await page.waitForSelector(waitSelector, { timeout: 60000 }).catch(() => {
      log.warn('snapshot', `Selector not found: ${waitSelector}`);
    });

    await waitForChartPaint(page, waitSelector);
    if (fallbackSelector && fallbackSelector !== waitSelector) {
      await waitForChartPaint(page, fallbackSelector);
    }

    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, waitSelector);

    await new Promise((r) => setTimeout(r, config.snapshotSettleMs));

    let target = await pickCaptureTarget(page, selector, fallbackSelector);
    if (!target) {
      log.warn('snapshot', 'Falling back to full-page screenshot');
      target = await page.$('body');
    }

    const buffer = await target.screenshot({ type: 'png' });
    const filename = `${outBasename}.png`;
    const filePath = path.join(config.assetsDir, filename);
    fs.writeFileSync(filePath, buffer);

    log.info('snapshot', `Saved ${filename}`, { bytes: buffer.length, pagePath });
    return { filename, filePath, source: 'page_snapshot', pageUrl: url };
  } catch (err) {
    log.error('snapshot', `Capture failed for ${pagePath}`, err?.message || err);
    throw err;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { capturePageSnapshot, absolutePageUrl };
