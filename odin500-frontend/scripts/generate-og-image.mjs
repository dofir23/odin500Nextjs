/**
 * Generates public/og-default.png (1200×630) from odin500-logo.svg.
 * Run: npm run gen:og-image
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const logoPath = path.join(publicDir, 'odin500-logo.svg');
const outPath = path.join(publicDir, 'og-default.png');

const WIDTH = 1200;
const HEIGHT = 630;
const BG = '#0f172a';
const ACCENT = '#59A9FF';

async function main() {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Logo not found: ${logoPath}`);
  }

  const logoSvg = fs.readFileSync(logoPath);
  const logoWidth = 520;
  const logoPng = await sharp(logoSvg).resize(logoWidth).png().toBuffer();
  const logoMeta = await sharp(logoPng).metadata();
  const logoH = logoMeta.height || 120;

  const taglineSvg = Buffer.from(`<svg width="${WIDTH}" height="80" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    font-size="32" font-weight="500" fill="${ACCENT}" letter-spacing="0.02em">
    OHLC Data, Returns &amp; Trading Signals
  </text>
</svg>`);

  const taglinePng = await sharp(taglineSvg).png().toBuffer();
  const taglineMeta = await sharp(taglinePng).metadata();
  const taglineH = taglineMeta.height || 80;

  const gap = 36;
  const blockH = logoH + gap + taglineH;
  const logoTop = Math.round((HEIGHT - blockH) / 2);
  const taglineTop = logoTop + logoH + gap;
  const logoLeft = Math.round((WIDTH - logoWidth) / 2);

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: BG
    }
  })
    .composite([
      { input: logoPng, top: logoTop, left: logoLeft },
      { input: taglinePng, top: taglineTop, left: 0 }
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`Wrote ${outPath} (${WIDTH}×${HEIGHT})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
