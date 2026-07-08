import { createBrandOgImage } from '@/seo/createOgImage';

export const runtime = 'edge';
export const alt = 'Sector ETF performance';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LABELS: Record<string, string> = {
  xlb: 'Materials',
  xlk: 'Technology',
  xlf: 'Financials',
  xlv: 'Healthcare',
  xli: 'Industrials',
  xle: 'Energy',
  xly: 'Consumer Discretionary',
  xlp: 'Consumer Staples',
  xlu: 'Utilities',
  xlre: 'Real Estate',
  xlc: 'Communication Services'
};

const ETF: Record<string, string> = {
  xlb: 'XLB',
  xlk: 'XLK',
  xlf: 'XLF',
  xlv: 'XLV',
  xli: 'XLI',
  xle: 'XLE',
  xly: 'XLY',
  xlp: 'XLP',
  xlu: 'XLU',
  xlre: 'XLRE',
  xlc: 'XLC'
};

export default async function Image({ params }: { params: Promise<{ sectorKey: string }> }) {
  const { sectorKey } = await params;
  const slug = String(sectorKey || 'xlk').toLowerCase();
  const label = LABELS[slug] || slug.toUpperCase();
  const etf = ETF[slug] || slug.toUpperCase();
  return createBrandOgImage(`${label} (${etf})`, 'Sector returns, chart & constituents');
}
