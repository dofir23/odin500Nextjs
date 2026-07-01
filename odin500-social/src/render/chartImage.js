const fetch = require('node-fetch');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { config, ensureDirs } = require('../config');
const { etDateLabel } = require('../utils/utm');

function buildLineChartConfig({ labels, values, title, subtitle }) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          borderColor: config.brand.chartLine,
          backgroundColor: 'rgba(96, 165, 250, 0.12)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: [title, subtitle].filter(Boolean),
          color: '#e2e8f0',
          font: { size: 18, weight: 'bold' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', maxTicksLimit: 6 },
          grid: { color: config.brand.chartGrid }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: config.brand.chartGrid }
        }
      }
    }
  };
}

async function fetchQuickChartPng(chartConfig, { width = 1200, height = 675 } = {}) {
  const chartJson = encodeURIComponent(JSON.stringify(chartConfig));
  const url = `https://quickchart.io/chart?c=${chartJson}&width=${width}&height=${height}&backgroundColor=${encodeURIComponent(config.brand.chartBg)}&format=png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`QuickChart failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function brandChartPng(inputBuffer, { footer = '' } = {}) {
  const meta = await sharp(inputBuffer).metadata();
  const w = meta.width || 1200;
  const h = meta.height || 675;
  const barH = 48;

  const footerText = footer || `${config.brand.name} · ${config.brand.url} · As of ${etDateLabel()} ET`;
  const svg = `
    <svg width="${w}" height="${barH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0b1220"/>
      <text x="24" y="30" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="14">${escapeXml(footerText)}</text>
      <text x="${w - 24}" y="30" text-anchor="end" fill="#60a5fa" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold">${escapeXml(config.brand.name)}</text>
    </svg>`;

  const bar = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(inputBuffer)
    .extend({ bottom: barH, background: '#0b1220' })
    .composite([{ input: bar, top: h, left: 0 }])
    .png()
    .toBuffer();
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ohlcToSeries(rows) {
  const sorted = [...(rows || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return {
    labels: sorted.map((r) => String(r.date).slice(5)),
    values: sorted.map((r) => Number(r.close))
  };
}

async function renderOhlcChart({ symbol, companyName, rows, subtitle }, outBasename) {
  ensureDirs();
  const { labels, values } = ohlcToSeries(rows);
  if (!labels.length) throw new Error('No OHLC rows to chart');

  const title = `$${symbol}${companyName ? ` — ${companyName}` : ''}`;
  const chartConfig = buildLineChartConfig({ labels, values, title, subtitle });
  const raw = await fetchQuickChartPng(chartConfig);
  const branded = await brandChartPng(raw, {
    footer: `${config.disclaimer.slice(0, 60)}…`
  });

  const filename = `${outBasename}.png`;
  const filePath = path.join(config.assetsDir, filename);
  fs.writeFileSync(filePath, branded);
  return { filename, filePath, width: 1200, height: 675 + 48 };
}

module.exports = {
  renderOhlcChart,
  buildLineChartConfig,
  fetchQuickChartPng,
  brandChartPng,
  ohlcToSeries
};
