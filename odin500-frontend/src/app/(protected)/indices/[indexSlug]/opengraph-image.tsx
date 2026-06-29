import { createBrandOgImage } from '@/seo/createOgImage';

export const runtime = 'edge';
export const alt = 'Index chart and returns';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LABELS: Record<string, string> = {
  sp500: 'S&P 500',
  'dow-jones': 'Dow Jones',
  'nasdaq-100': 'Nasdaq 100'
};

export default async function Image({ params }: { params: Promise<{ indexSlug: string }> }) {
  const { indexSlug } = await params;
  const slug = String(indexSlug || 'sp500').toLowerCase();
  const label = LABELS[slug] || slug.replace(/-/g, ' ');
  return createBrandOgImage(`${label} Index`, 'Returns, OHLC chart & market data');
}
