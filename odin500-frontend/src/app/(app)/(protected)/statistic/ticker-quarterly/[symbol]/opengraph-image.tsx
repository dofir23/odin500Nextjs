import { createBrandOgImage } from '@/seo/createOgImage';

export const runtime = 'edge';
export const alt = 'Odin500 Quarterly Returns';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const sym = String(symbol || 'AAPL')
    .trim()
    .toUpperCase()
    .slice(0, 12);
  return createBrandOgImage(`${sym} Quarterly Returns`, 'Quarter-by-quarter performance statistics');
}
