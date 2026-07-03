require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  override: true
});
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

function loadJson(rel) {
  const p = path.join(root, rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const config = {
  port: Number(process.env.PORT) || 8080,
  odinApiOrigin: String(process.env.ODIN_API_ORIGIN || 'http://localhost:5000').replace(/\/$/, ''),
  odinSiteOrigin: String(process.env.ODIN_SITE_ORIGIN || 'https://www.odin500.com').replace(/\/$/, ''),
  utmEnabled: process.env.SOCIAL_UTM_ENABLED === 'true',
  odinApiToken: String(process.env.ODIN_API_TOKEN || '').trim(),
  internalSecret: String(process.env.SOCIAL_INTERNAL_SECRET || '').trim(),
  webhookUrl: String(process.env.SOCIAL_WEBHOOK_URL || '').trim(),
  openaiApiKey: String(process.env.OPENAI_API_KEY || '').trim(),
  openaiModel: String(process.env.OPENAI_SOCIAL_MODEL || process.env.OPENAI_NEWSLETTER_MODEL || 'gpt-4o-mini').trim(),
  openaiTimeoutMs: Number(process.env.OPENAI_API_TIMEOUT_MS || 45000),
  snapshotEnabled: process.env.SNAPSHOT_ENABLED !== 'false',
  snapshotTimeoutMs: Number(process.env.SNAPSHOT_TIMEOUT_MS || 90000),
  snapshotSettleMs: Number(process.env.SNAPSHOT_SETTLE_MS || 3500),
  snapshotViewportWidth: Number(process.env.SNAPSHOT_VIEWPORT_WIDTH || 1400),
  snapshotViewportHeight: Number(process.env.SNAPSHOT_VIEWPORT_HEIGHT || 900),
  snapshotDeviceScale: Number(process.env.SNAPSHOT_DEVICE_SCALE || 2),
  puppeteerExecutablePath: String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim(),
  cronEnabled: process.env.CRON_ENABLED !== 'false',
  cronDailyPulse: process.env.CRON_DAILY_PULSE || '20 16 * * 1-5',
  cronTickerSpotlight: process.env.CRON_TICKER_SPOTLIGHT || '30 12 * * 2,4',
  cronNewsletter: process.env.CRON_NEWSLETTER || '0 10 * * 0',
  outputDir: path.join(root, 'output'),
  postsDir: path.join(root, 'output', 'posts'),
  assetsDir: path.join(root, 'output', 'assets'),
  utm: loadJson('config/utm.json'),
  hashtags: loadJson('config/hashtags.json'),
  watchlist: loadJson('config/watchlist.json'),
  disclaimer:
    'For informational and educational purposes only. Not investment advice.',
  brand: {
    name: 'Odin500',
    url: 'odin500.com',
    chartBg: '#0f172a',
    chartLine: '#60a5fa',
    chartGrid: 'rgba(148, 163, 184, 0.15)'
  }
};

function ensureDirs() {
  for (const dir of [config.outputDir, config.postsDir, config.assetsDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { config, ensureDirs };
