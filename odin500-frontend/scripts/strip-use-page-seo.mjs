import fs from 'node:fs';
import path from 'node:path';

const views = [
  'src/views/IndexPage.jsx',
  'src/views/TickerReportPage.jsx',
  'src/views/ReturnTablePage.jsx',
  'src/views/NewsPage.jsx',
  'src/views/TickerQuarterlyPage.jsx',
  'src/views/TickerMonthlyPage.jsx',
  'src/views/TickerAnnualPage.jsx',
  'src/views/StockSplitsPage.jsx',
  'src/views/StatisticDataPage.jsx',
  'src/views/OdinSignalsPage.jsx',
  'src/views/MarketMoversPage.jsx',
  'src/views/MarketHeatmapPage.jsx',
  'src/views/Pricing.jsx',
  'src/views/HistoricalDataPage.jsx',
  'src/views/AboutPage.jsx'
];

for (const rel of views) {
  const file = path.join(process.cwd(), rel);
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/import \{ usePageSeo \} from ['"].*usePageSeo\.js['"];\r?\n/, '');
  s = s.replace(/\r?\n  usePageSeo\(\{[\s\S]*?\}\);\r?\n/, '\n');
  fs.writeFileSync(file, s);
  console.log('cleaned', rel);
}
